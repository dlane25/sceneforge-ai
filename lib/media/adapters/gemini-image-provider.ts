/**
 * Gemini Image Provider Adapter
 * Production adapter for Google Gemini image generation
 * 
 * Uses injectable transport for real/fake API calls.
 * Production: Uses ProductionGeminiImageTransport (builds real API requests)
 * Testing: Uses FakeGeminiImageTransport (deterministic, no network calls)
 */

import type {
  MediaProvider,
  ProviderCapabilities,
  ProviderGenerationRequest,
  ProviderJobMetadata,
  ProviderJobStatus,
  NormalizedProviderError,
} from '../providers/types';
import { ProviderErrorCode } from '../providers/types';
import type { GeminiImageTransport } from '../providers/transport';
import { FakeGeminiImageTransport } from '../providers/transport';
import { ProductionGeminiImageTransport } from '../providers/google-transport';

export class GeminiImageProvider implements MediaProvider {
  readonly id = 'gemini-image';
  readonly capabilities: ProviderCapabilities = {
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
  };

  private transport: GeminiImageTransport;

  constructor(apiKey?: string, transport?: GeminiImageTransport) {
    if (transport) {
      this.transport = transport;
    } else if (process.env.NODE_ENV === 'test') {
      this.transport = new FakeGeminiImageTransport();
    } else if (apiKey) {
      this.transport = new ProductionGeminiImageTransport(apiKey);
    } else {
      throw new Error('GeminiImageProvider requires either transport or apiKey');
    }
  }

  async generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      if (request.type !== 'image') {
        throw new Error('GeminiImageProvider only supports image generation');
      }

      const width = this.parseResolution(request.width || 1024);
      const height = this.parseResolution(request.height || 1024);

      const result = await this.transport.submitImageGeneration({
        prompt: request.prompt || '',
        negativePrompt: request.negativePrompt,
        width,
        height,
        model: request.model || 'gemini-2.0-flash',
      });

      return {
        jobId: result.jobId,
        provider: this.id,
        model: request.model || 'gemini-2.0-flash',
        status: 'queued',
        estimatedCost: result.estimatedCost,
        createdAt: new Date(),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async generateVideo(_request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    throw new Error(
      `Provider ${this.id} does not support video generation. Use supported capabilities only.`
    );
  }

  async extendVideo(_jobId: string, _request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    throw new Error(
      `Provider ${this.id} does not support video extension. Use supported capabilities only.`
    );
  }

  async imageToVideo(_imageUri: string, _request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    throw new Error(
      `Provider ${this.id} does not support image-to-video. Use supported capabilities only.`
    );
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const result = await this.transport.getImageGenerationStatus(jobId);

      let normalizedError: NormalizedProviderError | undefined;
      if (result.errorCode) {
        normalizedError = this.normalizeProviderError(result.errorCode, result.errorMessage);
      }

      return {
        jobId,
        status: result.status as 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled',
        outputUrl: result.outputUrl,
        actualCost: result.actualCost,
        error: normalizedError,
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async cancelJob(jobId: string): Promise<ProviderJobStatus> {
    throw new Error(
      `Provider ${this.id} does not support job cancellation`
    );
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    const model = request.model || 'gemini-2.0-flash';
    const width = this.parseResolution(request.width || 1024);
    const height = this.parseResolution(request.height || 1024);
    
    // Gemini pricing: $0.01 per mega-pixel
    const megaPixels = (width * height) / 1_000_000;
    const baseCost = model === 'gemini-2.0-flash' ? 0.01 : 0.015;
    return Math.round(megaPixels * baseCost * 100);
  }

  private parseResolution(value: number): number {
    const clamped = Math.max(256, Math.min(2048, value));
    return Math.round(clamped / 256) * 256;
  }

  private normalizeProviderError(code: string, message?: string): NormalizedProviderError {
    let providerErrorCode = ProviderErrorCode.UnknownError;
    let retryable = false;

    if (code.includes('QUOTA') || code.includes('RATE_LIMIT')) {
      providerErrorCode = ProviderErrorCode.RateLimited;
      retryable = true;
    } else if (code.includes('AUTH') || code.includes('PERMISSION')) {
      providerErrorCode = ProviderErrorCode.AuthenticationError;
    } else if (code.includes('CONTENT') || code.includes('POLICY')) {
      providerErrorCode = ProviderErrorCode.ContentPolicy;
    } else if (code === 'TIMEOUT') {
      providerErrorCode = ProviderErrorCode.ProviderTimeout;
      retryable = true;
    } else if (code === 'NOT_FOUND') {
      providerErrorCode = ProviderErrorCode.UnknownError;
    }

    return {
      code: providerErrorCode,
      message: message || `Gemini provider error: ${code}`,
      retryable,
      timestamp: new Date(),
      providerCode: code,
    };
  }

  private normalizeError(error: unknown): NormalizedProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('api key') || message.includes('auth')) {
        return {
          code: ProviderErrorCode.AuthenticationError,
          message: 'Authentication failed with Gemini provider',
          retryable: false,
          timestamp: new Date(),
        };
      }
      
      if (message.includes('does not support')) {
        return {
          code: ProviderErrorCode.UnsupportedCapability,
          message: error.message,
          retryable: false,
          timestamp: new Date(),
        };
      }

      return {
        code: ProviderErrorCode.UnknownError,
        message: error.message,
        retryable: false,
        timestamp: new Date(),
      };
    }

    return {
      code: ProviderErrorCode.UnknownError,
      message: 'Unknown error from Gemini provider',
      retryable: false,
      timestamp: new Date(),
    };
  }
}
