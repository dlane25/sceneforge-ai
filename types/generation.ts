export type GenerationJobStatus = 'draft' | 'awaiting_approval' | 'approved' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected';
export type GenerationType = 'video' | 'image' | 'image-to-video' | 'extension';
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
  generationType: GenerationType;
  status: GenerationJobStatus;
  promptVersion: string;
  inputHash: string;
  promptSnapshot: string;
  negativePromptSnapshot?: string;
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
  completedAt?: Date;
  cancelledAt?: Date;
  updatedAt: Date;
  lastPolledAt?: Date;
  lastProviderStatus?: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'polling_error';
  lastProviderError?: string;
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
