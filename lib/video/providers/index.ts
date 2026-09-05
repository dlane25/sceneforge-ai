import type { GenerationJob } from '@/types';

export interface VideoGenerationInput {
  seriesId?: string;
  episodeId?: string;
  sceneId?: string;
  shotId?: string;
  prompt: string;
  negativePrompt?: string;
  duration: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  style?: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: string;
  continuityConstraints?: string[];
}

export interface VideoExtensionInput {
  videoId: string;
  prompt: string;
  duration: number;
  position?: 'start' | 'end';
}

export interface ImageToVideoInput {
  imageUrl: string;
  prompt: string;
  duration: number;
  motion?: string;
}

export interface GenerationStatus {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number;
  outputUrl?: string;
  errorMessage?: string;
}

export interface VideoProvider {
  generateShot(input: VideoGenerationInput): Promise<GenerationJob>;
  extendShot(input: VideoExtensionInput): Promise<GenerationJob>;
  imageToVideo(input: ImageToVideoInput): Promise<GenerationJob>;
  getStatus(jobId: string): Promise<GenerationStatus>;
  cancelJob(jobId: string): Promise<GenerationStatus>;
  estimateCost(input: VideoGenerationInput): Promise<number>;
}
