import { providerError } from './errors';
import {
  ProviderErrorCode,
  type MediaProvider,
  type ProviderCapabilities,
  type ProviderGenerationRequest,
  type ProviderJobMetadata,
  type ProviderJobStatus,
  type ProviderMediaType,
} from './types';

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

interface MockJob {
  metadata: ProviderJobMetadata;
  request: ProviderGenerationRequest;
  mediaType: ProviderMediaType;
  polls: number;
  status: ProviderJobStatus;
}

export class MockMediaProvider implements MediaProvider {
  readonly id = 'mock' as const;
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: true,
    videoGeneration: true,
    textToSpeech: true,
    speechGeneration: true,
    voiceCloning: false,
    soundEffectsGeneration: false,
    captionGeneration: false,
    videoExtension: true,
    imageToVideo: true,
    synchronous: false,
    asyncWithPolling: true,
    cancellation: true,
    costEstimation: true,
    requestValidation: true,
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportedDurations: { min: 1, max: 300 },
    supportedResolutions: { min: 256, max: 4096 },
    supportedModels: ['mock-v1'],
  };

  private readonly jobs = new Map<string, MockJob>();
  private sequence = 0;

  async generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('image', { ...request, type: 'image' });
  }

  async generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('video', { ...request, type: 'video' });
  }

  async generateSpeech(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('audio', { ...request, type: 'audio' });
  }

  async extendVideo(_jobId: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('video', { ...request, type: 'video' });
  }

  async imageToVideo(_imageUri: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.createJob('video', { ...request, type: 'video' });
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { jobId, status: 'failed', error: { code: ProviderErrorCode.UnknownError, message: 'Mock job was not found', retryable: false, timestamp: new Date() }, lastUpdated: new Date() };
    }
    if (job.status.status === 'queued') {
      job.polls += 1;
      job.status = { jobId, status: 'processing', progress: 50, lastUpdated: new Date() };
    } else if (job.status.status === 'processing') {
      job.polls += 1;
      const portrait = (job.request.aspectRatio || '9:16') === '9:16';
      const audio = job.mediaType === 'audio';
      const width = audio ? 0 : job.request.width || (portrait ? 720 : 1280);
      const height = audio ? 0 : job.request.height || (portrait ? 1280 : 720);
      const extension = job.mediaType === 'image' ? 'png' : audio ? 'mp3' : 'mp4';
      const mimeType = job.mediaType === 'image' ? 'image/png' : audio ? 'audio/mpeg' : 'video/mp4';
      const uri = `mock://output/${jobId}.${extension}`;
      const durationSeconds = audio ? Math.max(0.5, Number(((job.request.prompt?.trim().split(/\s+/).length || 1) / 2.5).toFixed(2))) : job.mediaType === 'video' ? job.request.duration : undefined;
      job.status = {
        jobId,
        status: 'succeeded',
        progress: 100,
        outputUrl: uri,
        actualCost: job.metadata.estimatedCost,
        output: {
          uri,
          storageUri: uri,
          mimeType,
          width,
          height,
          durationSeconds,
          fileSize: job.mediaType === 'image' ? 1_048_576 : audio ? Math.ceil((durationSeconds || 1) * 16_000) : 5_242_880,
          checksum: hash(jobId),
          codec: audio ? 'mp3' : undefined,
          sampleRate: audio ? 44_100 : undefined,
          bitrate: audio ? 128_000 : undefined,
          channels: audio ? 1 : undefined,
          metadata: { provider: 'mock', polls: job.polls, serialization: stableSerialize(job.request) },
        },
        lastUpdated: new Date(),
      };
    }
    return structuredClone(job.status);
  }

  async cancelJob(jobId: string): Promise<ProviderJobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) throw providerError(ProviderErrorCode.InvalidRequest, 'Mock job was not found');
    if (job.status.status === 'succeeded' || job.status.status === 'failed') return structuredClone(job.status);
    job.status = { jobId, status: 'cancelled', lastUpdated: new Date() };
    return structuredClone(job.status);
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    const duration = request.type === 'image' ? 1 : request.type === 'audio' ? Math.max(1, (request.prompt?.length || 0) / 100) : request.duration || 5;
    return Number((duration * (request.style ? 0.012 : 0.01)).toFixed(4));
  }

  private async createJob(mediaType: ProviderMediaType, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    if (!request.prompt?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Generation prompt is required');
    this.sequence += 1;
    const now = new Date();
    const jobId = `mock-${mediaType}-${hash(stableSerialize(request))}-${this.sequence}`;
    const metadata: ProviderJobMetadata = {
      jobId,
      provider: this.id,
      model: request.model || 'mock-v1',
      status: 'queued',
      estimatedCost: await this.estimateCost(request),
      createdAt: now,
      submittedAt: now,
      lastUpdated: now,
      lifecycleMetadata: { serialization: stableSerialize(request) },
    };
    this.jobs.set(jobId, { metadata, request, mediaType, polls: 0, status: { jobId, status: 'queued', progress: 0, lastUpdated: now } });
    return structuredClone(metadata);
  }
}
