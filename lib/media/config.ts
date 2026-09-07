/**
 * Provider Configuration Loader
 * Server-only configuration for media providers
 */

import type { ProviderConfig } from './providers/types';

export interface MediaProviderConfig {
  /** Primary media provider ID (mock, gemini-image, vertex-video) */
  providerId: string;
  /** Provider-specific configuration */
  config: ProviderConfig;
  /** Whether to fail if provider unavailable */
  strict: boolean;
}

export interface GenerationConfig {
  /** Image generation provider ID */
  imageProvider: string;
  /** Video generation provider ID */
  videoProvider: string;
  /** Gemini model name for AI enhancement */
  geminiModel: string;
  /** Provider-specific configuration */
  providers: {
    [providerId: string]: ProviderConfig;
  };
}

/**
 * Load provider configuration from environment
 * Server-side only
 */
export function loadMediaProviderConfig(): MediaProviderConfig {
  if (typeof window !== 'undefined') {
    throw new Error('loadMediaProviderConfig must only be called server-side');
  }

  const providerId = process.env.MEDIA_PROVIDER;
  const strict = process.env.NODE_ENV === 'production';

  // Production must have explicit provider
  if (strict && !providerId) {
    throw new Error(
      'MEDIA_PROVIDER environment variable required in production. Set to: mock, gemini-image, or vertex-video'
    );
  }

  const finalProviderId = providerId || 'mock';

  const config: ProviderConfig = {
    apiKey: process.env.MEDIA_PROVIDER_API_KEY,
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
    endpoint: process.env.MEDIA_PROVIDER_ENDPOINT,
  };

  // Validate production configuration
  if (strict && finalProviderId !== 'mock') {
    const errors: string[] = [];

    if (finalProviderId === 'gemini-image' && !config.apiKey) {
      errors.push('MEDIA_PROVIDER_API_KEY required for gemini-image provider');
    }

    if (finalProviderId === 'vertex-video') {
      if (!config.projectId) errors.push('GOOGLE_CLOUD_PROJECT required for vertex-video provider');
      if (!config.location) errors.push('GOOGLE_CLOUD_LOCATION required for vertex-video provider');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid production provider configuration:\n${errors.join('\n')}`);
    }
  }

  return { providerId: finalProviderId, config, strict };
}

/**
 * Load generation configuration
 */
export function loadGenerationConfig(): GenerationConfig {
  if (typeof window !== 'undefined') {
    throw new Error('loadGenerationConfig must only be called server-side');
  }

  const imageProvider = process.env.IMAGE_PROVIDER || process.env.MEDIA_PROVIDER || 'mock';
  const videoProvider = process.env.VIDEO_PROVIDER || process.env.MEDIA_PROVIDER || 'mock';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const providers: { [key: string]: ProviderConfig } = {};

  // Gemini Image
  if (process.env.MEDIA_PROVIDER_API_KEY || process.env.GEMINI_API_KEY) {
    providers['gemini-image'] = {
      apiKey: process.env.MEDIA_PROVIDER_API_KEY || process.env.GEMINI_API_KEY,
    };
  }

  // Vertex Video
  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_LOCATION) {
    providers['vertex-video'] = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
      apiKey: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };
  }

  // Mock
  providers['mock'] = {};

  return {
    imageProvider,
    videoProvider,
    geminiModel,
    providers,
  };
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: MediaProviderConfig): string[] {
  const errors: string[] = [];

  if (!config.providerId) {
    errors.push('Provider ID is required');
  }

  // Production-specific checks
  if (config.strict) {
    if (config.providerId === 'mock') {
      errors.push(
        'Mock provider not allowed in production. Set MEDIA_PROVIDER to a production provider.'
      );
    }

    if (config.providerId === 'gemini-image' && !config.config.apiKey) {
      errors.push('Gemini Image provider requires API key in production');
    }

    if (config.providerId === 'vertex-video') {
      if (!config.config.projectId) {
        errors.push('Vertex Video provider requires GOOGLE_CLOUD_PROJECT in production');
      }
      if (!config.config.location) {
        errors.push('Vertex Video provider requires GOOGLE_CLOUD_LOCATION in production');
      }
    }
  }

  return errors;
}
