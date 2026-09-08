import type { CaptionExportMode, ExportErrorCode, ExportPreset } from '@/types';

export type ExportEngineId = 'mock' | 'ffmpeg-local';
export type ExportEngineStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface ExportRenderClip {
  sequence: number;
  videoUri: string;
  audioUri?: string;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
  volume: number;
  muted: boolean;
}

export interface ExportRenderRequest {
  exportJobId: string;
  preset: ExportPreset;
  clips: ExportRenderClip[];
  durationMs: number;
  captionMode: CaptionExportMode;
  captionFormat?: 'srt' | 'vtt';
  captionContent?: string;
}

export interface ExportEngineOutput {
  uri: string;
  sidecarUri?: string;
  fileName: string;
  mimeType: 'video/mp4';
  fileSize?: number;
  durationMs: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportEngineResult {
  jobId: string;
  status: ExportEngineStatus;
  progress: number;
  output?: ExportEngineOutput;
  error?: { code: ExportErrorCode; message: string; retryable: boolean };
  metadata?: Record<string, unknown>;
}

export interface ExportEngine {
  readonly id: ExportEngineId;
  readonly capabilities: { asynchronous: boolean; cancellation: boolean; captionBurnIn: boolean; captionSidecar: boolean };
  render(request: ExportRenderRequest): Promise<ExportEngineResult>;
  getStatus(jobId: string): Promise<ExportEngineResult>;
  cancel(jobId: string): Promise<ExportEngineResult>;
}
