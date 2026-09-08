export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

export type VoiceSourceType = 'synthetic' | 'provider-catalog' | 'licensed' | 'uploaded-reference' | 'cloned';
export type VoiceRightsApprovalState = 'not-required' | 'pending' | 'approved' | 'rejected';

export interface VoiceRightsMetadata {
  rightsConfirmed: boolean;
  consentConfirmed: boolean;
  sourceType: VoiceSourceType;
  ownerRightsNote?: string;
  confirmedAt?: Date;
  reviewedBy?: string;
  approvalState: VoiceRightsApprovalState;
}

export interface VoiceReferenceMetadata {
  referenceId?: string;
  mimeType?: string;
  checksum?: string;
  durationSeconds?: number;
  description?: string;
}

export interface VoiceProfile {
  tone: string;
  accent?: string;
  pace: 'slow' | 'normal' | 'fast';
  pitch?: string;
  characterId?: string;
  displayName?: string;
  provider?: 'mock' | 'elevenlabs-voice';
  providerVoiceId?: string;
  language?: string;
  locale?: string;
  speakingStyle?: string;
  styleDescriptors?: string[];
  ageDescriptor?: string;
  voiceDescriptors?: string[];
  stability?: number;
  similarityBoost?: number;
  styleExaggeration?: number;
  speakerBoost?: boolean;
  reference?: VoiceReferenceMetadata;
  rights?: VoiceRightsMetadata;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
