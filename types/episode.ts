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
  shotNumber: number;
  sceneId: string;
  framing: ShotFraming;
  cameraMovement: CameraMovement;
  description: string;
  dialogue?: string;
  durationSeconds: number;
  characterIds: string[];
  locationId: string;
  continuityRequirements: ShotContinuityRequirement[];
  createdAt: Date;
  updatedAt: Date;
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
  dramaScore?: DramaScore;
  createdAt: Date;
  updatedAt: Date;
}
