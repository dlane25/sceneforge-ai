import type { VertexVideoTransport } from '../providers/transport';
import { ProductionVertexVideoTransport } from '../providers/google-transport';
import { normalizeProviderError, providerError, ProviderOperationError } from '../providers/errors';
import {
  ProviderErrorCode,
  type MediaProvider,
  type ProviderCapabilities,
  type ProviderGenerationRequest,
  type ProviderJobMetadata,
  type ProviderJobStatus,
} from '../providers/types';

const DEFAULT_MODEL = 'veo-3.1-generate-001';
const SUPPORTED_MODELS = [
  'veo-2.0-generate-001',
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-3.1-generate-001',
  'veo-3.1-fast-generate-001',
];

export class VertexAIVideoProvider implements MediaProvider {
  readonly id = 'vertex-video' as const;
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: false,
    videoGeneration: true,
    videoExtension: false,
    imageToVideo: false,
    synchronous: false,
    asyncWithPolling: true,
    cancellation: false,
    costEstimation: true,
    requestValidation: true,
    supportedAspectRatios: ['9:16', '16:9'],
    supportedDurations: { min: 4, max: 8 },
    supportedResolutions: { min: 720, max: 1080 },
    supportedModels: SUPPORTED_MODELS,
  };

  private readonly transport: VertexVideoTransport;

  constructor(
    projectId?: string,
    location?: string,
    outputStorageUri?: string,
    transport?: VertexVideoTransport,
    private readonly defaultModel = DEFAULT_MODEL,
    endpoint?: string
  ) {
    if (transport) this.transport = transport;
    else if (projectId && location && outputStorageUri) this.transport = new ProductionVertexVideoTransport(projectId, location, outputStorageUri, undefined, undefined, endpoint);
    else throw providerError(ProviderErrorCode.ConfigurationError, 'Vertex video provider configuration is incomplete');
  }

  async generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      const model = request.model || this.defaultModel;
      this.validateVideoRequest(request, model);
      const aspectRatio: '9:16' | '16:9' = request.aspectRatio === '9:16' ? '9:16' : '16:9';
      const portrait = aspectRatio === '9:16';
      const result = await this.transport.submitVideoGeneration({
        prompt: request.prompt!.trim(),
        negativePrompt: request.negativePrompt?.trim() || undefined,
        duration: request.duration!,
        width: request.width || (portrait ? 720 : 1280),
        height: request.height || (portrait ? 1280 : 720),
        aspectRatio,
        model,
        seed: request.seed === undefined ? undefined : this.parseSeed(request.seed),
      });
      const now = new Date();
      return { jobId: result.jobId, provider: this.id, model, status: result.status, estimatedCost: result.estimatedCost, actualCost: result.actualCost, output: result.output, createdAt: now, submittedAt: now, lastUpdated: now, lifecycleMetadata: result.metadata };
    } catch (error) {
      if (error instanceof ProviderOperationError) throw error;
      throw new ProviderOperationError(normalizeProviderError(error));
    }
  }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const result = await this.transport.getVideoGenerationStatus(jobId);
      let normalizedError;
      if (result.errorCode) {
        const code = /POLICY|SAFETY|FILTER/i.test(result.errorCode)
          ? ProviderErrorCode.ContentPolicy
          : /QUOTA/i.test(result.errorCode)
            ? ProviderErrorCode.QuotaExceeded
            : /RATE|RESOURCE_EXHAUSTED/i.test(result.errorCode)
              ? ProviderErrorCode.RateLimited
              : /INVALID/i.test(result.errorCode)
                ? ProviderErrorCode.InvalidRequest
                : ProviderErrorCode.UnknownError;
        normalizedError = normalizeProviderError(providerError(code, result.errorMessage || 'Vertex video operation failed', code === ProviderErrorCode.RateLimited, result.errorCode));
      }
      return { jobId, status: result.status, progress: result.progress, output: result.output, outputUrl: result.output?.uri, actualCost: result.actualCost, error: normalizedError, lastUpdated: new Date(), lifecycleMetadata: result.metadata };
    } catch (error) {
      throw new ProviderOperationError(normalizeProviderError(error));
    }
  }

  async cancelJob(...args: [string]): Promise<ProviderJobStatus> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Vertex Veo predict operations do not expose cancellation');
  }

  async generateImage(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Vertex video provider does not support image generation');
  }

  async generateSpeech(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Vertex video provider does not support speech generation');
  }

  async extendVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Video extension is not enabled by this adapter');
  }

  async imageToVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> {
    void args;
    throw providerError(ProviderErrorCode.UnsupportedCapability, 'Image-to-video is not enabled by this adapter');
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    const model = request.model || this.defaultModel;
    this.validateVideoRequest(request, model);
    const perSecond = model.includes('fast') ? 0.15 : 0.35;
    return Number((request.duration! * perSecond).toFixed(2));
  }

  private validateVideoRequest(request: ProviderGenerationRequest, model: string): void {
    if (request.type !== 'video') throw providerError(ProviderErrorCode.UnsupportedCapability, 'Vertex video provider accepts video requests only');
    if (!request.prompt?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Video prompt is required');
    if (!SUPPORTED_MODELS.includes(model)) throw providerError(ProviderErrorCode.InvalidRequest, 'Requested Vertex video model is not supported');
    if (!['9:16', '16:9'].includes(request.aspectRatio || '16:9')) throw providerError(ProviderErrorCode.InvalidRequest, 'Vertex video aspect ratio must be 9:16 or 16:9');
    const duration = request.duration;
    if (!Number.isInteger(duration)) throw providerError(ProviderErrorCode.InvalidRequest, 'Video duration must be a whole number of seconds');
    const allowed = model.startsWith('veo-2') ? [5, 6, 7, 8] : [4, 6, 8];
    if (!allowed.includes(duration!)) throw providerError(ProviderErrorCode.InvalidRequest, `Video duration is not supported by ${model}`);
  }

  private parseSeed(value: string): number {
    const seed = Number(value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) throw providerError(ProviderErrorCode.InvalidRequest, 'Video seed must be an unsigned 32-bit integer');
    return seed;
  }
}
