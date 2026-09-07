/**
 * Gemini Service Tests
 * Tests structured output validation and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeminiService,
  FakeGeminiTransport,
  createTestGeminiService,
  ShotEnhancementSchema,
  ContinuityPromptSchema,
  VisualDescriptionRefinementSchema,
  NegativePromptGenerationSchema,
  GenerationRecommendationSchema,
  GeminiEnhancementResultSchema,
  validateGeminiOutput,
} from '@/lib/media/ai';

describe('Gemini Schemas', () => {
  it('should validate shot enhancement output', () => {
    const valid = {
      enhancedPrompt: 'A cinematic shot',
      negativePrompt: 'blurry',
      confidence: 0.95,
      reasoning: 'Enhanced visuals',
    };

    const result = validateGeminiOutput(ShotEnhancementSchema, valid);
    expect(result.enhancedPrompt).toBe('A cinematic shot');
    expect(result.confidence).toBe(0.95);
  });

  it('should reject malformed shot enhancement', () => {
    const invalid = {
      enhancedPrompt: 'A cinematic shot',
      // missing negativePrompt, confidence, reasoning
    };

    expect(() => {
      validateGeminiOutput(ShotEnhancementSchema, invalid);
    }).toThrow();
  });

  it('should validate continuity prompt output', () => {
    const valid = {
      continuityConstraints: ['Character wears jacket', 'Scene in office'],
      characterAppearanceNotes: 'Dark hair',
      locationVisualNotes: 'Modern office',
      timelineContext: 'Morning',
      confidence: 0.9,
    };

    const result = validateGeminiOutput(ContinuityPromptSchema, valid);
    expect(result.continuityConstraints).toHaveLength(2);
    expect(result.confidence).toBe(0.9);
  });

  it('should validate visual description refinement', () => {
    const valid = {
      refinedDescription: 'A stunning shot',
      cinematicNotes: 'Use 24mm lens',
      colorPalette: 'Warm tones',
      visualStyle: 'Cinematic',
      confidence: 0.95,
    };

    const result = validateGeminiOutput(VisualDescriptionRefinementSchema, valid);
    expect(result.refinedDescription).toBe('A stunning shot');
  });

  it('should validate negative prompt generation', () => {
    const valid = {
      negativePrompt: 'no blur, no artifacts',
      reasoning: 'Common failures',
      commonMistakes: ['Blur', 'Artifacts'],
      confidence: 0.95,
    };

    const result = validateGeminiOutput(NegativePromptGenerationSchema, valid);
    expect(result.commonMistakes).toHaveLength(2);
  });

  it('should validate generation recommendation', () => {
    const valid = {
      recommendedProvider: 'vertex-video',
      recommendedModel: 'veo-2',
      reasoning: 'Complex scene',
      estimatedDifficulty: 'medium',
      suggestedDuration: 10,
      confidence: 0.85,
    };

    const result = validateGeminiOutput(GenerationRecommendationSchema, valid);
    expect(result.recommendedProvider).toBe('vertex-video');
    expect(result.suggestedDuration).toBe(10);
  });

  it('should validate recommendation without duration', () => {
    const valid = {
      recommendedProvider: 'gemini-image',
      recommendedModel: 'gemini-2.0-flash',
      reasoning: 'Image only',
      estimatedDifficulty: 'easy',
      confidence: 0.95,
    };

    const result = validateGeminiOutput(GenerationRecommendationSchema, valid);
    expect(result.suggestedDuration).toBeUndefined();
  });

  it('should validate complete enhancement result', () => {
    const valid = {
      shotEnhancement: {
        enhancedPrompt: 'Cinematic shot',
        negativePrompt: 'blurry',
        confidence: 0.95,
        reasoning: 'Improved',
      },
      continuityPrompt: {
        continuityConstraints: ['red jacket'],
        characterAppearanceNotes: 'Dark hair',
        locationVisualNotes: 'Office',
        timelineContext: 'Morning',
        confidence: 0.9,
      },
      visualRefinement: {
        refinedDescription: 'Stunning',
        cinematicNotes: '24mm',
        colorPalette: 'Warm',
        visualStyle: 'Cinematic',
        confidence: 0.9,
      },
      negativePrompt: {
        negativePrompt: 'no blur',
        reasoning: 'Avoid failures',
        commonMistakes: ['Blur'],
        confidence: 0.95,
      },
      generationRecommendation: {
        recommendedProvider: 'vertex-video',
        recommendedModel: 'veo-2',
        reasoning: 'Best fit',
        estimatedDifficulty: 'medium',
        suggestedDuration: 10,
        confidence: 0.85,
      },
      overallConfidence: 0.91,
    };

    const result = validateGeminiOutput(GeminiEnhancementResultSchema, valid);
    expect(result.overallConfidence).toBe(0.91);
    expect(result.shotEnhancement.enhancedPrompt).toBe('Cinematic shot');
  });
});

describe('Fake Gemini Transport', () => {
  let transport: FakeGeminiTransport;

  beforeEach(() => {
    transport = new FakeGeminiTransport();
  });

  it('should return cached responses', async () => {
    const customResponse = { custom: 'cached' };
    // Set a response that doesn't match default patterns
    const prompt = 'completely custom prompt with unique keywords xyz123';
    const key = Buffer.from(prompt).toString('base64').substring(0, 16);
    transport.setResponse(key, customResponse);

    const result = await transport.call(prompt, {});
    expect(result).toEqual(customResponse);
  });

  it('should return deterministic response for enhancement prompt', async () => {
    const result = await transport.call('Please enhance this prompt', {});
    expect(result).toHaveProperty('enhancedPrompt');
    expect(result).toHaveProperty('negativePrompt');
    expect(result).toHaveProperty('confidence');
  });

  it('should return deterministic response for continuity prompt', async () => {
    const result = await transport.call('continuity context', {});
    expect(result).toHaveProperty('continuityConstraints');
    expect(result).toHaveProperty('characterAppearanceNotes');
  });

  it('should return deterministic response for provider recommendation', async () => {
    const result = await transport.call('provider recommendation', {});
    expect(result).toHaveProperty('recommendedProvider');
    expect(result).toHaveProperty('recommendedModel');
  });
});

describe('Gemini Service', () => {
  let service: GeminiService;

  beforeEach(() => {
    service = createTestGeminiService();
  });

  it('should enhance shot prompt', async () => {
    const result = await service.enhanceShotPrompt('A person walking');
    expect(result.enhancedPrompt).toBeDefined();
    expect(result.negativePrompt).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reasoning).toBeDefined();
  });

  it('should generate continuity prompt', async () => {
    const result = await service.generateContinuityPrompt(
      'Character has dark hair',
      'Character enters office'
    );
    expect(result.continuityConstraints).toBeDefined();
    expect(Array.isArray(result.continuityConstraints)).toBe(true);
    expect(result.characterAppearanceNotes).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should refine visual description', async () => {
    const result = await service.refineVisualDescription(
      'A dramatic scene',
      'Cinematic realism'
    );
    expect(result.refinedDescription).toBeDefined();
    expect(result.cinematicNotes).toBeDefined();
    expect(result.colorPalette).toBeDefined();
    expect(result.visualStyle).toBeDefined();
  });

  it('should generate negative prompt', async () => {
    const result = await service.generateNegativePrompt('A beautiful landscape', [
      'artifacts',
      'blur',
    ]);
    expect(result.negativePrompt).toBeDefined();
    expect(result.reasoning).toBeDefined();
    expect(Array.isArray(result.commonMistakes)).toBe(true);
  });

  it('should recommend provider', async () => {
    const result = await service.recommendProvider('Complex multi-character scene', 'hard');
    expect(result.recommendedProvider).toBeDefined();
    expect(['mock', 'gemini-image', 'vertex-video']).toContain(
      result.recommendedProvider
    );
    expect(result.recommendedModel).toBeDefined();
    expect(['easy', 'medium', 'hard']).toContain(result.estimatedDifficulty);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should perform comprehensive shot enhancement', async () => {
    const result = await service.enhanceShot(
      'A person walking through a modern office',
      'Character: Marcus, billionaire, confident demeanor',
      'Cinematic drama'
    );

    expect(result.shotEnhancement).toBeDefined();
    expect(result.continuityPrompt).toBeDefined();
    expect(result.visualRefinement).toBeDefined();
    expect(result.negativePrompt).toBeDefined();
    expect(result.generationRecommendation).toBeDefined();
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);
  });

  it('should validate all enhancement components', async () => {
    const result = await service.enhanceShot(
      'Test shot',
      'Test memory',
      'Test style'
    );

    // Verify each component has required fields
    expect(result.shotEnhancement.confidence).toBeGreaterThan(0);
    expect(result.continuityPrompt.confidence).toBeGreaterThan(0);
    expect(result.visualRefinement.confidence).toBeGreaterThan(0);
    expect(result.negativePrompt.confidence).toBeGreaterThan(0);
    expect(result.generationRecommendation.confidence).toBeGreaterThan(0);
  });
});
