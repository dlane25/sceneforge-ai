import 'server-only';

import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { CaptionExportMode, EpisodeAssembly, EpisodeExportJob, ExportJobStatus } from '@/types';
import { EpisodeAssemblyService } from '@/lib/assembly/service';
import { loadExportConfig, type ExportConfig } from './config';
import type { ExportEngineResult, ExportRenderRequest } from './engine-types';
import { normalizeExportError } from './errors';
import { consoleExportLogger, silentExportLogger, type ExportLogger } from './logging';
import { getExportPreset } from './presets';
import { ExportEngineRegistry } from './registry';

interface EpisodeExportServiceOptions { registry?: ExportEngineRegistry; loadConfig?: () => ExportConfig; logger?: ExportLogger; now?: () => Date }

export class EpisodeExportService {
  private readonly production: ProductionService;
  private readonly assemblies: EpisodeAssemblyService;
  private readonly registry: ExportEngineRegistry;
  private readonly configLoader: () => ExportConfig;
  private readonly logger: ExportLogger;
  private readonly now: () => Date;
  constructor(private readonly repository: PersistenceRepository, options: EpisodeExportServiceOptions = {}) {
    this.production = new ProductionService(repository); this.assemblies = new EpisodeAssemblyService(repository);
    this.registry = options.registry || new ExportEngineRegistry(); this.configLoader = options.loadConfig || (() => loadExportConfig());
    this.logger = options.logger || (process.env.NODE_ENV === 'test' ? silentExportLogger : consoleExportLogger); this.now = options.now || (() => new Date());
  }

  async list(user: AuthenticatedUser, seriesId: string, episodeId: string): Promise<EpisodeExportJob[]> { await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); return this.repository.listEpisodeExportJobs(seriesId, episodeId); }
  async get(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> { await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); return this.requireJob(seriesId, episodeId, jobId); }

  async create(user: AuthenticatedUser, seriesId: string, episodeId: string, assemblyId: string, captionMode: CaptionExportMode): Promise<EpisodeExportJob> {
    await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); const assembly = await this.assemblies.validate(user, seriesId, episodeId, assemblyId);
    if (assembly.status !== 'approved' || assembly.reviewState !== 'approved' || !assembly.validationPassed) throw new Error('An approved, valid assembly is required before preparing an export');
    const caption = assembly.captionTrackId ? await this.repository.getCaptionTrack(seriesId, episodeId, assembly.captionTrackId) : undefined;
    if (captionMode !== 'none' && (!assembly.captionIncluded || !caption || caption.reviewStatus !== 'approved')) throw new Error('Selected caption mode requires the assembly approved caption track');
    if (captionMode === 'sidecar-srt' && caption?.format !== 'srt') throw new Error('SRT sidecar mode requires an approved SRT caption track');
    if (captionMode === 'sidecar-vtt' && caption?.format !== 'vtt') throw new Error('WebVTT sidecar mode requires an approved WebVTT caption track');
    const config = this.configLoader(); const preset = getExportPreset(assembly.exportPreset); const history = await this.repository.listEpisodeExportJobs(seriesId, episodeId); const exportVersion = history.reduce((maximum, job) => Math.max(maximum, job.exportVersion), 0) + 1; const now = this.now();
    return this.repository.createEpisodeExportJob({
      id: `export_${episodeId}_v${exportVersion}`, seriesId, episodeId, assemblyId, assemblyVersion: assembly.version, exportVersion,
      preset: preset.id, outputFormat: preset.outputFormat, aspectRatio: preset.aspectRatio, width: preset.width, height: preset.height, frameRate: preset.frameRate,
      videoCodec: preset.videoCodec, audioCodec: preset.audioCodec, captionMode, captionTrackId: captionMode === 'none' ? undefined : caption?.id,
      engine: config.engine, status: 'awaiting_approval', progress: 0, approvalState: 'pending', requestedBy: user.id,
      explanation: `Prepared from approved assembly version ${assembly.version} using preset ${preset.id}.`, retryCount: 0, requestedAt: now, createdAt: now, updatedAt: now,
    });
  }

  async approve(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string, notes?: string): Promise<EpisodeExportJob> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const job = await this.requireJob(seriesId, episodeId, jobId); if (job.status !== 'awaiting_approval') throw new Error('Export job is not awaiting approval'); const now = this.now(); return this.save(job, { status: 'approved', approvalState: 'approved', approvedBy: user.id, approvalNotes: notes, approvedAt: now }); }
  async reject(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string, notes: string): Promise<EpisodeExportJob> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const job = await this.requireJob(seriesId, episodeId, jobId); if (job.status !== 'awaiting_approval') throw new Error('Export job is not awaiting approval'); return this.save(job, { status: 'rejected', approvalState: 'rejected', approvalNotes: notes, rejectedAt: this.now() }); }

  async start(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> {
    await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const job = await this.requireJob(seriesId, episodeId, jobId);
    if (job.status !== 'approved' || job.approvalState !== 'approved') throw new Error('Human approval is required before export execution');
    const started = Date.now();
    try {
      const assembly = await this.assemblies.validate(user, seriesId, episodeId, job.assemblyId);
      if (assembly.status !== 'approved' || !assembly.validationPassed) throw new Error('Assembly approval or validation is no longer valid');
      const config = this.configLoader(); if (config.engine !== job.engine) throw new Error('Configured export engine changed after approval; prepare a new export job');
      const engine = this.registry.resolve(config); const request = await this.renderRequest(assembly, job); const result = await engine.render(request);
      this.logger.write({ operation: 'submit', seriesId, episodeId, assemblyId: assembly.id, assemblyVersion: assembly.version, exportJobId: job.id, engine: job.engine, preset: job.preset, status: this.jobStatus(result.status), durationMs: Date.now() - started, errorCode: result.error?.code });
      const submitted = await this.save(job, { engineJobId: result.jobId, status: this.jobStatus(result.status), progress: result.progress, startedAt: this.now(), engineMetadata: result.metadata, errorCode: result.error?.code, errorMessage: result.error?.message, retryable: result.error?.retryable, failedAt: result.status === 'failed' ? this.now() : undefined });
      return result.status === 'succeeded' ? this.complete(submitted, result) : submitted;
    } catch (cause) {
      const error = normalizeExportError(cause); this.logger.write({ operation: 'submit', seriesId, episodeId, assemblyId: job.assemblyId, assemblyVersion: job.assemblyVersion, exportJobId: job.id, engine: job.engine, preset: job.preset, status: 'failed', durationMs: Date.now() - started, errorCode: error.code });
      return this.save(job, { status: 'failed', errorCode: error.code, errorMessage: error.message, retryable: error.retryable, failedAt: this.now() });
    }
  }

  async refresh(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> {
    await this.requireEpisode(user, seriesId, episodeId, 'VIEWER'); const job = await this.requireJob(seriesId, episodeId, jobId); if (!job.engineJobId || ['completed', 'failed', 'cancelled', 'rejected'].includes(job.status)) return job;
    const started = Date.now(); try { const result = await this.resolveJobEngine(job).getStatus(job.engineJobId); this.logger.write({ operation: 'refresh', seriesId, episodeId, assemblyId: job.assemblyId, assemblyVersion: job.assemblyVersion, exportJobId: job.id, engine: job.engine, preset: job.preset, status: this.jobStatus(result.status), durationMs: Date.now() - started, errorCode: result.error?.code }); if (result.status === 'succeeded') return this.complete(job, result); return this.save(job, { status: this.jobStatus(result.status), progress: result.progress, engineMetadata: result.metadata, errorCode: result.error?.code, errorMessage: result.error?.message, retryable: result.error?.retryable, failedAt: result.status === 'failed' ? this.now() : undefined, cancelledAt: result.status === 'cancelled' ? this.now() : undefined }); } catch (cause) { const error = normalizeExportError(cause); return this.save(job, { errorCode: error.code, errorMessage: error.message, retryable: error.retryable }); }
  }

  async cancel(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> {
    await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const job = await this.requireJob(seriesId, episodeId, jobId); if (['completed', 'failed', 'cancelled', 'rejected'].includes(job.status)) return job;
    if (!job.engineJobId) return this.save(job, { status: 'cancelled', cancelledAt: this.now(), errorCode: 'cancelled', errorMessage: 'Export was cancelled before engine submission', retryable: false });
    const engine = this.resolveJobEngine(job); if (!engine.capabilities.cancellation) return this.save(job, { errorCode: 'unsupported', errorMessage: 'Configured export engine does not support cancellation', retryable: false });
    const result = await engine.cancel(job.engineJobId); this.logger.write({ operation: 'cancel', seriesId, episodeId, assemblyId: job.assemblyId, assemblyVersion: job.assemblyVersion, exportJobId: job.id, engine: job.engine, preset: job.preset, status: this.jobStatus(result.status), errorCode: result.error?.code }); return this.save(job, { status: this.jobStatus(result.status), progress: result.progress, cancelledAt: result.status === 'cancelled' ? this.now() : undefined, errorCode: result.error?.code, errorMessage: result.error?.message, retryable: result.error?.retryable });
  }

  async retry(user: AuthenticatedUser, seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> { await this.requireEpisode(user, seriesId, episodeId, 'OWNER'); const job = await this.requireJob(seriesId, episodeId, jobId); if (!['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled exports can be retried'); if (job.retryCount >= 3) throw new Error('Maximum export retry count reached'); const history = await this.repository.listEpisodeExportJobs(seriesId, episodeId); const exportVersion = history.reduce((maximum, value) => Math.max(maximum, value.exportVersion), 0) + 1; const now = this.now(); return this.repository.createEpisodeExportJob({ ...job, id: `export_${episodeId}_v${exportVersion}`, exportVersion, engineJobId: undefined, status: 'awaiting_approval', progress: 0, approvalState: 'pending', approvedBy: undefined, approvalNotes: undefined, outputUri: undefined, sidecarUri: undefined, outputFileName: undefined, fileSize: undefined, durationMs: undefined, checksum: undefined, engineMetadata: undefined, errorCode: undefined, errorMessage: undefined, retryable: undefined, retryCount: job.retryCount + 1, requestedBy: user.id, explanation: `Retry ${job.retryCount + 1} of export version ${job.exportVersion}.`, requestedAt: now, approvedAt: undefined, rejectedAt: undefined, startedAt: undefined, completedAt: undefined, failedAt: undefined, cancelledAt: undefined, createdAt: now, updatedAt: now }); }

  private async renderRequest(assembly: EpisodeAssembly, job: EpisodeExportJob): Promise<ExportRenderRequest> {
    const clips = [];
    for (const item of assembly.items) {
      if (!item.videoAssetId) throw new Error('Validated assembly is missing a video source');
      const video = await this.repository.getGeneratedAsset(job.seriesId, job.episodeId, item.sceneId, item.shotId, item.videoAssetId); if (!video) throw new Error('Validated video source is missing');
      const audio = item.audioAssetId ? await this.repository.getGeneratedAsset(job.seriesId, job.episodeId, item.sceneId, item.shotId, item.audioAssetId) : undefined;
      clips.push({ sequence: item.sequence, videoUri: video.storageUri || video.uri, audioUri: audio ? audio.storageUri || audio.uri : undefined, startMs: item.startMs, durationMs: item.endMs - item.startMs, trimInMs: item.trimInMs, trimOutMs: item.trimOutMs, volume: item.volume, muted: item.muted });
    }
    const caption = job.captionTrackId ? await this.repository.getCaptionTrack(job.seriesId, job.episodeId, job.captionTrackId) : undefined;
    return { exportJobId: job.id, preset: getExportPreset(job.preset), clips, durationMs: assembly.timelineDurationMs, captionMode: job.captionMode, captionFormat: caption?.format, captionContent: caption?.content };
  }
  private resolveJobEngine(job: EpisodeExportJob) { const config = this.configLoader(); if (config.engine !== job.engine) throw new Error('Configured export engine does not match this export job'); return this.registry.resolve(config); }
  private jobStatus(status: ExportEngineResult['status']): ExportJobStatus { return status === 'succeeded' ? 'completed' : status; }
  private async complete(job: EpisodeExportJob, result: ExportEngineResult): Promise<EpisodeExportJob> { if (!result.output) return this.save(job, { status: 'failed', errorCode: 'processing_failed', errorMessage: 'Export engine completed without output metadata', retryable: true, failedAt: this.now() }); const now = this.now(); const value = await this.save(job, { status: 'completed', progress: 100, outputUri: result.output.uri, sidecarUri: result.output.sidecarUri, outputFileName: result.output.fileName, fileSize: result.output.fileSize, durationMs: result.output.durationMs, checksum: result.output.checksum, engineMetadata: { ...job.engineMetadata, ...result.metadata, ...result.output.metadata }, errorCode: undefined, errorMessage: undefined, retryable: undefined, completedAt: now }); this.logger.write({ operation: 'complete', seriesId: job.seriesId, episodeId: job.episodeId, assemblyId: job.assemblyId, assemblyVersion: job.assemblyVersion, exportJobId: job.id, engine: job.engine, preset: job.preset, status: 'completed' }); return value; }
  private async save(job: EpisodeExportJob, changes: Partial<EpisodeExportJob>) { return this.repository.updateEpisodeExportJob({ ...job, ...changes, updatedAt: this.now() }); }
  private async requireEpisode(user: AuthenticatedUser, seriesId: string, episodeId: string, role: 'OWNER' | 'VIEWER'): Promise<void> { await this.production.authorizeMediaOperation(user, seriesId, role); if (!(await this.repository.getEpisode(seriesId, episodeId))) throw new Error(`Episode ${episodeId} was not found`); }
  private async requireJob(seriesId: string, episodeId: string, jobId: string): Promise<EpisodeExportJob> { const value = await this.repository.getEpisodeExportJob(seriesId, episodeId, jobId); if (!value) throw new Error(`Episode export job ${jobId} was not found`); return value; }
}
