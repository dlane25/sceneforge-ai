import type { SpeechTransport } from '../providers/transport';
import { ProductionElevenLabsSpeechTransport } from '../providers/elevenlabs-transport';
import { normalizeProviderError, providerError, ProviderOperationError } from '../providers/errors';
import { ProviderErrorCode, type MediaProvider, type ProviderCapabilities, type ProviderGenerationRequest, type ProviderJobMetadata, type ProviderJobStatus } from '../providers/types';

const DEFAULT_MODEL = 'eleven_multilingual_v2';
const SUPPORTED_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];
const SUPPORTED_OUTPUTS = ['mp3_44100_128', 'mp3_44100_192', 'pcm_44100'];

export class ElevenLabsVoiceProvider implements MediaProvider {
  readonly id = 'elevenlabs-voice' as const;
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: false, videoGeneration: false, textToSpeech: true, speechGeneration: true,
    voiceCloning: false, soundEffectsGeneration: false, captionGeneration: false,
    synchronous: true, asyncWithPolling: false, cancellation: false, costEstimation: true, requestValidation: true,
    supportedModels: SUPPORTED_MODELS,
  };
  private readonly transport: SpeechTransport;

  constructor(apiKey?: string, transport?: SpeechTransport, private readonly defaultModel = DEFAULT_MODEL, endpoint?: string) {
    if (transport) this.transport = transport;
    else if (apiKey) this.transport = new ProductionElevenLabsSpeechTransport(apiKey, undefined, endpoint);
    else throw providerError(ProviderErrorCode.ConfigurationError, 'ElevenLabs voice provider configuration is incomplete');
  }

  async generateSpeech(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      this.validate(request);
      const model = request.model || this.defaultModel;
      if (!SUPPORTED_MODELS.includes(model)) throw providerError(ProviderErrorCode.InvalidRequest, 'Requested ElevenLabs model is not supported');
      const outputFormat = request.outputFormat || 'mp3_44100_128';
      if (!SUPPORTED_OUTPUTS.includes(outputFormat)) throw providerError(ProviderErrorCode.InvalidRequest, 'Requested audio output format is not supported');
      const result = await this.transport.submitSpeechGeneration({
        text: request.prompt!.trim(), voiceId: request.voiceId!, model, language: request.language, locale: request.locale,
        stability: request.stability, similarityBoost: request.similarityBoost, styleExaggeration: request.styleExaggeration,
        speakerBoost: request.speakerBoost, outputFormat,
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
      const result = await this.transport.getSpeechGenerationStatus(jobId);
      const error = result.errorCode ? normalizeProviderError(providerError(ProviderErrorCode.UnknownError, result.errorMessage || 'Voice operation failed', false, result.errorCode)) : undefined;
      return { jobId, status: result.status, progress: result.progress, output: result.output, outputUrl: result.output?.uri, actualCost: result.actualCost, error, lastUpdated: new Date(), lifecycleMetadata: result.metadata };
    } catch (error) { throw new ProviderOperationError(normalizeProviderError(error)); }
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> {
    this.validate(request);
    return Number((request.prompt!.length * 0.00003).toFixed(4));
  }

  async cancelJob(...args: [string]): Promise<ProviderJobStatus> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs speech generation is synchronous and cannot be cancelled'); }
  async generateImage(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs voice provider does not support image generation'); }
  async generateVideo(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs voice provider does not support video generation'); }
  async extendVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs voice provider does not support video extension'); }
  async imageToVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs voice provider does not support image-to-video generation'); }

  private validate(request: ProviderGenerationRequest): void {
    if (request.type !== 'audio') throw providerError(ProviderErrorCode.UnsupportedCapability, 'ElevenLabs voice provider accepts audio requests only');
    if (!request.prompt?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Speech text is required');
    if (request.prompt.length > 10_000) throw providerError(ProviderErrorCode.InvalidRequest, 'Speech text exceeds the provider request limit');
    if (!request.voiceId?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Provider voice ID is required');
    for (const value of [request.stability, request.similarityBoost, request.styleExaggeration]) if (value !== undefined && (value < 0 || value > 1)) throw providerError(ProviderErrorCode.InvalidRequest, 'Voice controls must be between 0 and 1');
  }
}
