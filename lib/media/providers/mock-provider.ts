/**
 * Mock Media Provider
 * Deterministic mock implementation for testing and development
 */

import type {
  MediaProvider,
  ProviderCapabilities,
  ProviderGenerationRequest,
  ProviderJobMetadata,
  ProviderJobStatus,
  ProviderOutput,
  NormalizedProviderError,
} from './types';
import { ProviderErrorCode } from './types';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class MockMediaProvider implements MediaProvider {
  readonly id = 'mock';
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: true,
    videoGeneration: true,
    videoExtension: true,
    imageToVideo: true,
    synchronous: false,
    asyncWithPolling: true,
    cancellation: true,
    costEstimation: true,
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportedDurations: { min: 1, max: 300 },
    supportedResolutions: { min: 720, max: 4096 },
    supportedModels: ['mock-v1'],
  };

  private jobs: Map<string, { metadata: ProviderJobMetadata; status: ProviderJobStatus }> = new Map();

  async generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('image', request);
  }

  async generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('video', request);
  }

  async extendVideo(_jobId: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('video-extend', request);
  }

  async imageToVideo(_imageUri: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('i2v', request);
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: 'failed',
        error: {
          code: ProviderErrorCode.UnknownError,
          message: 'Job not found',
          retryable: false,
          timestamp: new Date(),
        },
        lastUpdated: new Date(),
      };
    }

    const status = job.status;

    // Simulate deterministic progress
    if (status.status === 'queued' || status.status === 'processing') {
      const hash = simpleHash(jobId);
      const progressIncrement = (hash % 30) + 10;
      const newProgress = (status.progress || 0) + progressIncrement;

      if (newProgress >= 100) {
        status.status = 'succeeded';
        status.progress = 100;
        status.outputUrl = this.generateMockOutputUrl(jobId);
        job.metadata.actualCost = job.metadata.estimatedCost;
      } else {
        status.status = 'processing';
        status.progress = newProgress;
      }
      status.lastUpdated = new Date();
    }

    return status;
  }

  async cancelJob(jobId: string): Promise<ProviderJobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: 'failed',
        error: {
          code: ProviderErrorCode.UnknownError,
          message: 'Job not found',
          retryable: false,
          timestamp: new Date(),
        },
        lastUpdated: new Date(),
      };
    }

    job.status.status = 'cancelled';
    job.status.lastUpdated = new Date();
    return job.status;
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    const baseCost = 100;
    const duration = request.duration || 5;
    const durationMultiplier = duration / 60;
    const styleMultiplier = request.style ? 1.2 : 1.0;
    return Math.round(baseCost * durationMultiplier * styleMultiplier);
  }

  private async createJob(
    type: string,
    request: ProviderGenerationRequest
  ): Promise<ProviderJobMetadata> {
    const jobId = this.generateJobId(type, request.prompt || '');
    const estimatedCost = await this.estimateCost(request);

    const metadata: ProviderJobMetadata = {
      jobId,
      provider: this.id,
      model: request.model || 'mock-v1',
      status: 'queued',
      estimatedCost,
      createdAt: new Date(),
    };

    const status: ProviderJobStatus = {
      jobId,
      status: 'queued',
      progress: 0,
      lastUpdated: new Date(),
    };

    this.jobs.set(jobId, { metadata, status });

    // Simulate potential failure
    const hash = simpleHash(request.prompt || '');
    const successRate = 0.95;
    if ((hash % 100) / 100 >= successRate) {
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job && job.status.status !== 'succeeded') {
          job.status.status = 'failed';
          job.status.error = {
            code: ProviderErrorCode.UnknownError,
            message: 'Mock provider simulated failure',
            retryable: true,
            timestamp: new Date(),
          };
          job.status.lastUpdated = new Date();
        }
      }, 1000);
    }

    return metadata;
  }

  private generateJobId(type: string, seed: string): string {
    const hash = simpleHash(seed);
    const timestamp = Date.now().toString(36);
    return `mock-${type}-${timestamp}-${hash.toString(36)}`;
  }

  private hashRequest(request: ProviderGenerationRequest): string {
    return simpleHash(JSON.stringify(request)).toString(16);
  }

  private generateMockOutputUrl(jobId: string): string {
    return `mock://output/${jobId}.mp4`;
  }

  private generateMockOutput(jobId: string): ProviderOutput {
    return {
      uri: `mock://output/${jobId}`,
      mimeType: 'video/mp4',
      width: 720,
      height: 1280,
      durationSeconds: 10,
      fileSize: 5242880, // 5MB
      metadata: { provider: 'mock', generatedAt: new Date().toISOString() },
    };
  }
}
