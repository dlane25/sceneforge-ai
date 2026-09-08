import type { ProviderLifecycleStatus, ProviderOutput } from './types';

export interface TransportSubmission {
  jobId: string;
  status: ProviderLifecycleStatus;
  estimatedCost?: number;
  actualCost?: number;
  output?: ProviderOutput;
  metadata?: Record<string, unknown>;
}

export interface TransportStatus {
  status: ProviderLifecycleStatus;
  progress?: number;
  output?: ProviderOutput;
  errorMessage?: string;
  errorCode?: string;
  actualCost?: number;
  metadata?: Record<string, unknown>;
}

export interface GeminiImageTransport {
  submitImageGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    aspectRatio: '9:16' | '16:9' | '1:1';
    model: string;
  }): Promise<TransportSubmission>;
  getImageGenerationStatus(jobId: string): Promise<TransportStatus>;
}

export interface VertexVideoTransport {
  submitVideoGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    duration: number;
    width: number;
    height: number;
    aspectRatio: '9:16' | '16:9';
    model: string;
    seed?: number;
  }): Promise<TransportSubmission>;
  getVideoGenerationStatus(jobId: string): Promise<TransportStatus>;
}

export interface SpeechTransport {
  submitSpeechGeneration(request: {
    text: string;
    voiceId: string;
    model: string;
    language?: string;
    locale?: string;
    stability?: number;
    similarityBoost?: number;
    styleExaggeration?: number;
    speakerBoost?: boolean;
    outputFormat: string;
  }): Promise<TransportSubmission>;
  getSpeechGenerationStatus(jobId: string): Promise<TransportStatus>;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export class FakeGeminiImageTransport implements GeminiImageTransport {
  private readonly jobs = new Map<string, TransportStatus>();
  private sequence = 0;

  async submitImageGeneration(request: Parameters<GeminiImageTransport['submitImageGeneration']>[0]): Promise<TransportSubmission> {
    this.sequence += 1;
    const jobId = `fake-gemini-${stableHash(JSON.stringify(request))}-${this.sequence}`;
    const output: ProviderOutput = {
      uri: `fake://gemini/images/${jobId}.png`,
      mimeType: 'image/png',
      width: request.width,
      height: request.height,
      fileSize: 2048,
      checksum: stableHash(jobId),
      metadata: { transport: 'fake', model: request.model },
    };
    const status: TransportStatus = { status: 'succeeded', progress: 100, output, actualCost: 0 };
    this.jobs.set(jobId, status);
    return { jobId, status: 'succeeded', estimatedCost: 0, actualCost: 0, output, metadata: { synchronous: true } };
  }

  async getImageGenerationStatus(jobId: string): Promise<TransportStatus> {
    return this.jobs.get(jobId) || { status: 'failed', errorCode: 'NOT_FOUND', errorMessage: 'Image job was not found' };
  }
}

export class FakeVertexVideoTransport implements VertexVideoTransport {
  private readonly jobs = new Map<string, { polls: number; request: Parameters<VertexVideoTransport['submitVideoGeneration']>[0] }>();
  private sequence = 0;

  async submitVideoGeneration(request: Parameters<VertexVideoTransport['submitVideoGeneration']>[0]): Promise<TransportSubmission> {
    this.sequence += 1;
    const jobId = `fake-vertex-${stableHash(JSON.stringify(request))}-${this.sequence}`;
    this.jobs.set(jobId, { polls: 0, request });
    return { jobId, status: 'queued', estimatedCost: Number((request.duration * 0.01).toFixed(2)), metadata: { transport: 'fake' } };
  }

  async getVideoGenerationStatus(jobId: string): Promise<TransportStatus> {
    const job = this.jobs.get(jobId);
    if (!job) return { status: 'failed', errorCode: 'NOT_FOUND', errorMessage: 'Video job was not found' };
    job.polls += 1;
    if (job.polls === 1) return { status: 'processing', progress: 50 };
    const { request } = job;
    return {
      status: 'succeeded',
      progress: 100,
      actualCost: Number((request.duration * 0.01).toFixed(2)),
      output: {
        uri: `fake://vertex/videos/${jobId}.mp4`,
        storageUri: `fake://vertex/videos/${jobId}.mp4`,
        mimeType: 'video/mp4',
        width: request.width,
        height: request.height,
        durationSeconds: request.duration,
        fileSize: 5_242_880,
        checksum: stableHash(jobId),
        metadata: { transport: 'fake', model: request.model },
      },
    };
  }
}

export class FakeSpeechTransport implements SpeechTransport {
  private readonly jobs = new Map<string, TransportStatus>();
  private sequence = 0;

  async submitSpeechGeneration(request: Parameters<SpeechTransport['submitSpeechGeneration']>[0]): Promise<TransportSubmission> {
    this.sequence += 1;
    const fingerprint = stableHash(JSON.stringify(request));
    const jobId = `fake-speech-${fingerprint}-${this.sequence}`;
    const durationSeconds = Math.max(0.5, Number((request.text.trim().split(/\s+/).length / 2.5).toFixed(2)));
    const output: ProviderOutput = {
      uri: `fake://audio/${jobId}.mp3`, storageUri: `fake://audio/${jobId}.mp3`, mimeType: 'audio/mpeg', width: 0, height: 0,
      durationSeconds, fileSize: Math.ceil(durationSeconds * 16_000), checksum: stableHash(jobId), codec: 'mp3', sampleRate: 44_100, bitrate: 128_000, channels: 1,
      metadata: { transport: 'fake', model: request.model, voiceId: request.voiceId, serialization: JSON.stringify(request) },
    };
    const actualCost = Number((request.text.length * 0.00003).toFixed(4));
    const status: TransportStatus = { status: 'succeeded', progress: 100, output, actualCost, metadata: { synchronous: true } };
    this.jobs.set(jobId, status);
    return { jobId, status: 'succeeded', estimatedCost: actualCost, actualCost, output, metadata: { synchronous: true } };
  }

  async getSpeechGenerationStatus(jobId: string): Promise<TransportStatus> {
    return this.jobs.get(jobId) || { status: 'failed', errorCode: 'NOT_FOUND', errorMessage: 'Speech job was not found' };
  }
}
