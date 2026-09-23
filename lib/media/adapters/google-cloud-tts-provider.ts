import 'server-only';

import { GoogleCloudPrivateMediaStore } from '@/lib/storage/google-cloud-media-storage';
import { parseGcsUri } from '@/lib/storage/gcs';
import type { SpeechTransport } from '../providers/transport';
import { ProductionGoogleCloudTtsTransport, validateChirpVoice } from '../providers/google-tts-transport';
import { normalizeProviderError, providerError, ProviderOperationError } from '../providers/errors';
import { ProviderErrorCode, type MediaProvider, type ProviderCapabilities, type ProviderConfig, type ProviderCostEstimate, type ProviderGenerationRequest, type ProviderJobMetadata, type ProviderJobStatus } from '../providers/types';

const MODEL = 'chirp-3-hd';
const OUTPUT_FORMAT = 'MP3';
const MAX_TEXT_BYTES = 5_000;

export class GoogleCloudTtsProvider implements MediaProvider {
  readonly id = 'google-cloud-tts' as const;
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: false, videoGeneration: false, textToSpeech: true, speechGeneration: true,
    voiceCloning: false, soundEffectsGeneration: false, captionGeneration: false,
    synchronous: true, asyncWithPolling: false, cancellation: false, costEstimation: true, requestValidation: true,
    supportedModels: [MODEL],
  };
  private readonly transport: SpeechTransport;
  private readonly pricePerMillionCharacters: number;
  private readonly pricingVersion: string;

  constructor(private readonly config: ProviderConfig, transport?: SpeechTransport) {
    const price = Number(config.pricePerMillionCharacters);
    if (!Number.isFinite(price) || price < 0) throw providerError(ProviderErrorCode.ConfigurationError, 'Google Cloud TTS character pricing is invalid');
    if (!config.pricingVersion?.trim()) throw providerError(ProviderErrorCode.ConfigurationError, 'Google Cloud TTS pricing version is required');
    this.pricePerMillionCharacters = price;
    this.pricingVersion = config.pricingVersion;
    if (transport) this.transport = transport;
    else {
      if (!config.outputStorageUri) throw providerError(ProviderErrorCode.ConfigurationError, 'Google Cloud TTS media storage is required');
      const store = new GoogleCloudPrivateMediaStore(parseGcsUri(config.outputStorageUri.replace(/\/+$/, '')));
      this.transport = new ProductionGoogleCloudTtsTransport(store, undefined, undefined, config.endpoint);
    }
  }

  async generateSpeech(request: ProviderGenerationRequest): Promise<ProviderJobMetadata> {
    try {
      this.validate(request, true);
      const result = await this.transport.submitSpeechGeneration({
        text: request.prompt!.trim(), voiceId: request.voiceId!, model: MODEL, language: request.language,
        locale: request.locale, outputFormat: OUTPUT_FORMAT, operationId: request.operationId,
      });
      const cost = await this.estimateCostDetails(request);
      const now = new Date();
      return {
        jobId: result.jobId, provider: this.id, model: MODEL, status: result.status,
        estimatedCost: cost.amount, actualCost: cost.amount, output: result.output,
        createdAt: now, submittedAt: now, lastUpdated: now,
        lifecycleMetadata: { ...result.metadata, costAccounting: { ...cost, billingSource: 'calculated-configured-rate' } },
      };
    } catch (error) {
      if (error instanceof ProviderOperationError) throw error;
      throw new ProviderOperationError(normalizeProviderError(error));
    }
  }

  async estimateCostDetails(request: ProviderGenerationRequest): Promise<ProviderCostEstimate> {
    this.validate(request, false);
    const unitCount = Array.from(request.prompt!.trim()).length;
    const amount = Number(((unitCount * this.pricePerMillionCharacters) / 1_000_000).toFixed(8));
    return { amount, currency: 'USD', unit: 'character', unitCount, unitPricePerMillion: this.pricePerMillionCharacters, pricingVersion: this.pricingVersion, source: 'configured-rate' };
  }

  async estimateCost(request: ProviderGenerationRequest): Promise<number> { return (await this.estimateCostDetails(request)).amount; }

  async getStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const result = await this.transport.getSpeechGenerationStatus(jobId);
      const error = result.errorCode ? normalizeProviderError(providerError(ProviderErrorCode.UnknownError, result.errorMessage || 'Voice operation failed', false, result.errorCode)) : undefined;
      return { jobId, status: result.status, progress: result.progress, output: result.output, outputUrl: result.output?.uri, actualCost: result.actualCost, error, lastUpdated: new Date(), lifecycleMetadata: result.metadata };
    } catch (error) { throw new ProviderOperationError(normalizeProviderError(error)); }
  }

  async cancelJob(...args: [string]): Promise<ProviderJobStatus> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS generation is synchronous and cannot be cancelled'); }
  async generateImage(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS does not support image generation'); }
  async generateVideo(...args: [ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS does not support video generation'); }
  async extendVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS does not support video extension'); }
  async imageToVideo(...args: [string, ProviderGenerationRequest]): Promise<ProviderJobMetadata> { void args; throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS does not support image-to-video generation'); }

  private validate(request: ProviderGenerationRequest, requireOperationId: boolean): void {
    if (request.type !== 'audio') throw providerError(ProviderErrorCode.UnsupportedCapability, 'Google Cloud TTS accepts audio requests only');
    const text = request.prompt?.trim();
    if (!text) throw providerError(ProviderErrorCode.InvalidRequest, 'Speech text is required');
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) throw providerError(ProviderErrorCode.InvalidRequest, 'Speech text exceeds the Google Cloud TTS 5,000-byte limit');
    if (!request.voiceId?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Provider voice ID is required');
    if (!request.language?.trim()) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS language code is required');
    validateChirpVoice(request.voiceId, request.language);
    if (request.model && request.model !== MODEL) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS model must be chirp-3-hd');
    if (request.outputFormat && request.outputFormat !== OUTPUT_FORMAT) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS output format must be MP3');
    if (requireOperationId && !request.operationId) throw providerError(ProviderErrorCode.InvalidRequest, 'Generation identity is required');
  }
}
