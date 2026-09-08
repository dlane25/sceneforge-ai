import 'server-only';

import { createHash } from 'node:crypto';
import type { ExportEngine, ExportEngineResult, ExportRenderRequest } from './engine-types';
import { exportError } from './errors';
import { validateMediaSource } from './source-safety';

interface MockState { request: ExportRenderRequest; polls: number; result: ExportEngineResult }

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

export class MockExportEngine implements ExportEngine {
  readonly id = 'mock' as const;
  readonly capabilities = { asynchronous: true, cancellation: true, captionBurnIn: true, captionSidecar: true };
  private readonly jobs = new Map<string, MockState>();

  async render(request: ExportRenderRequest): Promise<ExportEngineResult> {
    if (!request.clips.length || request.durationMs <= 0) throw exportError('validation_failed', 'A validated non-empty timeline is required');
    for (const clip of request.clips) { validateMediaSource(clip.videoUri, true); if (clip.audioUri) validateMediaSource(clip.audioUri, true); }
    const fingerprint = createHash('sha256').update(stableSerialize(request)).digest('hex');
    const jobId = `mock-export-${fingerprint.slice(0, 24)}`;
    const result: ExportEngineResult = { jobId, status: 'queued', progress: 0, metadata: { fingerprint, deterministic: true } };
    this.jobs.set(jobId, { request: structuredClone(request), polls: 0, result });
    return structuredClone(result);
  }

  async getStatus(jobId: string): Promise<ExportEngineResult> {
    const state = this.jobs.get(jobId);
    if (!state) throw exportError('source_missing', 'Mock export job was not found');
    if (state.result.status === 'cancelled' || state.result.status === 'succeeded') return structuredClone(state.result);
    state.polls += 1;
    if (state.polls === 1) state.result = { ...state.result, status: 'processing', progress: 50 };
    else {
      const sidecarExtension = state.request.captionMode === 'sidecar-srt' ? 'srt' : state.request.captionMode === 'sidecar-vtt' ? 'vtt' : undefined;
      const checksum = createHash('sha256').update(`${jobId}:output`).digest('hex');
      state.result = {
        ...state.result, status: 'succeeded', progress: 100,
        output: {
          uri: `mock://exports/${jobId}.mp4`, sidecarUri: sidecarExtension ? `mock://exports/${jobId}.${sidecarExtension}` : undefined,
          fileName: `${jobId}.mp4`, mimeType: 'video/mp4', fileSize: Math.ceil(state.request.durationMs * 250), durationMs: state.request.durationMs, checksum,
          metadata: { engine: 'mock', preset: state.request.preset.id, captionMode: state.request.captionMode, fingerprint: state.result.metadata?.fingerprint },
        },
      };
    }
    return structuredClone(state.result);
  }

  async cancel(jobId: string): Promise<ExportEngineResult> {
    const state = this.jobs.get(jobId);
    if (!state) throw exportError('source_missing', 'Mock export job was not found');
    if (state.result.status !== 'succeeded') state.result = { ...state.result, status: 'cancelled', progress: state.result.progress };
    return structuredClone(state.result);
  }
}

export { stableSerialize as stableExportSerialize };
