/**
 * Gemini AI Schemas
 * Zod-validated structured outputs for Gemini AI operations
 */

import { z } from 'zod';

/**
 * Shot prompt enhancement output from Gemini
 */
export const ShotEnhancementSchema = z
  .object({
    enhancedPrompt: z.string().describe('Enhanced visual prompt for shot generation'),
    negativePrompt: z
      .string()
      .describe('Negative prompt to avoid unwanted visual elements'),
    confidence: z.number().min(0).max(1).describe('Confidence in the enhancement'),
    reasoning: z.string().describe('Why these enhancements were applied'),
  })
  .strict();

export type ShotEnhancement = z.infer<typeof ShotEnhancementSchema>;

/**
 * Continuity prompt construction from Series Memory and facts
 */
export const ContinuityPromptSchema = z
  .object({
    continuityConstraints: z.array(z.string()).describe('Visual constraints for continuity'),
    characterAppearanceNotes: z
      .string()
      .describe('Character appearance details to maintain consistency'),
    locationVisualNotes: z
      .string()
      .describe('Location visual details for consistency'),
    timelineContext: z.string().describe('Timeline context for the scene'),
    confidence: z.number().min(0).max(1).describe('Confidence in continuity assessment'),
  })
  .strict();

export type ContinuityPrompt = z.infer<typeof ContinuityPromptSchema>;

/**
 * Visual description refinement from Gemini
 */
export const VisualDescriptionRefinementSchema = z
  .object({
    refinedDescription: z.string().describe('Refined visual description'),
    cinematicNotes: z.string().describe('Cinematic direction and framing notes'),
    colorPalette: z.string().describe('Recommended color palette'),
    visualStyle: z.string().describe('Visual style guidance'),
    confidence: z.number().min(0).max(1).describe('Confidence in refinement'),
  })
  .strict();

export type VisualDescriptionRefinement = z.infer<
  typeof VisualDescriptionRefinementSchema
>;

/**
 * Negative prompt generation from Gemini
 */
export const NegativePromptGenerationSchema = z
  .object({
    negativePrompt: z.string().describe('Prompt describing what NOT to generate'),
    reasoning: z.string().describe('Why these negative constraints are applied'),
    commonMistakes: z.array(z.string()).describe('Common mistakes to avoid'),
    confidence: z.number().min(0).max(1).describe('Confidence in negative prompt'),
  })
  .strict();

export type NegativePromptGeneration = z.infer<typeof NegativePromptGenerationSchema>;

/**
 * Generation recommendation from Gemini
 * Used to suggest provider and model selections
 */
export const GenerationRecommendationSchema = z
  .object({
    recommendedProvider: z.enum(['mock', 'gemini-image', 'vertex-video']).describe('Recommended provider'),
    recommendedModel: z.string().describe('Recommended model for the provider'),
    reasoning: z.string().describe('Why this provider/model combination'),
    estimatedDifficulty: z.enum(['easy', 'medium', 'hard']).describe('Estimated generation difficulty'),
    suggestedDuration: z
      .number()
      .min(1)
      .max(300)
      .optional()
      .describe('Suggested duration for video'),
    confidence: z.number().min(0).max(1).describe('Confidence in recommendation'),
  })
  .strict();

export type GenerationRecommendation = z.infer<typeof GenerationRecommendationSchema>;

/**
 * Unified Gemini enhancement operation result
 */
export const GeminiEnhancementResultSchema = z
  .object({
    shotEnhancement: ShotEnhancementSchema,
    continuityPrompt: ContinuityPromptSchema,
    visualRefinement: VisualDescriptionRefinementSchema,
    negativePrompt: NegativePromptGenerationSchema,
    generationRecommendation: GenerationRecommendationSchema,
    overallConfidence: z
      .number()
      .min(0)
      .max(1)
      .describe('Overall confidence across all enhancements'),
  })
  .strict();

export type GeminiEnhancementResult = z.infer<typeof GeminiEnhancementResultSchema>;

/**
 * Validate Gemini output against schema
 * Throws if validation fails with details
 */
export function validateGeminiOutput<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(
      `Gemini output validation failed: ${errorMessages.join('; ')}`
    );
  }
  return result.data;
}
