/**
 * Gemini AI Adapter Service
 * Server-only production integration and deterministic testing facade
 */

import type {
  ShotEnhancement,
  ContinuityPrompt,
  VisualDescriptionRefinement,
  NegativePromptGeneration,
  GenerationRecommendation,
  GeminiEnhancementResult,
} from './gemini-schemas';
import {
  ShotEnhancementSchema,
  ContinuityPromptSchema,
  VisualDescriptionRefinementSchema,
  NegativePromptGenerationSchema,
  GenerationRecommendationSchema,
  GeminiEnhancementResultSchema,
  validateGeminiOutput,
} from './gemini-schemas';

export interface GeminiServiceConfig {
  apiKey: string;
  model: string;
}

export interface GeminiTransport {
  call(prompt: string, responseSchema: unknown): Promise<unknown>;
}

/**
 * Gemini AI Service
 * Provides structured AI operations with validation
 */
export class GeminiService {
  private apiKey: string;
  private model: string;
  private transport: GeminiTransport;

  constructor(
    apiKey: string,
    model: string = 'gemini-2.0-flash',
    transport?: GeminiTransport
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.transport = transport || new DefaultGeminiTransport(apiKey, model);
  }

  /**
   * Enhance shot prompt with Gemini
   */
  async enhanceShotPrompt(originalPrompt: string): Promise<ShotEnhancement> {
    const prompt = `
You are a film director analyzing a shot description for a vertical (9:16) mobile drama.
Original prompt: ${originalPrompt}

Provide an enhanced version with:
1. More vivid, cinematic visual details
2. A negative prompt describing what NOT to generate
3. Your confidence (0-1)
4. Brief reasoning

Return ONLY a JSON object matching:
{
  "enhancedPrompt": "...",
  "negativePrompt": "...",
  "confidence": 0.95,
  "reasoning": "..."
}
`;
    const result = await this.transport.call(prompt, ShotEnhancementSchema);
    return validateGeminiOutput(ShotEnhancementSchema, result);
  }

  /**
   * Generate continuity constraints from Series Memory facts
   */
  async generateContinuityPrompt(
    seriesMemoryContext: string,
    shotDescription: string
  ): Promise<ContinuityPrompt> {
    const prompt = `
You are a continuity specialist for a TV series in production.

Series Memory Context:
${seriesMemoryContext}

Current Shot:
${shotDescription}

Based on this context, provide continuity constraints:
1. Visual constraints to maintain series continuity
2. Character appearance details
3. Location visual notes  
4. Timeline context
5. Your confidence (0-1)

Return ONLY a JSON object matching:
{
  "continuityConstraints": ["...", "..."],
  "characterAppearanceNotes": "...",
  "locationVisualNotes": "...",
  "timelineContext": "...",
  "confidence": 0.9
}
`;
    const result = await this.transport.call(prompt, ContinuityPromptSchema);
    return validateGeminiOutput(ContinuityPromptSchema, result);
  }

  /**
   * Refine visual description with cinematic guidance
   */
  async refineVisualDescription(
    description: string,
    style: string
  ): Promise<VisualDescriptionRefinement> {
    const prompt = `
You are a cinematographer providing visual guidance for a mobile drama production.

Description: ${description}
Visual Style: ${style}

Provide cinematographic refinement:
1. Refined visual description (vivid, specific)
2. Cinematic direction notes
3. Recommended color palette
4. Visual style guidance
5. Confidence (0-1)

Return ONLY a JSON object matching:
{
  "refinedDescription": "...",
  "cinematicNotes": "...",
  "colorPalette": "...",
  "visualStyle": "...",
  "confidence": 0.9
}
`;
    const result = await this.transport.call(prompt, VisualDescriptionRefinementSchema);
    return validateGeminiOutput(VisualDescriptionRefinementSchema, result);
  }

  /**
   * Generate negative prompt from constraints
   */
  async generateNegativePrompt(
    positivePrompt: string,
    constraints: string[]
  ): Promise<NegativePromptGeneration> {
    const prompt = `
You are a prompt engineer optimizing video generation requests.

Positive Prompt: ${positivePrompt}
Must Avoid: ${constraints.join(', ')}

Generate a negative prompt that:
1. Describes what NOT to generate
2. Lists common mistakes to avoid
3. Explains your reasoning
4. Provides confidence (0-1)

Return ONLY a JSON object matching:
{
  "negativePrompt": "...",
  "reasoning": "...",
  "commonMistakes": ["...", "..."],
  "confidence": 0.9
}
`;
    const result = await this.transport.call(prompt, NegativePromptGenerationSchema);
    return validateGeminiOutput(NegativePromptGenerationSchema, result);
  }

  /**
   * Recommend provider and model for generation
   */
  async recommendProvider(
    shotDescription: string,
    difficulty: string
  ): Promise<GenerationRecommendation> {
    const prompt = `
You are advising on video generation provider selection.

Shot Description: ${shotDescription}
Estimated Difficulty: ${difficulty}

Available Providers:
- mock: Deterministic testing provider
- gemini-image: Google Gemini image generation
- vertex-video: Google Vertex AI video (Veo 2)

Recommend:
1. Best provider for this shot
2. Best model for the provider
3. Why this combination
4. Estimated difficulty (easy/medium/hard)
5. Suggested duration if video (1-120 seconds)
6. Confidence (0-1)

Return ONLY a JSON object matching:
{
  "recommendedProvider": "vertex-video",
  "recommendedModel": "veo-2",
  "reasoning": "...",
  "estimatedDifficulty": "medium",
  "suggestedDuration": 10,
  "confidence": 0.85
}
`;
    const result = await this.transport.call(prompt, GenerationRecommendationSchema);
    return validateGeminiOutput(GenerationRecommendationSchema, result);
  }

  /**
   * Perform comprehensive shot enhancement
   */
  async enhanceShot(
    shotDescription: string,
    seriesMemoryContext: string,
    style: string
  ): Promise<GeminiEnhancementResult> {
    const [enhancement, continuity, visual, negative, recommendation] = await Promise.all([
      this.enhanceShotPrompt(shotDescription),
      this.generateContinuityPrompt(seriesMemoryContext, shotDescription),
      this.refineVisualDescription(shotDescription, style),
      this.generateNegativePrompt(shotDescription, ['artifacts', 'blurry', 'low quality']),
      this.recommendProvider(shotDescription, 'medium'),
    ]);

    const result: GeminiEnhancementResult = {
      shotEnhancement: enhancement,
      continuityPrompt: continuity,
      visualRefinement: visual,
      negativePrompt: negative,
      generationRecommendation: recommendation,
      overallConfidence:
        (enhancement.confidence +
          continuity.confidence +
          visual.confidence +
          negative.confidence +
          recommendation.confidence) /
        5,
    };

    return validateGeminiOutput(GeminiEnhancementResultSchema, result);
  }
}

/**
 * Default Gemini transport (stub for real API calls)
 * In production, this would call the actual Gemini API
 * In tests, use a fake transport
 */
export class DefaultGeminiTransport implements GeminiTransport {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async call(_prompt: string, _responseSchema: unknown): Promise<unknown> {
    // TODO: Implement real Gemini API call
    // This is a stub that would normally:
    // 1. Call Gemini API with structured output mode
    // 2. Validate response against schema
    // 3. Return parsed result

    throw new Error('DefaultGeminiTransport not yet implemented. Use a fake transport for testing.');
  }
}

/**
 * Fake/deterministic Gemini transport for testing
 */
export class FakeGeminiTransport implements GeminiTransport {
  private responses: Map<string, unknown> = new Map();

  setResponse(key: string, response: unknown): void {
    this.responses.set(key, response);
  }

  async call(prompt: string, _responseSchema: unknown): Promise<unknown> {
    const key = Buffer.from(prompt).toString('base64').substring(0, 16);
    const cached = this.responses.get(key);

    if (cached) {
      return cached;
    }

    // Return deterministic fake responses based on prompt content
    if (prompt.includes('enhance')) {
      return {
        enhancedPrompt: 'A cinematic shot with dramatic lighting and composition',
        negativePrompt: 'blurry, low quality, artifacts',
        confidence: 0.95,
        reasoning: 'Enhanced for cinematic impact',
      };
    }

    if (prompt.includes('continuity')) {
      return {
        continuityConstraints: ['Character must wear red jacket', 'Scene must be in office'],
        characterAppearanceNotes: 'Dark hair, professional attire',
        locationVisualNotes: 'Modern office with glass windows',
        timelineContext: 'Morning scene in present day',
        confidence: 0.9,
      };
    }

    if (prompt.includes('visual')) {
      return {
        refinedDescription: 'A stunning establishing shot with rich colors',
        cinematicNotes: 'Use 24mm lens equivalent for depth',
        colorPalette: 'Warm golds and deep blues',
        visualStyle: 'Cinematic realism',
        confidence: 0.9,
      };
    }

    if (prompt.includes('negative')) {
      return {
        negativePrompt: 'no artifacts, no blur, no watermark, low quality',
        reasoning: 'These are common video generation failures',
        commonMistakes: ['Distorted faces', 'Unnatural movements', 'Color banding'],
        confidence: 0.95,
      };
    }

    if (prompt.includes('provider')) {
      return {
        recommendedProvider: 'vertex-video',
        recommendedModel: 'veo-2',
        reasoning: 'Complex scene with multiple characters requires advanced model',
        estimatedDifficulty: 'medium',
        suggestedDuration: 10,
        confidence: 0.85,
      };
    }

    // Default response
    return {
      result: 'processed',
      confidence: 0.5,
    };
  }
}

/**
 * Create Gemini service with fake transport for testing
 */
export function createTestGeminiService(): GeminiService {
  return new GeminiService('test-key', 'gemini-2.0-flash', new FakeGeminiTransport());
}

/**
 * Create Gemini service with real API (for production, requires real API key)
 */
export function createGeminiService(
  apiKey: string,
  model: string = 'gemini-2.0-flash'
): GeminiService {
  return new GeminiService(apiKey, model);
}
