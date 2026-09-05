export type ContinuitySubjectType = 'character' | 'location' | 'prop' | 'story' | 'relationship' | 'status';

export interface ContinuityFact {
  id: string;
  seriesId: string;
  subjectType: ContinuitySubjectType;
  subjectId: string;
  key: string;
  value: string;
  validFromEpisode: number;
  validFromScene?: number;
  validFromShot?: number;
  validToEpisode?: number;
  validToScene?: number;
  validToShot?: number;
  source: string;
  confidence: number; // 0-1
  override?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContinuityViolation {
  id: string;
  episodeNumber: number;
  sceneNumber: number;
  shotNumber: number;
  factId: string;
  expectedValue: string;
  actualValue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedFix?: string;
  timestamp: Date;
}

export interface StoryFact {
  id: string;
  seriesId: string;
  type: 'secret' | 'relationship' | 'injury' | 'marriage' | 'death' | 'job' | 'money' | 'status' | 'unresolved';
  description: string;
  revealedInEpisode?: number;
  affectedCharacterIds: string[];
  relatedFactIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryFactInput {
  episodeId?: string;
  sceneId?: string;
  subjectType: ContinuitySubjectType;
  subjectId?: string;
  category: string;
  description: string;
  validFromEpisode?: number;
  validUntilEpisode?: number;
  source: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}
