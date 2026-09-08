import type { GeminiImageTransport } from '../providers/transport';
import { ProductionGeminiImageTransport } from '../providers/google-transport';
import { normalizeProviderError, providerError, ProviderOperationError } from '../providers/errors';
import {
  ProviderErrorCode,
  type MediaProvider,
  type ProviderCapabilities,
  type ProviderGenerationRequest,
  type ProviderJobMetadata,
  type ProviderJobStatus,
} from '../providers/types';

const DEFAULT_MODEL = 'gemini-3.1-flash-image';
const SUPPORTED_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image'];

export class GeminiImageProvider implements MediaProvider {
  readonly id = 'gemini-image' as const;
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: true,
    imageMasking: false,
    imageInpainting: false,
    imageOutpainting: false,
    videoGeneration: false,
    videoExtension: false,
    imageToVideo: false,
    synchronous: true,
    asyncWithPolling: false,
    cancellation: false,
    costEstimation: true,
    requestValidation: true,
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportedResolutions: { min: 512, max: 4096 },
    supportedModels: SUPPORTED_MODELS,
  };

  private readonly transport: GeminiImageTransport;

  constructor(apiKey?: string, transport?: GeminiImageTransport, private readonly defaultModel = DEFAULT_MODEL, endpoint?: string) {
    if (transport) this.transport = transport;
    else if (apiKey) this.transport = new ProductionGeminiImageTransport(apiKey, undefined, endpoint);
    else throw providerError(ProviderErrorCode.ConfigurationError, 'Gemini image provider configuration is incomplete');
  }

  async generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      this.validateImageRequest(request);
      const width = this.normalizeResolution(request.width || 1024);
      const height = this.normalizeResolution(request.height || 1024);
      const model = request.model || this.defaultModel;
      if (!SUPPORTED_MODELS.includes(model)) throw providerError(ProviderErrorCode.InvalidRequest, 'Requested Gemini image model is not supported');
      const result = await this.transport.submitImageGeneration({
        prompt: request.prompt!.trim(),
        negativePrompt: request.negativePrompt?.trim() || undefined,
        width,
        height,
        aspectRatio: request.aspectRatio || '1:1',
        model,
      });
      const now = new Date();
      return {
        jobId: result.jobId,
        provider: this.id,
        model,
        status: result.status,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        output: result.output,
        createdAt: now,
        submittedAt: now,
        lastUpdated: now,
        lifecycleMetadata: result.metadata,
      };
    } catch (error) {
      if (error instanceof ProviderOperationError) throw error;
      throw new ProviderOperationError(normalizeProviderError(error));
    }
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const result = await this.transport.getImageGenerationStatus(jobId);
      const error = result.errorCode
        ? normalizeProviderError(providerError(
            result.errorCode.includes('POLICY') ? ProviderErrorCode.ContentPolicy : ProviderErrorCode.UnknownError,
            result.errorMessage || 'Gemini image operation failed',
            false,
            result.errorCode
          ))
        : undefined;
      return { jobId, status: result.status, progress: result.progress, output: result.output, outputUrl: result.output?.uri, actualCost: result.actualCost, error, lastUpdated: new Date(), lifecycleMetadata: result.metadata };
    } catch (error) {
      throw new ProviderOperationError(normalizeProviderError(error));
    }
  }

  async cancelJob(...args: [string]): Promise<ProviderJobStatus> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image generation does not support cancellation');
  }

  async generateVideo(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image provider does not support video generation');
  }

  async generateSpeech(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image provider does not support speech generation');
  }

  async extendVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image provider does not support video extension');
  }

  async imageToVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image provider does not support image-to-video generation');
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    this.validateImageRequest(request);
    const megaPixels = (this.normalizeResolution(request.width || 1024) * this.normalizeResolution(request.height || 1024)) / 1_000_000;
    return Number((megaPixels * 0.04).toFixed(4));
  }

  private validateImageRequest(request: ProviderGenerationRequest): void {
    if (request.type !== 'image') throw providerError(ProviderErrorCode.UnsupportedCapability, 'Gemini image provider accepts image requests only');
    if (!request.prompt?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Image prompt is required');
    if (!['9:16', '16:9', '1:1'].includes(request.aspectRatio || '1:1')) throw providerError(ProviderErrorCode.InvalidRequest, 'Image aspect ratio is not supported');
  }

  private normalizeResolution(value: number): number {
    if (!Number.isFinite(value) || value <= 0) throw providerError(ProviderErrorCode.InvalidRequest, 'Image resolution must be a positive number');
    return Math.max(512, Math.min(4096, Math.round(value)));
  }
}
