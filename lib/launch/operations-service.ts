import 'server-only';

import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { EpisodeExportJob, GenerationJob, OperationsClassification, OperationsJob, OperationsSummary } from '@/types';

export interface StaleThresholds { approvalMs: number; queuedMs: number; processingMs: number }
export const DEFAULT_STALE_THRESHOLDS: StaleThresholds = { approvalMs: 24 * 60 * 60 * 1000, queuedMs: 30 * 60 * 1000, processingMs: 2 * 60 * 60 * 1000 };
export function loadStaleThresholds(env: Record<string, string | undefined> = process.env): StaleThresholds { const parse = (key: string, fallback: number) => { const value = env[key]; if (!value) return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 60_000) throw new Error(`${key} must be an integer of at least 60000 milliseconds`); return parsed; }; return { approvalMs: parse('STALE_APPROVAL_MS', DEFAULT_STALE_THRESHOLDS.approvalMs), queuedMs: parse('STALE_QUEUED_MS', DEFAULT_STALE_THRESHOLDS.queuedMs), processingMs: parse('STALE_PROCESSING_MS', DEFAULT_STALE_THRESHOLDS.processingMs) }; }

export class OperationsService {
  private readonly production: ProductionService;
  constructor(private readonly repository: PersistenceRepository, private readonly now: () => Date = () => new Date(), private readonly thresholds: StaleThresholds = DEFAULT_STALE_THRESHOLDS) { this.production = new ProductionService(repository); }
  async list(user: AuthenticatedUser, seriesId?: string): Promise<OperationsSummary> {
    const series = seriesId ? [await this.production.getSeries(user, seriesId)] : await this.production.listAccessibleSeries(user); const jobs: OperationsJob[] = [];
    for (const production of series) for (const episode of await this.repository.listEpisodes(production.id)) {
      for (const scene of await this.repository.listScenes(production.id, episode.id)) for (const shot of await this.repository.listShots(production.id, episode.id, scene.id)) for (const job of await this.repository.listGenerationJobs(production.id, episode.id, scene.id, shot.id)) jobs.push(this.generation(job));
      for (const job of await this.repository.listEpisodeExportJobs(production.id, episode.id)) jobs.push(this.export(job));
    }
    jobs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id));
    const kinds: OperationsClassification[] = ['awaiting-approval', 'queued', 'processing', 'stale', 'failed', 'retryable', 'cancelled', 'completed'];
    return { jobs, counts: Object.fromEntries(kinds.map((kind) => [kind, jobs.filter((job) => job.classifications.includes(kind)).length])) as Record<OperationsClassification, number>, thresholds: this.thresholds, checkedAt: this.now() };
  }
  private generation(job: GenerationJob): OperationsJob { return this.base({ id: job.id, kind: job.generationType === 'audio' ? 'audio-generation' : 'media-generation', seriesId: job.seriesId, episodeId: job.episodeId, sceneId: job.sceneId, shotId: job.shotId, status: job.status, retryCount: job.retryCount, retryable: Boolean(job.retryable), updatedAt: job.updatedAt, actionHref: `/api/series/${job.seriesId}/episodes/${job.episodeId}/scenes/${job.sceneId}/${job.generationType === 'audio' ? 'audio' : `shots/${job.shotId}/generation`}/${job.id}` }); }
  private export(job: EpisodeExportJob): OperationsJob { return this.base({ id: job.id, kind: 'episode-export', seriesId: job.seriesId, episodeId: job.episodeId, status: job.status, progress: job.progress, retryCount: job.retryCount, retryable: Boolean(job.retryable), updatedAt: job.updatedAt, actionHref: `/api/series/${job.seriesId}/episodes/${job.episodeId}/exports/${job.id}` }); }
  private base(input: Omit<OperationsJob, 'classifications' | 'stale' | 'staleReason' | 'ageMs' | 'remediation'>): OperationsJob {
    const ageMs = Math.max(0, this.now().getTime() - input.updatedAt.getTime()); let staleReason: OperationsJob['staleReason'];
    if (input.status === 'awaiting_approval' && ageMs > this.thresholds.approvalMs) staleReason = 'approval-timeout'; else if (input.status === 'queued' && ageMs > this.thresholds.queuedMs) staleReason = 'queue-timeout'; else if (input.status === 'processing' && ageMs > this.thresholds.processingMs) staleReason = 'processing-timeout';
    const classifications: OperationsClassification[] = [];
    if (input.status === 'awaiting_approval' || input.status === 'approved') classifications.push('awaiting-approval'); if (input.status === 'queued') classifications.push('queued'); if (input.status === 'processing') classifications.push('processing'); if (input.status === 'failed') classifications.push('failed'); if (input.status === 'cancelled') classifications.push('cancelled'); if (input.status === 'completed') classifications.push('completed'); if (input.retryable && input.status === 'failed') classifications.push('retryable'); if (staleReason) classifications.push('stale');
    const remediation = staleReason === 'approval-timeout' ? 'Review and approve, reject, or cancel this job.' : staleReason ? 'Refresh status, then retry or cancel through the governed workflow.' : input.status === 'failed' ? input.retryable ? 'Retry through the approval-gated workflow.' : 'Review the normalized error and prepare a replacement.' : 'No remediation is currently required.';
    return { ...input, classifications, stale: Boolean(staleReason), staleReason, ageMs, remediation };
  }
}
