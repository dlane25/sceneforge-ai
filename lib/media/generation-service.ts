import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import type { GeneratedAsset, GenerationJob, Shot } from '@/types';
import { MockVideoProvider } from '@/lib/video/mock-provider';
import { ProductionService } from '@/lib/series/service';

export class GenerationService {
  private readonly production: ProductionService;
  private readonly provider = new MockVideoProvider();
  constructor(private readonly repository: PersistenceRepository) { this.production = new ProductionService(repository); }

  async prepare(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string): Promise<GenerationJob> {
    const shot = await this.requireShot(user, seriesId, episodeId, sceneId, shotId);
    const readiness = await this.production.getShotReadiness(user, seriesId, episodeId, sceneId, shotId);
    if (!readiness.ready) throw new Error(`Shot is not generation-ready: ${readiness.blockers.join(' ')}`);
    const active = await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shotId);
    if (active.some((job) => ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status))) throw new Error('An active generation job already exists for this shot');
    const estimatedCost = await this.provider.estimateCost({ prompt: shot.visualPrompt || shot.description, duration: shot.durationSeconds, aspectRatio: '9:16' });
    const now = new Date();
    return this.repository.createGenerationJob({ id: `generation_${shotId}_${active.length + 1}`, seriesId, episodeId, sceneId, shotId, provider: 'mock', model: 'mock-v1', generationType: 'video', status: 'awaiting_approval', promptVersion: '1.0', inputHash: `mock_${shotId}_${active.length + 1}`, promptSnapshot: shot.visualPrompt || shot.description, negativePromptSnapshot: shot.negativePrompt, durationSeconds: shot.durationSeconds, aspectRatio: '9:16', estimatedCost, actualCost: 0, retryCount: 0, outputAssetIds: [], createdAt: now, updatedAt: now });
  }

  async approve(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'awaiting_approval') throw new Error('Generation job is not awaiting approval'); return this.save(job, { status: 'approved' }); }
  async reject(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'awaiting_approval') throw new Error('Generation job is not awaiting approval'); return this.save(job, { status: 'rejected' }); }
  async start(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'approved') throw new Error('Human approval is required before generation'); const providerJob = await this.provider.generateShot({ seriesId: job.seriesId, episodeId: job.episodeId, sceneId: job.sceneId, shotId: job.shotId, prompt: job.promptSnapshot, negativePrompt: job.negativePromptSnapshot, duration: job.durationSeconds, aspectRatio: job.aspectRatio }); return this.save(job, { status: 'queued', providerJobId: providerJob.id, startedAt: new Date() }); }
  async refresh(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'VIEWER'); if (!job.providerJobId) return job; const status = await this.provider.getStatus(job.providerJobId); if (status.status === 'succeeded') { const completed = await this.save(job, { status: 'completed', actualCost: job.estimatedCost, completedAt: new Date() }); const asset: GeneratedAsset = { id: `asset_${completed.id}`, generationJobId: completed.id, seriesId: completed.seriesId, episodeId: completed.episodeId, sceneId: completed.sceneId, shotId: completed.shotId, assetType: 'video-clip', uri: status.outputUrl || `mock://assets/${completed.id}.mp4`, mimeType: 'video/mp4', width: 720, height: 1280, durationSeconds: completed.durationSeconds, provider: completed.provider, fingerprint: completed.inputHash, version: 1, reviewStatus: 'pending', createdAt: new Date(), updatedAt: new Date() }; await this.repository.createGeneratedAsset(asset); return completed; } if (status.status === 'failed') return this.save(job, { status: 'failed', errorMessage: status.errorMessage, errorCode: 'MOCK_PROVIDER_FAILED', retryable: true }); return this.save(job, { status: status.status === 'running' ? 'processing' : 'queued' }); }
  async cancel(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.providerJobId) await this.provider.cancelJob(job.providerJobId); return this.save(job, { status: 'cancelled', cancelledAt: new Date() }); }
  async retry(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> { const job = await this.requireJob(user, ids, jobId, 'OWNER'); if (job.status !== 'failed' && job.status !== 'cancelled') throw new Error('Only failed or cancelled jobs can be retried'); if (job.retryCount >= 3) throw new Error('Maximum retry count reached'); return this.repository.createGenerationJob({ ...job, id: `${job.id}_retry_${job.retryCount + 1}`, status: 'awaiting_approval', providerJobId: undefined, retryCount: job.retryCount + 1, errorCode: undefined, errorMessage: undefined, createdAt: new Date(), updatedAt: new Date() }); }
  async history(user: AuthenticatedUser, ids: string[]): Promise<GenerationJob[]> { await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]); return this.repository.listGenerationJobs(ids[0], ids[1], ids[2], ids[3]); }

  private async requireShot(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string): Promise<Shot> { const shots = await this.production.listShots(user, seriesId, episodeId, sceneId); const shot = shots.find((value) => value.id === shotId); if (!shot) throw new Error(`Shot ${shotId} was not found`); return shot; }
  private async requireJob(user: AuthenticatedUser, ids: string[], jobId: string, role: 'OWNER' | 'VIEWER'): Promise<GenerationJob> { if (role === 'OWNER') await this.production.getSeries(user, ids[0]); else await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]); const job = await this.repository.getGenerationJob(ids[0], ids[1], ids[2], ids[3], jobId); if (!job) throw new Error(`Generation job ${jobId} was not found`); return job; }
  private async save(job: GenerationJob, changes: Partial<GenerationJob>): Promise<GenerationJob> { return this.repository.updateGenerationJob({ ...job, ...changes, updatedAt: new Date() }); }
}
