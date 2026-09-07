/**
 * Vertex AI Video Provider Adapter
 * Production adapter for Google Vertex AI video generation (Veo 2)
 * 
 * Uses injectable transport for real/fake API calls.
 * Production: Uses ProductionVertexVideoTransport (builds real API requests)
 * Testing: Uses FakeVertexVideoTransport (deterministic, no network calls)
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
import type { VertexVideoTransport } from '../providers/transport';
import { FakeVertexVideoTransport } from '../providers/transport';
import { ProductionVertexVideoTransport } from '../providers/google-transport';

export class VertexAIVideoProvider implements MediaProvider {
  readonly id = 'vertex-video';
  readonly capabilities: ProviderCapabilities = {
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
  };

  private transport: VertexVideoTransport;

  constructor(
    projectId?: string,
    location?: string,
    credentials?: unknown,
    transport?: VertexVideoTransport
  ) {
    if (transport) {
      this.transport = transport;
    } else if (process.env.NODE_ENV === 'test') {
      this.transport = new FakeVertexVideoTransport();
    } else if (projectId && location) {
      this.transport = new ProductionVertexVideoTransport(projectId, location, credentials);
    } else {
      throw new Error('VertexAIVideoProvider requires projectId and location, or a transport');
    }
  }

  async generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      if (request.type !== 'video') {
        throw new Error('VertexAIVideoProvider only supports video generation');
      }

      const duration = this.validateDuration(request.duration || 5);
      const width = this.parseResolution(request.width || 1280);
      const height = this.parseResolution(request.height || 720);

      const result = await this.transport.submitVideoGeneration({
        prompt: request.prompt || '',
        negativePrompt: request.negativePrompt,
        duration,
        width,
        height,
        model: request.model || 'veo-2',
      });

      return {
        jobId: result.jobId,
        provider: this.id,
        model: request.model || 'veo-2',
        status: 'queued',
        estimatedCost: result.estimatedCost,
        createdAt: new Date(),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async extendVideo(jobId: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    return this.generateVideo({
      ...request,
      type: 'video',
      prompt: `Extend the previous video: ${request.prompt || ''}`,
    });
  }

  async generateImage(_request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    throw new Error(
      `Provider ${this.id} does not support image generation. Use supported capabilities only.`
    );
  }

  async imageToVideo(_imageUri: string, _request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    throw new Error(
      `Provider ${this.id} does not support image-to-video. Use supported capabilities only.`
    );
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const result = await this.transport.getVideoGenerationStatus(jobId);

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
    try {
      await this.transport.cancelVideoGeneration(jobId);
      return {
        jobId,
        status: 'cancelled',
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    const model = request.model || 'veo-2';
    const duration = this.validateDuration(request.duration || 5);
    const width = this.parseResolution(request.width || 1280);
    const height = this.parseResolution(request.height || 720);

    // Vertex Veo 2: $0.50 per minute base + resolution/model multipliers
    const durationCost = (duration / 60) * 0.50;
    const resolutionMultiplier = (width * height) / (1920 * 1080);
    const modelMultiplier = model === 'veo-2' ? 1.5 : 1.0;

    const totalCost = durationCost * resolutionMultiplier * modelMultiplier;
    return Math.round(totalCost * 100);
  }

  private validateDuration(duration: number): number {
    return Math.max(1, Math.min(120, duration));
  }

  private parseResolution(value: number): number {
    const clamped = Math.max(480, Math.min(1920, value));
    return Math.round(clamped / 16) * 16;
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
    } else if (code === 'INVALID_REQUEST') {
      providerErrorCode = ProviderErrorCode.InvalidRequest;
    } else if (code === 'NOT_FOUND') {
      providerErrorCode = ProviderErrorCode.UnknownError;
    }

    return {
      code: providerErrorCode,
      message: message || `Vertex AI provider error: ${code}`,
      retryable,
      timestamp: new Date(),
      providerCode: code,
    };
  }

  private normalizeError(error: unknown): NormalizedProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('credentials') || message.includes('auth')) {
        return {
          code: ProviderErrorCode.AuthenticationError,
          message: 'Authentication failed with Vertex AI provider',
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
      message: 'Unknown error from Vertex AI provider',
      retryable: false,
      timestamp: new Date(),
    };
  }
}
