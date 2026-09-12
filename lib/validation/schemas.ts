import { z } from 'zod';

export const seriesInputSchema = z.object({
  title: z.string().trim().min(1),
  logline: z.string().trim().min(1),
  genre: z.string().trim().min(1),
  targetAudience: z.string().trim().min(1),
  visualStyle: z.string().trim().min(1),
  episodeCount: z.number().int().positive(),
  episodeDurationSeconds: z.number().int().positive(),
});

export const shotContinuityRequirementSchema = z.object({
  key: z.string().min(1),
  expectedValue: z.string().min(1),
  episodeNumber: z.number().int().positive().optional(),
  sceneNumber: z.number().int().positive().optional(),
});

export const productionInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  logline: z.string().trim().min(1).max(1000),
  genre: z.string().trim().min(1).max(120),
  targetAudience: z.string().trim().min(1).max(200),
  visualStyle: z.string().trim().min(1).max(500),
  episodeCount: z.number().int().min(1).max(1000),
  episodeDurationSeconds: z.number().int().min(1).max(3600),
  status: z.enum(['draft', 'in-development', 'completed', 'archived']).optional(),
});

export const productionPatchSchema = productionInputSchema.partial();

export const memberInputSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

export const memberRoleSchema = z.object({ role: z.enum(['OWNER', 'EDITOR', 'VIEWER']) });

const voiceRightsSchema = z.object({
  rightsConfirmed: z.boolean(),
  consentConfirmed: z.boolean(),
  sourceType: z.enum(['synthetic', 'provider-catalog', 'licensed', 'uploaded-reference', 'cloned']),
  ownerRightsNote: z.string().trim().max(1000).optional(),
  confirmedAt: z.coerce.date().optional(),
  reviewedBy: z.string().trim().max(200).optional(),
  approvalState: z.enum(['not-required', 'pending', 'approved', 'rejected']),
});
const voiceProfileSchema = z.object({
  tone: z.string().trim().min(1).max(120), accent: z.string().trim().max(120).optional(), pace: z.enum(['slow', 'normal', 'fast']), pitch: z.string().trim().max(120).optional(),
  characterId: z.string().trim().max(200).optional(), displayName: z.string().trim().max(200).optional(), provider: z.enum(['mock', 'elevenlabs-voice']).optional(), providerVoiceId: z.string().trim().max(300).optional(),
  language: z.string().trim().min(2).max(50).optional(), locale: z.string().trim().max(80).optional(), speakingStyle: z.string().trim().max(200).optional(),
  styleDescriptors: z.array(z.string().trim().max(120)).max(20).optional(), ageDescriptor: z.string().trim().max(120).optional(), voiceDescriptors: z.array(z.string().trim().max(120)).max(20).optional(),
  stability: z.number().min(0).max(1).optional(), similarityBoost: z.number().min(0).max(1).optional(), styleExaggeration: z.number().min(0).max(1).optional(), speakerBoost: z.boolean().optional(),
  reference: z.object({ referenceId: z.string().trim().max(300).optional(), mimeType: z.string().trim().max(120).optional(), checksum: z.string().trim().max(300).optional(), durationSeconds: z.number().positive().max(3600).optional(), description: z.string().trim().max(1000).optional() }).optional(),
  rights: voiceRightsSchema.optional(), active: z.boolean().optional(), createdAt: z.coerce.date().optional(), updatedAt: z.coerce.date().optional(),
});
export const characterInputSchema = z.object({ name: z.string().trim().min(1).max(120), role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']), description: z.string().trim().max(1000).optional(), age: z.number().int().min(0).max(150), ageRange: z.string().trim().max(80).optional(), appearance: z.string().trim().min(1).max(1000), personality: z.string().trim().min(1).max(1000), wardrobe: z.string().trim().min(1).max(1000), voiceProfile: voiceProfileSchema, continuityNotes: z.array(z.string().trim().max(500)).max(30).optional(), status: z.enum(['active', 'inactive', 'deceased', 'archived']).optional() });
export const characterPatchSchema = characterInputSchema.partial();
export const locationInputSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(1000), type: z.string().trim().max(80).optional(), visualDescription: z.string().trim().max(1000).optional(), roomDetails: z.string().trim().max(1000).optional(), lighting: z.string().trim().max(500).optional(), visualStyle: z.string().trim().max(500).optional(), continuityNotes: z.array(z.string().trim().max(500)).max(30).optional() });
export const locationPatchSchema = locationInputSchema.partial();
export const episodeInputSchema = z.object({ episodeNumber: z.number().int().min(1).max(1000), title: z.string().trim().min(1).max(200), synopsis: z.string().trim().min(1).max(3000), hook: z.string().trim().max(1000).optional(), cliffhanger: z.string().trim().max(1000).optional(), status: z.enum(['draft', 'outlined', 'in-production', 'completed', 'archived']).optional(), estimatedDurationSeconds: z.number().int().min(1).max(3600).optional() });
export const episodePatchSchema = episodeInputSchema.partial();
export const sceneInputSchema = z.object({ sceneNumber: z.number().int().min(1).max(10000), title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(3000), locationId: z.string().trim().min(1).regex(/^[a-zA-Z0-9_-]+$/), timeOfDay: z.string().trim().max(80).optional(), estimatedDurationSeconds: z.number().int().min(1).max(3600).optional(), status: z.enum(['draft', 'approved', 'shot', 'archived']).optional() });
export const scenePatchSchema = sceneInputSchema.partial();
export const storyFactInputSchema = z.object({ episodeId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), sceneId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), subjectType: z.enum(['character', 'location', 'prop', 'story', 'relationship', 'status']), subjectId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(2000), validFromEpisode: z.number().int().min(1).optional(), validUntilEpisode: z.number().int().min(1).optional(), source: z.string().trim().min(1).max(200), confidence: z.number().min(0).max(1).optional(), metadata: z.record(z.string(), z.unknown()).optional() });
export const storyFactPatchSchema = storyFactInputSchema.partial();
export const shotInputSchema = z.object({ shotNumber: z.number().int().min(1).max(10000), title: z.string().trim().max(200).optional(), description: z.string().trim().min(1).max(3000), shotType: z.enum(['establishing', 'dialogue', 'action', 'reaction', 'insert', 'transition']).optional(), cameraAngle: z.string().trim().max(120).optional(), cameraMovement: z.enum(['static', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'dolly-in', 'dolly-out', 'tilt-up', 'tilt-down', 'crane']).optional(), framing: z.enum(['wide', 'medium', 'close-up', 'extreme-close-up', 'two-shot', 'over-shoulder']).optional(), durationSeconds: z.number().int().min(1).max(3600), characterIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).max(50).optional(), locationId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), dialogue: z.string().trim().max(2000).optional(), visualPrompt: z.string().trim().min(1).max(3000), negativePrompt: z.string().trim().max(2000).optional(), continuityNotes: z.array(z.string().trim().max(500)).max(30).optional(), status: z.enum(['draft', 'planned', 'continuity-review', 'ready', 'generated', 'archived']).optional() });
export const shotPatchSchema = shotInputSchema.partial();
export const shotReorderSchema = z.object({ shotIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).min(1).max(100) });
