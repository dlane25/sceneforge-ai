export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

export interface VoiceProfile {
  tone: string;
  accent?: string;
  pace: 'slow' | 'normal' | 'fast';
  pitch?: string;
}

export interface CharacterRelationship {
  characterId: string;
  relationshipType: string;
  description: string;
}

export interface Character {
  id: string;
  seriesId: string;
  name: string;
  role: CharacterRole;
  age: number;
  appearance: string;
  wardrobe: string;
  personality: string;
  relationships: CharacterRelationship[];
  voiceProfile: VoiceProfile;
  continuityNotes: string[];
  createdAt: Date;
  updatedAt: Date;
}
