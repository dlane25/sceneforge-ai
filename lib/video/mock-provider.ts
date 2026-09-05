import type {
  GenerationJob,
} from '@/types';
import type {
  VideoProvider,
  VideoGenerationInput,
  VideoExtensionInput,
  ImageToVideoInput,
  GenerationStatus,
} from './providers';

/**
 * Deterministic hash function for reproducible results
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export class MockVideoProvider implements VideoProvider {
  private jobs: Map<string, GenerationJob> = new Map();
  private statuses: Map<string, GenerationStatus> = new Map();

  async generateShot(input: VideoGenerationInput): Promise<GenerationJob> {
    const jobId = this.generateJobId('shot', input.prompt);
    const inputHash = this.hashInput(input);
    const estimatedCost = this.estimateCostSync(input);

    const job: GenerationJob = {
      id: jobId,
      seriesId: input.seriesId || '',
      episodeId: input.episodeId || '',
      sceneId: input.sceneId || '',
      shotId: input.shotId || '',
      provider: 'mock',
      model: input.model || 'mock-v1',
      generationType: 'video',
      status: 'queued',
      promptVersion: '1.0',
      inputHash,
      promptSnapshot: input.prompt,
      negativePromptSnapshot: input.negativePrompt,
      durationSeconds: input.duration,
      aspectRatio: input.aspectRatio === '9:16' ? '9:16' : '9:16',
      estimatedCost,
      actualCost: 0,
      retryCount: 0,
      outputAssetIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.initializeStatus(jobId, input.prompt);

    return job;
  }

  async extendShot(input: VideoExtensionInput): Promise<GenerationJob> {
    const jobId = this.generateJobId('extend', input.videoId);
    const inputHash = this.hashInput(input);

    const job: GenerationJob = {
      id: jobId,
      seriesId: '', episodeId: '', sceneId: '', shotId: '',
      provider: 'mock',
      model: 'mock-v1',
      generationType: 'extension',
      status: 'queued',
      promptVersion: '1.0',
      inputHash,
      promptSnapshot: input.prompt,
      durationSeconds: input.duration,
      aspectRatio: '9:16',
      estimatedCost: 50,
      actualCost: 0,
      retryCount: 0,
      outputAssetIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.initializeStatus(jobId, input.prompt);

    return job;
  }

  async imageToVideo(input: ImageToVideoInput): Promise<GenerationJob> {
    const jobId = this.generateJobId('i2v', input.imageUrl);
    const inputHash = this.hashInput(input);

    const job: GenerationJob = {
      id: jobId,
      seriesId: '', episodeId: '', sceneId: '', shotId: '',
      provider: 'mock',
      model: 'mock-v1',
      generationType: 'image-to-video',
      status: 'queued',
      promptVersion: '1.0',
      inputHash,
      promptSnapshot: input.prompt,
      durationSeconds: input.duration,
      aspectRatio: '9:16',
      estimatedCost: 75,
      actualCost: 0,
      retryCount: 0,
      outputAssetIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.initializeStatus(jobId, input.prompt);

    return job;
  }

  async getStatus(jobId: string): Promise<GenerationStatus> {
    let status = this.statuses.get(jobId);

    if (!status) {
      const job = this.jobs.get(jobId);
      if (!job) {
        return {
          jobId,
          status: 'failed',
          errorMessage: 'Job not found',
        };
      }

      status = {
        jobId,
        status: job.status === 'processing' ? 'running' : job.status === 'completed' ? 'succeeded' : job.status === 'queued' || job.status === 'failed' || job.status === 'cancelled' ? job.status : 'queued',
        progress: 0,
      };
    }

    // Simulate deterministic progress
    const hash = simpleHash(jobId);
    const progressIncrement = (hash % 30) + 10; // 10-40% per check

    if (status && (status.status === 'queued' || status.status === 'running')) {
      const newProgress = (status.progress || 0) + progressIncrement;

      if (newProgress >= 100) {
        status.status = 'succeeded';
        status.progress = 100;
        status.outputUrl = `mock://video/${jobId}.mp4`;

        const job = this.jobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.actualCost = job.estimatedCost;
          job.outputAssetIds = [status.outputUrl];
          job.completedAt = new Date();
        }
      } else {
        status.status = 'running';
        status.progress = newProgress;
      }
    }

    this.statuses.set(jobId, status!);
    return status!;
  }

  async estimateCost(input: VideoGenerationInput): Promise<number> {
    return this.estimateCostSync(input);
  }

  async cancelJob(jobId: string): Promise<GenerationStatus> {
    const job = this.jobs.get(jobId);
    if (!job) return { jobId, status: 'failed', errorMessage: 'Job not found' };
    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.updatedAt = new Date();
    const status: GenerationStatus = { jobId, status: 'cancelled', progress: 0 };
    this.statuses.set(jobId, status);
    return status;
  }

  private estimateCostSync(input: VideoGenerationInput): number {
    // Simple cost estimation based on duration and style
    const baseCost = 100;
    const durationMultiplier = input.duration / 60; // Per minute
    const styleMultiplier = input.style ? 1.2 : 1.0;

    return Math.round(baseCost * durationMultiplier * styleMultiplier);
  }

  private generateJobId(type: string, seed: string): string {
    const hash = simpleHash(seed);
    const timestamp = Date.now().toString(36);
    return `job_${type}_${timestamp}_${hash.toString(36)}`;
  }

  private hashInput(input: object): string {
    const str = JSON.stringify(input);
    return simpleHash(str).toString(16);
  }

  private initializeStatus(jobId: string, prompt: string): void {
    const hash = simpleHash(prompt);

    // Deterministically decide if job will succeed or fail
    const successRate = 0.95; // 95% success rate
    const willSucceed = (hash % 100) / 100 < successRate;

    this.statuses.set(jobId, {
      jobId,
      status: 'queued',
      progress: 0,
    });

    if (!willSucceed) {
      // Set up a failure scenario
      setTimeout(() => {
        const status = this.statuses.get(jobId);
        if (status && status.status !== 'succeeded') {
          status.status = 'failed';
          status.errorMessage = 'Mock provider simulated failure';

          const job = this.jobs.get(jobId);
          if (job) {
            job.status = 'failed';
            job.errorMessage = 'Mock provider simulated failure';
          }
        }
      }, 1000);
    }
  }
}

export const createMockVideoProvider = (): MockVideoProvider => {
  return new MockVideoProvider();
};
