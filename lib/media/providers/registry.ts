/**
 * Provider Registry Implementation
 * Manages provider resolution, validation, and availability
 */

import {
  type ProviderConfig,
  type ProviderInfo,
  type ConfigValidationResult,
  type IProviderRegistry,
  type MediaProvider,
  type ProviderCapabilities,
  ProviderErrorCode,
} from './types';
import { MockMediaProvider } from './mock-provider';
import { GeminiImageProvider } from '../adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '../adapters/vertex-ai-video-provider';

export class ProviderRegistry implements IProviderRegistry {
  private static readonly REGISTRY: Map<string, ProviderInfo> = new Map([
    [
      'mock',
      {
        id: 'mock',
        name: 'Mock Provider',
        description: 'Deterministic mock provider for testing and development',
        capabilities: {
          imageGeneration: true,
          videoGeneration: true,
          videoExtension: true,
          imageToVideo: true,
          synchronous: false,
          asyncWithPolling: true,
          cancellation: true,
          costEstimation: true,
          supportedAspectRatios: ['9:16', '16:9', '1:1'],
          supportedDurations: { min: 1, max: 300 },
          supportedResolutions: { min: 720, max: 4096 },
          supportedModels: ['mock-v1'],
        },
        configRequired: [],
      },
    ],
    [
      'gemini-image',
      {
        id: 'gemini-image',
        name: 'Google Gemini Image',
        description: 'Google Gemini API for image generation',
        capabilities: {
          imageGeneration: true,
          imageInpainting: true,
          imageOutpainting: true,
          imageMasking: true,
          synchronous: false,
          asyncWithPolling: true,
          cancellation: false,
          costEstimation: true,
          supportedAspectRatios: ['9:16', '16:9', '1:1'],
          supportedResolutions: { min: 256, max: 2048 },
          supportedModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
        },
        configRequired: ['apiKey'],
      },
    ],
    [
      'vertex-video',
      {
        id: 'vertex-video',
        name: 'Google Vertex AI Video',
        description: 'Google Vertex AI for video generation',
        capabilities: {
          videoGeneration: true,
          videoExtension: true,
          synchronous: false,
          asyncWithPolling: true,
          cancellation: true,
          costEstimation: true,
          supportedAspectRatios: ['9:16', '16:9', '1:1'],
          supportedDurations: { min: 1, max: 120 },
          supportedResolutions: { min: 480, max: 1920 },
          supportedModels: ['veo-2', 'veo-1'],
        },
        configRequired: ['projectId', 'location'],
      },
    ],
  ]);

  resolve(providerId: string, config: ProviderConfig): MediaProvider {
    const validation = this.validateConfig(providerId, config);
    if (!validation.valid) {
      throw new Error(`Provider configuration invalid: ${validation.errors.join(', ')}`);
    }

    switch (providerId) {
      case 'mock':
        return new MockMediaProvider();
      case 'gemini-image':
        return new GeminiImageProvider(config.apiKey!);
      case 'vertex-video':
        return new VertexAIVideoProvider(config.projectId!, config.location!, config.apiKey);
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  listAvailable(): ProviderInfo[] {
    return Array.from(ProviderRegistry.REGISTRY.values());
  }

  validateConfig(providerId: string, config: ProviderConfig): ConfigValidationResult {
    const provider = ProviderRegistry.REGISTRY.get(providerId);
    if (!provider) {
      return {
        valid: false,
        errors: [`Unknown provider: ${providerId}`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required config
    for (const required of provider.configRequired) {
      if (!config[required]) {
        errors.push(`Missing required config: ${String(required)}`);
      }
    }

    // Production mode checks
    if (providerId !== 'mock' && process.env.NODE_ENV === 'production') {
      if (!config.apiKey && providerId !== 'vertex-video') {
        errors.push('API key required for production');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  isAvailable(providerId: string): boolean {
    return ProviderRegistry.REGISTRY.has(providerId);
  }

  /**
   * Get provider info by ID
   */
  getProviderInfo(providerId: string): ProviderInfo | null {
    return ProviderRegistry.REGISTRY.get(providerId) || null;
  }

  /**
   * Get default provider for environment
   */
  getDefaultProviderId(): string {
    if (process.env.MEDIA_PROVIDER) {
      return process.env.MEDIA_PROVIDER;
    }
    // Development and test default to mock
    if (process.env.NODE_ENV !== 'production') {
      return 'mock';
    }
    // Production must be explicitly configured
    throw new Error('MEDIA_PROVIDER environment variable required in production');
  }
}

export const createProviderRegistry = (): ProviderRegistry => {
  return new ProviderRegistry();
};

export const globalProviderRegistry = createProviderRegistry();
