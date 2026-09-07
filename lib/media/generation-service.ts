/**
 * Generation Service (Milestone 7)
 * Updated for Milestone 9: Provider Registry Integration
 *
 * Lifecycle:
 * prepare -> awaiting_approval -> approved -> queued/processing -> completed/failed/cancelled -> GeneratedAsset
 */

import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import type { GeneratedAsset, GenerationJob, Shot } from '@/types';
import { ProductionService } from '@/lib/series/service';
import { ProviderRegistry } from '@/lib/media/providers/registry';
import { loadMediaProviderConfig } from '@/lib/media/config';
import type { NormalizedProviderError } from '@/lib/media/providers/types';
import { ProviderErrorCode } from '@/lib/media/providers/types';

export class GenerationService {
  private readonly production: ProductionService;
  private readonly registry: ProviderRegistry;

  constructor(private readonly repository: PersistenceRepository) {
    this.production = new ProductionService(repository);
    this.registry = new ProviderRegistry();
  }

  async prepare(
    user: AuthenticatedUser,
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string
  ): Promise<GenerationJob> {
    const shot = await this.requireShot(user, seriesId, episodeId, sceneId, shotId);
    const readiness = await this.production.getShotReadiness(user, seriesId, episodeId, sceneId, shotId);

    if (!readiness.ready) {
      throw new Error(`Shot is not generation-ready: ${readiness.blockers.join(' ')}`);
    }

    const active = await this.repository.listGenerationJobs(seriesId, episodeId, sceneId, shotId);
    if (
      active.some((job) =>
        ['awaiting_approval', 'approved', 'queued', 'processing'].includes(job.status)
      )
    ) {
      throw new Error('An active generation job already exists for this shot');
    }

    // Resolve provider and estimate cost
    let providerId = 'mock';
    try {
      const config = loadMediaProviderConfig();
      providerId = config.providerId;
      const provider = this.registry.resolve(providerId, config.config);

      const estimatedCost = await provider.estimateCost({
        type: 'video',
        prompt: shot.visualPrompt || shot.description,
        negativePrompt: shot.negativePrompt,
        duration: shot.durationSeconds,
        width: 1280,
        height: 720,
      });

      const now = new Date();
      return this.repository.createGenerationJob({
        id: `generation_${shotId}_${active.length + 1}`,
        seriesId,
        episodeId,
        sceneId,
        shotId,
        provider: providerId,
        providerModel: provider.capabilities.supportedModels?.[0] || 'default',
        generationType: 'video',
        status: 'awaiting_approval',
        promptVersion: '1.0',
        inputHash: Buffer.from(
          JSON.stringify({
            prompt: shot.visualPrompt || shot.description,
            negative: shot.negativePrompt,
            duration: shot.durationSeconds,
          })
        ).toString('base64').substring(0, 32),
        promptSnapshot: shot.visualPrompt || shot.description,
        negativePromptSnapshot: shot.negativePrompt,
        durationSeconds: shot.durationSeconds,
        aspectRatio: '9:16',
        estimatedCost,
        actualCost: 0,
        retryCount: 0,
        outputAssetIds: [],
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      // If config loading fails, fall back to mock
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      // Fall through - will create job with mock provider
      const now = new Date();
      return this.repository.createGenerationJob({
        id: `generation_${shotId}_${active.length + 1}`,
        seriesId,
        episodeId,
        sceneId,
        shotId,
        provider: 'mock',
        providerModel: 'mock-v1',
        generationType: 'video',
        status: 'awaiting_approval',
        promptVersion: '1.0',
        inputHash: Buffer.from(
          JSON.stringify({
            prompt: shot.visualPrompt || shot.description,
            negative: shot.negativePrompt,
            duration: shot.durationSeconds,
          })
        ).toString('base64').substring(0, 32),
        promptSnapshot: shot.visualPrompt || shot.description,
        negativePromptSnapshot: shot.negativePrompt,
        durationSeconds: shot.durationSeconds,
        aspectRatio: '9:16',
        estimatedCost: 100,
        actualCost: 0,
        retryCount: 0,
        outputAssetIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async approve(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'awaiting_approval') {
      throw new Error('Generation job is not awaiting approval');
    }
    return this.save(job, { status: 'approved' });
  }

  async reject(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'awaiting_approval') {
      throw new Error('Generation job is not awaiting approval');
    }
    return this.save(job, { status: 'rejected' });
  }

  async start(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'approved') {
      throw new Error('Human approval is required before generation');
    }

    try {
      const config = loadMediaProviderConfig();
      const provider = this.registry.resolve(job.provider, config.config);

      const providerJob = await provider.generateVideo({
        type: 'video',
        prompt: job.promptSnapshot,
        negativePrompt: job.negativePromptSnapshot,
        duration: job.durationSeconds,
        width: 1280,
        height: 720,
        model: job.providerModel,
      });

      return this.save(job, {
        status: 'queued',
        providerJobId: providerJob.jobId,
        startedAt: new Date(),
      });
    } catch (error) {
      const normalizedError = this.normalizeProviderError(error);
      return this.save(job, {
        status: 'failed',
        errorMessage: normalizedError.message,
        errorCode: normalizedError.code,
        retryable: normalizedError.retryable,
        failedAt: new Date(),
      });
    }
  }

  async refresh(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'VIEWER');

    if (!job.providerJobId) {
      return job;
    }

    try {
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return job;
      }

      const config = loadMediaProviderConfig();
      const provider = this.registry.resolve(job.provider, config.config);
      const providerStatus = await provider.getStatus(job.providerJobId);

      const now = new Date();

      if (providerStatus.status === 'succeeded') {
        const existingAsset = await this.repository.listGeneratedAssets(
          job.seriesId,
          job.episodeId,
          job.sceneId,
          job.shotId
        );

        const alreadyExistsForJob = existingAsset.some(
          (asset) => asset.generationJobId === job.id && asset.reviewStatus !== 'rejected'
        );

        if (!alreadyExistsForJob) {
          const asset: GeneratedAsset = {
            id: `asset_${job.id}_${Date.now()}`,
            generationJobId: job.id,
            seriesId: job.seriesId,
            episodeId: job.episodeId,
            sceneId: job.sceneId,
            shotId: job.shotId,
            assetType: 'video-clip',
            uri: providerStatus.outputUrl || `provider://${job.provider}/${job.providerJobId}`,
            mimeType: 'video/mp4',
            width: 1280,
            height: 720,
            durationSeconds: job.durationSeconds,
            provider: job.provider,
            providerJobId: job.providerJobId,
            providerModel: job.providerModel,
            fingerprint: job.inputHash,
            version: 1,
            reviewStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          await this.repository.createGeneratedAsset(asset);
        }

        return this.save(job, {
          status: 'completed',
          actualCost: providerStatus.actualCost || job.estimatedCost,
          lastPolledAt: now,
          lastProviderStatus: 'succeeded',
          completedAt: now,
        });
      }

      if (providerStatus.status === 'failed' || providerStatus.status === 'cancelled') {
        const error = providerStatus.error;
        return this.save(job, {
          status: providerStatus.status === 'failed' ? 'failed' : 'cancelled',
          errorMessage: error?.message || 'Provider operation failed',
          errorCode: error?.code || ProviderErrorCode.UnknownError,
          retryable: error?.retryable,
          lastPolledAt: now,
          lastProviderStatus: providerStatus.status,
          failedAt: now,
        });
      }

      return this.save(job, {
        status: 'processing',
        lastPolledAt: now,
        lastProviderStatus: 'processing',
      });
    } catch (error) {
      return this.save(job, {
        lastPolledAt: new Date(),
        lastProviderStatus: 'polling_error',
      });
    }
  }

  async cancel(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');

    if (!job.providerJobId) {
      return this.save(job, {
        status: 'cancelled',
        cancelledAt: new Date(),
      });
    }

    try {
      const config = loadMediaProviderConfig();
      const provider = this.registry.resolve(job.provider, config.config);
      await provider.cancelJob(job.providerJobId);

      return this.save(job, {
        status: 'cancelled',
        cancelledAt: new Date(),
        lastProviderStatus: 'cancelled',
      });
    } catch (error) {
      return this.save(job, {
        status: 'cancelled',
        cancelledAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Cancellation failed',
      });
    }
  }

  async retry(user: AuthenticatedUser, ids: string[], jobId: string): Promise<GenerationJob> {
    const job = await this.requireJob(user, ids, jobId, 'OWNER');
    if (job.status !== 'failed' && job.status !== 'cancelled') {
      throw new Error('Only failed or cancelled jobs can be retried');
    }
    if (job.retryCount >= 3) {
      throw new Error('Maximum retry count reached');
    }

    return this.repository.createGenerationJob({
      ...job,
      id: `${job.id}_retry_${job.retryCount + 1}`,
      status: 'awaiting_approval',
      providerJobId: undefined,
      retryCount: job.retryCount + 1,
      errorCode: undefined,
      errorMessage: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async history(user: AuthenticatedUser, ids: string[]): Promise<GenerationJob[]> {
    await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]);
    return this.repository.listGenerationJobs(ids[0], ids[1], ids[2], ids[3]);
  }

  private async requireShot(
    user: AuthenticatedUser,
    seriesId: string,
    episodeId: string,
    sceneId: string,
    shotId: string
  ): Promise<Shot> {
    const shots = await this.production.listShots(user, seriesId, episodeId, sceneId);
    const shot = shots.find((value) => value.id === shotId);
    if (!shot) throw new Error(`Shot ${shotId} was not found`);
    return shot;
  }

  private async requireJob(
    user: AuthenticatedUser,
    ids: string[],
    jobId: string,
    role: 'OWNER' | 'VIEWER'
  ): Promise<GenerationJob> {
    if (role === 'OWNER') {
      await this.production.getSeries(user, ids[0]);
    } else {
      await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]);
    }
    const job = await this.repository.getGenerationJob(ids[0], ids[1], ids[2], ids[3], jobId);
    if (!job) throw new Error(`Generation job ${jobId} was not found`);
    return job;
  }

  private async save(job: GenerationJob, changes: Partial<GenerationJob>): Promise<GenerationJob> {
    return this.repository.updateGenerationJob({
      ...job,
      ...changes,
      updatedAt: new Date(),
    });
  }

  private normalizeProviderError(error: unknown): NormalizedProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('network') || message.includes('timeout')) {
        return {
          code: ProviderErrorCode.ProviderTimeout,
          message: 'Provider network timeout',
          retryable: true,
          timestamp: new Date(),
        };
      }

      if (message.includes('unauthorized') || message.includes('auth')) {
        return {
          code: ProviderErrorCode.AuthenticationError,
          message: 'Provider authentication failed',
          retryable: false,
          timestamp: new Date(),
        };
      }

      if (message.includes('quota') || message.includes('rate')) {
        return {
          code: ProviderErrorCode.RateLimited,
          message: 'Provider quota/rate limit exceeded',
          retryable: true,
          timestamp: new Date(),
        };
      }

      return {
        code: ProviderErrorCode.UnknownError,
        message: error.message,
        retryable: true,
        timestamp: new Date(),
      };
    }

    return {
      code: ProviderErrorCode.UnknownError,
      message: 'Unknown provider error',
      retryable: true,
      timestamp: new Date(),
    };
  }
}
