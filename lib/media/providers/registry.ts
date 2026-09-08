import { GeminiImageProvider } from '../adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '../adapters/vertex-ai-video-provider';
import { providerError } from './errors';
import { MockMediaProvider } from './mock-provider';
import {
  PROVIDER_IDS,
  ProviderErrorCode,
  type ConfigValidationResult,
  type IProviderRegistry,
  type MediaProvider,
  type ProviderConfig,
  type ProviderId,
  type ProviderInfo,
} from './types';

type ProviderFactory = (config: ProviderConfig) => MediaProvider;

const PROVIDERS: ReadonlyMap<ProviderId, ProviderInfo> = new Map([
  ['mock', {
    id: 'mock', name: 'Mock Provider', description: 'Deterministic local and test provider', configRequired: [],
    capabilities: new MockMediaProvider().capabilities,
  }],
  ['gemini-image', {
    id: 'gemini-image', name: 'Google Gemini Image', description: 'Synchronous Gemini image generation through generateContent', configRequired: ['apiKey', 'imageModel'],
    capabilities: {
      imageGeneration: true, videoGeneration: false, imageMasking: false, imageInpainting: false, imageOutpainting: false, videoExtension: false, imageToVideo: false,
      synchronous: true, asyncWithPolling: false, cancellation: false, costEstimation: true, requestValidation: true,
      supportedAspectRatios: ['9:16', '16:9', '1:1'], supportedResolutions: { min: 512, max: 4096 },
      supportedModels: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image'],
    },
  }],
  ['vertex-video', {
    id: 'vertex-video', name: 'Google Vertex AI Video', description: 'Asynchronous Veo text-to-video generation through Vertex AI', configRequired: ['projectId', 'location', 'outputStorageUri', 'videoModel'],
    capabilities: {
      imageGeneration: false, videoGeneration: true, videoExtension: false, imageToVideo: false,
      synchronous: false, asyncWithPolling: true, cancellation: false, costEstimation: true, requestValidation: true,
      supportedAspectRatios: ['9:16', '16:9'], supportedDurations: { min: 4, max: 8 }, supportedResolutions: { min: 720, max: 1080 },
      supportedModels: ['veo-2.0-generate-001', 'veo-3.0-generate-001', 'veo-3.0-fast-generate-001', 'veo-3.1-generate-001', 'veo-3.1-fast-generate-001'],
    },
  }],
]);

export class ProviderRegistry implements IProviderRegistry {
  private readonly instances = new Map<ProviderId, MediaProvider>();
  private readonly factories: Record<ProviderId, ProviderFactory>;

  constructor(factories: Partial<Record<ProviderId, ProviderFactory>> = {}) {
    this.factories = {
      mock: () => new MockMediaProvider(),
      'gemini-image': (config) => new GeminiImageProvider(config.apiKey, undefined, config.imageModel, config.endpoint),
      'vertex-video': (config) => new VertexAIVideoProvider(config.projectId, config.location, config.outputStorageUri, undefined, config.videoModel, config.endpoint),
      ...factories,
    };
  }

  resolve(providerId: string, config: ProviderConfig): MediaProvider {
    const validation = this.validateConfig(providerId, config);
    if (!validation.valid) throw providerError(ProviderErrorCode.ConfigurationError, `Provider configuration is invalid: ${validation.errors.join('; ')}`);
    const id = providerId as ProviderId;
    const cached = this.instances.get(id);
    if (cached) return cached;
    const provider = this.factories[id](config);
    this.instances.set(id, provider);
    return provider;
  }

  listAvailable(): ProviderInfo[] {
    return PROVIDER_IDS.map((id) => structuredClone(PROVIDERS.get(id)!));
  }

  validateConfig(providerId: string, config: ProviderConfig): ConfigValidationResult {
    const info = PROVIDERS.get(providerId as ProviderId);
    if (!info) return { valid: false, errors: [`Unknown provider: ${providerId}`], warnings: [] };
    const errors = info.configRequired.filter((key) => !config[key]?.trim()).map((key) => `Missing required config: ${String(key)}`);
    const warnings: string[] = [];
    const model = providerId === 'gemini-image' ? config.imageModel : providerId === 'vertex-video' ? config.videoModel : undefined;
    if (model && !info.capabilities.supportedModels?.includes(model)) errors.push(`Unsupported model for ${providerId}`);
    if (config.endpoint && (!config.endpoint.startsWith('https://') || !config.endpoint.includes('googleapis.com'))) errors.push('Provider endpoint must be an HTTPS googleapis.com URL');
    if (providerId === 'vertex-video' && config.outputStorageUri && !config.outputStorageUri.startsWith('gs://')) errors.push('Vertex output storage URI must use gs://');
    return { valid: errors.length === 0, errors, warnings };
  }

  isAvailable(providerId: string): boolean { return PROVIDERS.has(providerId as ProviderId) }
  getProviderInfo(providerId: string): ProviderInfo | null { const value = PROVIDERS.get(providerId as ProviderId); return value ? structuredClone(value) : null }

  getDefaultProviderId(): ProviderId {
    const configured = process.env.MEDIA_PROVIDER;
    if (configured && PROVIDERS.has(configured as ProviderId)) return configured as ProviderId;
    if (process.env.NODE_ENV === 'test') return 'mock';
    throw providerError(ProviderErrorCode.ConfigurationError, 'MEDIA_PROVIDER must be configured explicitly');
  }
}

export const createProviderRegistry = (): ProviderRegistry => new ProviderRegistry();
export const globalProviderRegistry = createProviderRegistry();
