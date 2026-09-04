import type { Character } from './character';
import type { Episode } from './episode';

export type SeriesStatus = 'draft' | 'in-development' | 'completed' | 'archived';

export interface Series {
  id: string;
  title: string;
  logline: string;
  genre: string;
  targetAudience: string;
  visualStyle: string;
  episodeCount: number;
  episodeDurationSeconds: number;
  status: SeriesStatus;
  characters: Character[];
  episodes: Episode[];
  createdAt: Date;
  updatedAt: Date;
}
