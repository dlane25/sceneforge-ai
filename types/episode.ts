import type { DramaScore } from './drama';

export type ShotFraming = 
  | 'wide'
  | 'medium'
  | 'close-up'
  | 'extreme-close-up'
  | 'two-shot'
  | 'over-shoulder';

export type CameraMovement =
  | 'static'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'dolly-in'
  | 'dolly-out'
  | 'tilt-up'
  | 'tilt-down'
  | 'crane';

export interface ShotContinuityRequirement {
  key: string;
  expectedValue: string;
  episodeNumber?: number;
  sceneNumber?: number;
}

export interface Shot {
  id: string;
  seriesId?: string;
  episodeId?: string;
  shotNumber: number;
  sceneId: string;
  title?: string;
  shotType?: ShotType;
  cameraAngle?: string;
  framing: ShotFraming;
  cameraMovement: CameraMovement;
  description: string;
  dialogue?: string;
  durationSeconds: number;
  characterIds: string[];
  locationId: string;
  continuityRequirements: ShotContinuityRequirement[];
  visualPrompt?: string;
  negativePrompt?: string;
  continuityNotes?: string[];
  status?: ShotStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ShotType = 'establishing' | 'dialogue' | 'action' | 'reaction' | 'insert' | 'transition';
export type ShotStatus = 'draft' | 'planned' | 'continuity-review' | 'ready' | 'generated' | 'archived';

export interface ShotInput {
  shotNumber: number;
  title?: string;
  description: string;
  shotType?: ShotType;
  cameraAngle?: string;
  cameraMovement?: CameraMovement;
  framing?: ShotFraming;
  durationSeconds: number;
  characterIds?: string[];
  locationId?: string;
  dialogue?: string;
  visualPrompt: string;
  negativePrompt?: string;
  continuityNotes?: string[];
  status?: ShotStatus;
}

export interface Storyboard {
  id: string;
  shotId: string;
  prompt: string;
  referenceUrl?: string;
  generationStatus: 'placeholder' | 'queued' | 'succeeded' | 'failed';
  provider?: string;
  generationJobId?: string;
  width: number;
  height: number;
  aspectRatio: '9:16';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShotReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  checkedAt: Date;
}

export interface Scene {
  id: string;
  episodeId: string;
  sceneNumber: number;
  title: string;
  description: string;
  shots: Shot[];
  characterIds: string[];
  locationId: string;
  timeOfDay?: string;
  estimatedDurationSeconds?: number;
  status?: 'draft' | 'approved' | 'shot' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface Episode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  hook: string;
  synopsis: string;
  scenes: Scene[];
  cliffhanger: string;
  status?: 'draft' | 'outlined' | 'in-production' | 'completed' | 'archived';
  estimatedDurationSeconds?: number;
  dramaScore?: DramaScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeInput {
  episodeNumber: number;
  title: string;
  synopsis: string;
  hook?: string;
  cliffhanger?: string;
  status?: Episode['status'];
  estimatedDurationSeconds?: number;
}

export interface SceneInput {
  sceneNumber: number;
  title: string;
  description: string;
  locationId?: string;
  timeOfDay?: string;
  estimatedDurationSeconds?: number;
  status?: 'draft' | 'approved' | 'shot' | 'archived';
}
