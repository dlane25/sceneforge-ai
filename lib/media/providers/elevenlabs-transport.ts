import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { providerError, providerHttpError } from './errors';
import { ProviderErrorCode, type ProviderOutput } from './types';
import type { SpeechTransport, TransportStatus } from './transport';

export interface AudioHttpResponse {
  status: number;
  body: Uint8Array | unknown;
  headers: Record<string, string | undefined>;
}

export interface AudioHttpClient {
  request(url: string, init: RequestInit): Promise<AudioHttpResponse>;
}

export class FetchAudioHttpClient implements AudioHttpClient {
  constructor(private readonly timeoutMs = 120_000) {}

  async request(url: string, init: RequestInit): Promise<AudioHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const headers = {
        requestId: response.headers.get('request-id') || undefined,
        durationSeconds: response.headers.get('x-audio-duration-seconds') || undefined,
        characterCost: response.headers.get('x-character-cost') || undefined,
      };
      if (response.ok) return { status: response.status, body: new Uint8Array(await response.arrayBuffer()), headers };
      const text = await response.text();
      let body: unknown = { message: 'Voice provider request failed' };
      try { body = text ? JSON.parse(text) : body; } catch { /* keep the safe fallback */ }
      return { status: response.status, body, headers };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw providerError(ProviderErrorCode.ProviderTimeout, 'Voice provider request timed out', true);
      throw providerError(ProviderErrorCode.ProviderUnavailable, 'Voice provider network request failed', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

const outputFormats: Record<string, { mimeType: string; codec: string; sampleRate: number; bitrate: number }> = {
  mp3_44100_128: { mimeType: 'audio/mpeg', codec: 'mp3', sampleRate: 44_100, bitrate: 128_000 },
  mp3_44100_192: { mimeType: 'audio/mpeg', codec: 'mp3', sampleRate: 44_100, bitrate: 192_000 },
  pcm_44100: { mimeType: 'audio/pcm', codec: 'pcm_s16le', sampleRate: 44_100, bitrate: 705_600 },
};

const safeId = z.string().min(1).max(300).regex(/^[A-Za-z0-9_-]+$/);

export class ProductionElevenLabsSpeechTransport implements SpeechTransport {
  private readonly completed = new Map<string, TransportStatus>();

  constructor(
    private readonly apiKey: string,
    private readonly httpClient: AudioHttpClient = new FetchAudioHttpClient(),
    private readonly endpoint = 'https://api.elevenlabs.io/v1'
  ) {
    if (!apiKey) throw providerError(ProviderErrorCode.ConfigurationError, 'ElevenLabs API key is required');
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || (url.hostname !== 'elevenlabs.io' && !url.hostname.endsWith('.elevenlabs.io'))) throw new Error('unsupported endpoint');
    } catch {
      throw providerError(ProviderErrorCode.ConfigurationError, 'ElevenLabs endpoint must be an HTTPS elevenlabs.io URL');
    }
  }

  async submitSpeechGeneration(request: Parameters<SpeechTransport['submitSpeechGeneration']>[0]) {
    const voiceId = safeId.safeParse(request.voiceId);
    const model = safeId.safeParse(request.model);
    if (!voiceId.success || !model.success) throw providerError(ProviderErrorCode.InvalidRequest, 'Voice or model identifier is invalid');
    const format = outputFormats[request.outputFormat];
    if (!format) throw providerError(ProviderErrorCode.InvalidRequest, 'ElevenLabs output format is not supported');
    const response = await this.httpClient.request(
      `${this.endpoint}/text-to-speech/${encodeURIComponent(voiceId.data)}?output_format=${encodeURIComponent(request.outputFormat)}`,
      {
        method: 'POST',
        headers: { accept: format.mimeType, 'content-type': 'application/json', 'xi-api-key': this.apiKey },
        body: JSON.stringify({
          text: request.text,
          model_id: model.data,
          language_code: request.language,
          voice_settings: {
            stability: request.stability ?? 0.5,
            similarity_boost: request.similarityBoost ?? 0.75,
            style: request.styleExaggeration ?? 0,
            use_speaker_boost: request.speakerBoost ?? true,
          },
        }),
      }
    );
    if (response.status < 200 || response.status >= 300) throw providerHttpError(response.status, response.body);
    if (!(response.body instanceof Uint8Array) || response.body.byteLength === 0) throw providerError(ProviderErrorCode.ProviderUnavailable, 'ElevenLabs returned an empty audio response', true);
    const checksum = createHash('sha256').update(response.body).digest('hex');
    const providerRequestId = response.headers.requestId;
    const jobId = providerRequestId ? `elevenlabs-${providerRequestId}` : `elevenlabs-${checksum.slice(0, 24)}`;
    const duration = Number(response.headers.durationSeconds);
    const output: ProviderOutput = {
      uri: `data:${format.mimeType};base64,${Buffer.from(response.body).toString('base64')}`,
      mimeType: format.mimeType,
      width: 0,
      height: 0,
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      fileSize: response.body.byteLength,
      checksum,
      codec: format.codec,
      sampleRate: format.sampleRate,
      bitrate: format.bitrate,
      channels: 1,
      metadata: { responseMode: 'inline', providerRequestId, voiceId: voiceId.data, model: model.data, outputFormat: request.outputFormat, characterCost: response.headers.characterCost },
    };
    const status: TransportStatus = {
      status: 'succeeded', progress: 100, output,
      metadata: { synchronous: true, providerRequestId },
    };
    this.completed.set(jobId, status);
    return { jobId, status: 'succeeded' as const, output, actualCost: status.actualCost, metadata: status.metadata };
  }

  async getSpeechGenerationStatus(jobId: string): Promise<TransportStatus> {
    return this.completed.get(jobId) || { status: 'failed', errorCode: 'STATUS_UNAVAILABLE', errorMessage: 'Speech generation result is unavailable in this process' };
  }
}
