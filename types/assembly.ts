export type ExportPresetId = 'vertical-social-1080p';
export type AssemblyStatus = 'draft' | 'validated' | 'approved' | 'rejected';
export type AssemblyReviewState = 'pending' | 'approved' | 'rejected';
export type AssemblyIssueSeverity = 'error' | 'warning';
export type AssemblyIssueCode =
  | 'MISSING_VIDEO' | 'MISSING_DIALOGUE_AUDIO' | 'ASSET_SCOPE_MISMATCH' | 'REJECTED_ASSET'
  | 'INVALID_VIDEO_DURATION' | 'INVALID_AUDIO_DURATION' | 'AUDIO_EXCEEDS_CLIP' | 'AUDIO_SHORTER_THAN_CLIP'
  | 'INVALID_TRIM' | 'INVALID_TIME_RANGE' | 'TIMELINE_ORDER' | 'TIMELINE_OVERLAP' | 'TIMELINE_GAP'
  | 'EMPTY_TIMELINE' | 'CAPTION_NOT_APPROVED' | 'CAPTION_OUT_OF_RANGE' | 'CAPTION_ORDER' | 'INVALID_ASPECT_RATIO' | 'INVALID_EXPORT_PRESET'
  | 'UNSAFE_SOURCE' | 'APPROVAL_PENDING';

export interface AssemblyValidationIssue {
  id: string;
  assemblyId: string;
  code: AssemblyIssueCode;
  severity: AssemblyIssueSeverity;
  message: string;
  sequence?: number;
  sceneId?: string;
  shotId?: string;
  assetId?: string;
}

export interface EpisodeTimelineItem {
  id: string;
  assemblyId: string;
  sequence: number;
  sceneId: string;
  shotId: string;
  videoAssetId?: string;
  audioAssetId?: string;
  videoSelectionReason?: 'preferred-approved' | 'latest-approved';
  audioSelectionReason?: 'preferred-approved' | 'latest-approved';
  startMs: number;
  endMs: number;
  sourceVideoDurationMs?: number;
  sourceAudioDurationMs?: number;
  trimInMs: number;
  trimOutMs: number;
  transitionType: 'cut' | 'crossfade';
  transitionDurationMs: number;
  volume: number;
  muted: boolean;
  videoAudioPolicy: 'discard' | 'preserve-when-no-dialogue';
  dialogueRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeAssembly {
  id: string;
  seriesId: string;
  episodeId: string;
  items: EpisodeTimelineItem[];
  captionTrackId?: string;
  captionIncluded: boolean;
  timelineDurationMs: number;
  aspectRatio: '9:16';
  width: number;
  height: number;
  frameRate: number;
  exportPreset: ExportPresetId;
  status: AssemblyStatus;
  reviewState: AssemblyReviewState;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  validationIssues: AssemblyValidationIssue[];
  validationPassed: boolean;
  validatedAt?: Date;
  inputHash: string;
  explanation: string;
  createdBy: string;
  version: number;
  preferred: boolean;
  rebuiltFromAssemblyId?: string;
  supersededAt?: Date;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CaptionExportMode = 'none' | 'burn-in' | 'sidecar-srt' | 'sidecar-vtt';
export type ExportJobStatus = 'awaiting_approval' | 'approved' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected';
export type ExportApprovalState = 'pending' | 'approved' | 'rejected';
export type ExportErrorCode =
  | 'configuration' | 'auth' | 'invalid_request' | 'unsupported' | 'provider_unavailable' | 'timeout'
  | 'cancelled' | 'processing_failed' | 'source_missing' | 'validation_failed' | 'unsafe_source' | 'unknown';

export interface EpisodeExportJob {
  id: string;
  seriesId: string;
  episodeId: string;
  assemblyId: string;
  assemblyVersion: number;
  exportVersion: number;
  preset: ExportPresetId;
  outputFormat: 'mp4';
  aspectRatio: '9:16';
  width: number;
  height: number;
  frameRate: number;
  videoCodec: 'h264';
  audioCodec: 'aac';
  captionMode: CaptionExportMode;
  captionTrackId?: string;
  engine: 'mock' | 'ffmpeg-local';
  engineJobId?: string;
  status: ExportJobStatus;
  progress: number;
  approvalState: ExportApprovalState;
  requestedBy: string;
  explanation: string;
  approvedBy?: string;
  approvalNotes?: string;
  outputUri?: string;
  sidecarUri?: string;
  outputFileName?: string;
  fileSize?: number;
  durationMs?: number;
  checksum?: string;
  engineMetadata?: Record<string, unknown>;
  errorCode?: ExportErrorCode;
  errorMessage?: string;
  retryable?: boolean;
  retryCount: number;
  requestedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  outputFormat: 'mp4';
  aspectRatio: '9:16';
  width: number;
  height: number;
  frameRate: number;
  videoCodec: 'h264';
  audioCodec: 'aac';
  audioSampleRate: number;
  pixelFormat: 'yuv420p';
}
