export type GenerationJobStatus = 'draft' | 'awaiting_approval' | 'approved' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected';
export type GenerationType = 'video' | 'image-to-video' | 'extension';
export type AssetType = 'storyboard-image' | 'generated-image' | 'video-clip' | 'audio' | 'captions' | 'final-render';

export interface GenerationJob {
  id: string;
  seriesId: string;
  episodeId: string;
  sceneId: string;
  shotId: string;
  provider: string;
  providerJobId?: string;
  model: string;
  generationType: GenerationType;
  status: GenerationJobStatus;
  promptVersion: string;
  inputHash: string;
  promptSnapshot: string;
  negativePromptSnapshot?: string;
  durationSeconds: number;
  aspectRatio: '9:16';
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
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  provider: string;
  fingerprint: string;
  version: number;
  parentAssetId?: string;
  preferred?: boolean;
  supersededAt?: Date;
  reviewStatus: 'pending' | 'approved' | 'rejected';
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
