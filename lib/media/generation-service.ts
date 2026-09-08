import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series/service';
import type { GenerationJob, Shot } from '@/types';
import { loadGenerationConfig, type GenerationConfig } from './config';
import { consoleProviderLogger, silentProviderLogger, type ProviderLogger } from './provider-logging';
import { normalizeProviderError, providerError } from './providers/errors';
import { ProviderRegistry } from './providers/registry';
import { ProviderErrorCode, type MediaProvider, type ProviderJobStatus } from './providers/types';

interface GenerationServiceOptions {
  registry?: ProviderRegistry;
  loadConfig?: () => GenerationConfig;
  logger?: ProviderLogger;
  now?: () => Date;
}

export class GenerationService {
  private readonly production: ProductionService;
  private readonly registry: ProviderRegistry;
  private readonly configLoader: () => GenerationConfig;
  private readonly logger: ProviderLogger;
  private readonly now: () => Date;

  constructor(private readonly repository: PersistenceRepository, options: GenerationServiceOptions = {}) {
    this.production = new ProductionService(repository);
    this.registry = options.registry || new ProviderRegistry();
    this.configLoader = options.loadConfig || (() => loadGenerationConfig());
    this.logger = options.logger || (process.env.NODE_ENV === 'test' ? silentProviderLogger : consoleProviderLogger);
    this.now = options.now || (() => new Date());
  }

  async prepare(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string): Promise<GenerationJob> {
    const shot = await this.requireShot(user, seriesId, episodeId, sceneId, shotId);
    const readiness = await this.production.getShotReadiness(user, seriesId, episodeId, sceneId, shotId);
    if (!readiness.ready) throw new Error(`Shot is not generation-ready: ${readiness.blockers.join(' ')}`);
    const active = await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shotId);
    if (active.some((job) => ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status))) throw new Error('An active generation job already exists for this shot');

    const config = this.configLoader();
    const provider = this.registry.resolve(config.videoProvider, config.providers[config.videoProvider]);
    if (!provider.capabilities.videoGeneration) throw new Error(`Configured provider ${provider.id} does not support video generation`);
    const model = config.providers[config.videoProvider].videoModel || provider.capabilities.supportedModels?.[0] || 'default';
    const request = this.requestFor(shot, model);
    const estimatedCost = await provider.estimateCost(request);
    const now = this.now();
    const promptSnapshot = shot.visualPrompt || shot.description;
    const negativePromptSnapshot = shot.negativePrompt;
    const generationParameters = {
      width: request.width,
      height: request.height,
      durationSeconds: request.duration,
      aspectRatio: request.aspectRatio,
      model,
      continuityConstraints: shot.continuityNotes || [],
    };
    const inputHash = createHash('sha256').update(JSON.stringify({ promptSnapshot, negativePromptSnapshot, generationParameters })).digest('hex');

    return this.repository.createGenerationJob({
      id: `generation_${shotId}_${active.length + 1}`,
      seriesId,
      episodeId,
      sceneId,
      shotId,
      provider: provider.id,
      providerModel: model,
      generationType: 'video',
      status: 'awaiting_approval',
      promptVersion: '1.0',
      inputHash,
      promptSnapshot,
      negativePromptSnapshot,
      generationParameters,
      durationSeconds: shot.durationSeconds,
      aspectRatio: '9:16',
      estimatedCost,
      actualCost: 0,
      retryCount: 0,
      outputAssetIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async approve(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'awaiting_approval') throw new Error('Generation job is not awaiting approval');
    return this.save(job, { status: 'approved' });
  }

  async reject(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'awaiting_approval') throw new Error('Generation job is not awaiting approval');
    return this.save(job, { status: 'rejected' });
  }

  async start(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'approved') throw new Error('Human approval is required before generation');
    const started = Date.now();
    try {
      const provider = this.resolveJobProvider(job);
      const providerJob = await provider.generateVideo({
        type: 'video', prompt: job.promptSnapshot, negativePrompt: job.negativePromptSnapshot,
        duration: job.durationSeconds, aspectRatio: job.aspectRatio,
        width: Number(job.generationParameters?.width || 720), height: Number(job.generationParameters?.height || 1280), model: job.providerModel,
        continuityConstraints: Array.isArray(job.generationParameters?.continuityConstraints) ? job.generationParameters.continuityConstraints as string[] : [],
      });
      const submittedAt = providerJob.submittedAt || this.now();
      this.logger.write({ operation: 'submit', provider: job.provider, model: providerJob.model, generationJobId: job.id, providerJobId: providerJob.jobId, status: providerJob.status, durationMs: Date.now() - started });
      const submitted = await this.save(job, {
        status: providerJob.status === 'succeeded' ? 'processing' : providerJob.status,
        providerJobId: providerJob.jobId,
        providerModel: providerJob.model,
        startedAt: submittedAt,
        submittedAt,
        lastProviderStatus: providerJob.status,
        providerMetadata: providerJob.lifecycleMetadata,
      });
      if (providerJob.status === 'succeeded') {
        return this.complete(submitted, { jobId: providerJob.jobId, status: 'succeeded', output: providerJob.output, actualCost: providerJob.actualCost, lastUpdated: this.now(), lifecycleMetadata: providerJob.lifecycleMetadata });
      }
      return submitted;
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.logger.write({ operation: 'submit', provider: job.provider, model: job.providerModel, generationJobId: job.id, status: 'failed', durationMs: Date.now() - started, error: normalized });
      return this.save(job, { status: 'failed', errorMessage: normalized.message, errorCode: normalized.code, retryable: normalized.retryable, lastProviderError: `${normalized.code}: ${normalized.message}`, failedAt: this.now(), lastProviderStatus: 'failed' });
    }
  }

  async refresh(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'VIEWER');
    if (['completed', 'failed', 'cancelled', 'rejected'].includes(job.status)) return job;
    if (!job.providerJobId) return job;
    const started = Date.now();
    try {
      const status = await this.resolveJobProvider(job).getStatus(job.providerJobId);
      this.logger.write({ operation: 'poll', provider: job.provider, model: job.providerModel, generationJobId: job.id, providerJobId: job.providerJobId, status: status.status, durationMs: Date.now() - started, error: status.error });
      if (status.status === 'succeeded') return this.complete(job, status);
      const now = this.now();
      if (status.status === 'failed' || status.status === 'cancelled') {
        const error = status.error || { code: status.status === 'cancelled' ? ProviderErrorCode.Cancelled : ProviderErrorCode.UnknownError, message: status.status === 'cancelled' ? 'Provider operation was cancelled' : 'Provider operation failed', retryable: false, timestamp: now };
        return this.save(job, { status: status.status === 'failed' ? 'failed' : 'cancelled', errorMessage: error.message, errorCode: error.code, retryable: error.retryable, lastProviderError: `${error.code}: ${error.message}`, lastPolledAt: now, lastProviderStatus: status.status, failedAt: status.status === 'failed' ? now : undefined, cancelledAt: status.status === 'cancelled' ? now : undefined });
      }
      return this.save(job, { status: status.status, lastPolledAt: now, lastProviderStatus: status.status, lastProviderError: undefined });
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.logger.write({ operation: 'poll', provider: job.provider, model: job.providerModel, generationJobId: job.id, providerJobId: job.providerJobId, status: 'polling_error', durationMs: Date.now() - started, error: normalized });
      return this.save(job, { lastPolledAt: this.now(), lastProviderStatus: 'polling_error', lastProviderError: `${normalized.code}: ${normalized.message}`, errorCode: normalized.code, errorMessage: normalized.message, retryable: normalized.retryable });
    }
  }

  async cancel(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (['completed', 'failed', 'cancelled', 'rejected'].includes(job.status)) return job;
    if (!job.providerJobId) return this.save(job, { status: 'cancelled', cancelledAt: this.now(), lastProviderStatus: 'cancelled' });
    const provider = this.resolveJobProvider(job);
    if (!provider.capabilities.cancellation) {
      const error = normalizeProviderError(providerError(ProviderErrorCode.UnsupportedCapability, `${provider.id} does not support cancellation`));
      return this.save(job, { errorCode: error.code, errorMessage: error.message, retryable: false, lastProviderError: `${error.code}: ${error.message}` });
    }
    const started = Date.now();
    try {
      const status = await provider.cancelJob(job.providerJobId);
      this.logger.write({ operation: 'cancel', provider: job.provider, model: job.providerModel, generationJobId: job.id, providerJobId: job.providerJobId, status: status.status, durationMs: Date.now() - started });
      return this.save(job, { status: status.status === 'cancelled' ? 'cancelled' : job.status, cancelledAt: status.status === 'cancelled' ? this.now() : undefined, lastProviderStatus: status.status });
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.logger.write({ operation: 'cancel', provider: job.provider, model: job.providerModel, generationJobId: job.id, providerJobId: job.providerJobId, durationMs: Date.now() - started, error: normalized });
      return this.save(job, { errorCode: normalized.code, errorMessage: normalized.message, retryable: normalized.retryable, lastProviderError: `${normalized.code}: ${normalized.message}` });
    }
  }

  async retry(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (!['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled jobs can be retried');
    if (job.retryCount >= 3) throw new Error('Maximum retry count reached');
    const now = this.now();
    return this.repository.createGenerationJob({ ...job, id: `${job.id}_retry_${job.retryCount + 1}`, status: 'awaiting_approval', providerJobId: undefined, retryCount: job.retryCount + 1, errorCode: undefined, errorMessage: undefined, retryable: undefined, lastProviderError: undefined, lastProviderStatus: undefined, providerMetadata: undefined, completionMetadata: undefined, outputAssetIds: [], actualCost: 0, startedAt: undefined, submittedAt: undefined, completedAt: undefined, failedAt: undefined, cancelledAt: undefined, createdAt: now, updatedAt: now });
  }

  async history(user: AuthenticatedUser, ids: string[]): Promise<GenerationJob[]> {
    await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]);
    return this.repository.listGenerationJobs(ids[0], ids[1], ids[2], ids[3]);
  }

  private resolveJobProvider(job: GenerationJob): MediaProvider {
    const config = this.configLoader();
    const providerConfig = config.providers[job.provider as keyof typeof config.providers];
    if (!providerConfig) throw new Error(`Provider ${job.provider} is not configured`);
    return this.registry.resolve(job.provider, providerConfig);
  }

  private async complete(job: GenerationJob, status: ProviderJobStatus): Promise<GenerationJob> {
    const now = this.now();
    if (!status.output) {
      const error = { code: ProviderErrorCode.ProviderUnavailable, message: 'Provider completed without normalized output metadata', retryable: true };
      return this.save(job, { status: 'failed', errorCode: error.code, errorMessage: error.message, retryable: error.retryable, lastProviderError: `${error.code}: ${error.message}`, failedAt: now, lastPolledAt: now, lastProviderStatus: 'failed' });
    }
    const existing = await this.repository.listGeneratedAssets(job.seriesId, job.episodeId, job.sceneId, job.shotId);
    const prior = existing.find((asset) => asset.generationJobId === job.id);
    const version = existing.reduce((maximum, asset) => Math.max(maximum, asset.version), 0) + 1;
    const latest = [...existing].sort((a, b) => b.version - a.version)[0];
    const portrait = job.aspectRatio === '9:16';
    const asset = prior || await this.repository.createGeneratedAsset({
      id: `asset_${job.id}`,
      generationJobId: job.id,
      seriesId: job.seriesId,
      episodeId: job.episodeId,
      sceneId: job.sceneId,
      shotId: job.shotId,
      assetType: job.generationType === 'image' ? 'generated-image' : 'video-clip',
      uri: status.output.uri,
      storageUri: status.output.storageUri,
      mimeType: status.output.mimeType,
      width: status.output.width || (portrait ? 720 : 1280),
      height: status.output.height || (portrait ? 1280 : 720),
      durationSeconds: status.output.durationSeconds || job.durationSeconds,
      fileSize: status.output.fileSize,
      provider: job.provider,
      providerJobId: job.providerJobId,
      providerModel: job.providerModel,
      fingerprint: job.inputHash,
      checksum: status.output.checksum,
      version,
      parentAssetId: latest?.id,
      preferred: false,
      reviewStatus: 'pending',
      generationParameters: job.generationParameters,
      promptSnapshot: job.promptSnapshot,
      negativePromptSnapshot: job.negativePromptSnapshot,
      costMetadata: { estimatedCost: job.estimatedCost, actualCost: status.actualCost ?? job.actualCost, currency: 'USD' },
      createdAt: now,
      updatedAt: now,
    });
    this.logger.write({ operation: 'complete', provider: job.provider, model: job.providerModel, generationJobId: job.id, providerJobId: job.providerJobId, status: 'succeeded' });
    return this.save(job, { status: 'completed', actualCost: status.actualCost ?? job.actualCost, outputAssetIds: [asset.id], lastPolledAt: now, lastProviderStatus: 'succeeded', lastProviderError: undefined, errorCode: undefined, errorMessage: undefined, retryable: undefined, completedAt: now, completionMetadata: { ...status.lifecycleMetadata, outputMimeType: status.output.mimeType, outputStorageUri: status.output.storageUri, checksum: status.output.checksum } });
  }

  private requestFor(shot: Shot, model: string) {
    return { type: 'video' as const, prompt: shot.visualPrompt || shot.description, negativePrompt: shot.negativePrompt, duration: shot.durationSeconds, aspectRatio: '9:16' as const, width: 720, height: 1280, model, continuityConstraints: shot.continuityNotes || [] };
  }

  private async requireShot(user: AuthenticatedUser, seriesId: string, episodeId: string, sceneId: string, shotId: string): Promise<Shot> {
    const shot = (await this.production.listShots(user, seriesId, episodeId, sceneId)).find((value) => value.id === shotId);
    if (!shot) throw new Error(`Shot ${shotId} was not found`);
    return shot;
  }

  private async requireJob(user: AuthenticatedUser, ids: string[], jobId: string, role: 'OWNER' | 'VIEWER'): Promise<GenerationJob> {
    await this.production.authorizeMediaOperation(user, ids[0], role);
    const job = await this.repository.getGenerationJob(ids[0], ids[1], ids[2], ids[3], jobId);
    if (!job) throw new Error(`Generation job ${jobId} was not found`);
    return job;
  }

  private async save(job: GenerationJob, changes: Partial<GenerationJob>): Promise<GenerationJob> {
    return this.repository.updateGenerationJob({ ...job, ...changes, updatedAt: this.now() });
  }
}
