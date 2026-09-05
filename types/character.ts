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
  description?: string;
  age: number;
  ageRange?: string;
  appearance: string;
  wardrobe: string;
  personality: string;
  relationships: CharacterRelationship[];
  voiceProfile: VoiceProfile;
  continuityNotes: string[];
  status?: 'active' | 'inactive' | 'deceased' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterInput {
  name: string;
  role: CharacterRole;
  description?: string;
  age: number;
  ageRange?: string;
  appearance: string;
  personality: string;
  wardrobe: string;
  voiceProfile: VoiceProfile;
  continuityNotes?: string[];
  status?: Character['status'];
}
