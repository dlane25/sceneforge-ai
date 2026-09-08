export type GenerationJobStatus = 'draft' | 'awaiting_approval' | 'approved' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected';
export type GenerationType = 'video' | 'image' | 'image-to-video' | 'extension' | 'audio';
export type AssetType = 'storyboard-image' | 'generated-image' | 'video-clip' | 'audio' | 'captions' | 'final-render';

export interface GenerationJob {
  id: string;
  seriesId: string;
  episodeId: string;
  sceneId: string;
  shotId: string;
  provider: string;
  providerJobId?: string;
  providerModel?: string;
  providerVoiceId?: string;
  characterId?: string;
  language?: string;
  locale?: string;
  generationType: GenerationType;
  status: GenerationJobStatus;
  promptVersion: string;
  inputHash: string;
  promptSnapshot: string;
  negativePromptSnapshot?: string;
  generationParameters?: Record<string, unknown>;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  estimatedCost: number;
  actualCost: number;
  retryCount: number;
  outputAssetIds: string[];
  errorMessage?: string;
  errorCode?: string;
  retryable?: boolean;
  createdAt: Date;
  startedAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  updatedAt: Date;
  lastPolledAt?: Date;
  lastProviderStatus?: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'polling_error';
  lastProviderError?: string;
  providerMetadata?: Record<string, unknown>;
  completionMetadata?: Record<string, unknown>;
  failedAt?: Date;
}

export interface GeneratedAsset {
  id: string;
  generationJobId: string;
  seriesId: string;
  episodeId: string;
  sceneId: string;
  shotId: string;
  assetType: AssetType;
  uri: string;
  storageUri?: string;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  fileSize?: number;
  provider: string;
  providerJobId?: string;
  providerModel?: string;
  providerVoiceId?: string;
  characterId?: string;
  language?: string;
  locale?: string;
  sourceTextSnapshot?: string;
  codec?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  fingerprint: string;
  checksum?: string;
  version: number;
  parentAssetId?: string;
  preferred?: boolean;
  supersededAt?: Date;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  generationParameters?: Record<string, unknown>;
  promptSnapshot?: string;
  negativePromptSnapshot?: string;
  costMetadata?: {
    estimatedCost: number;
    actualCost: number;
    currency?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaReview {
  id: string;
  seriesId: string;
  episodeId: string;
  sceneId: string;
  shotId: string;
  generationJobId: string;
  assetId: string;
  reviewerActor: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  notes?: string;
  rejectionReason?: string;
  continuityAssessment: 'clear' | 'warnings' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
}

export interface MediaReviewInput { notes?: string; rejectionReason?: string; }

export type CaptionFormat = 'srt' | 'vtt';
export type CaptionReviewStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface CaptionSegment {
  id: string;
  trackId: string;
  sequence: number;
  sceneId: string;
  shotId?: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  characterId?: string;
  confidence?: number;
}

export interface CaptionTrack {
  id: string;
  seriesId: string;
  episodeId: string;
  sceneId?: string;
  language: string;
  format: CaptionFormat;
  source: 'dialogue-timing' | 'provider-transcript';
  provider?: string;
  content: string;
  version: number;
  reviewStatus: CaptionReviewStatus;
  preferred: boolean;
  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  supersededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  segments: CaptionSegment[];
}
