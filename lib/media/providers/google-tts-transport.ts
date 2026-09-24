import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrivateMediaObjectStore } from '@/lib/storage/google-cloud-media-storage';
import { providerError, providerHttpError } from './errors';
import { GoogleApplicationDefaultTokenProvider, FetchProviderHttpClient, type AccessTokenProvider, type ProviderHttpClient } from './google-transport';
import { ProviderErrorCode, type ProviderOutput } from './types';
import type { SpeechTransport, TransportStatus } from './transport';

const MAX_TEXT_BYTES = 5_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ChirpVoicePattern = /^([a-z]{2,3}-[A-Z]{2})-Chirp3-HD-[A-Za-z0-9]+$/;
const ResponseSchema = z.object({ audioContent: z.string().min(1) }).passthrough();

interface Mp3Inspection {
  durationSeconds: number;
  sampleRate: number;
  bitrate: number;
}

const MPEG1_LAYER_3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] as const;
const MPEG2_LAYER_3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] as const;
const MPEG1_SAMPLE_RATES = [44_100, 48_000, 32_000] as const;

function id3PayloadEnd(bytes: Uint8Array): number {
  if (bytes.byteLength < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  if ([bytes[6], bytes[7], bytes[8], bytes[9]].some((value) => (value & 0x80) !== 0)) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned invalid MP3 audio', true);
  const payloadSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  const end = 10 + payloadSize + ((bytes[5] & 0x10) !== 0 ? 10 : 0);
  if (end > bytes.byteLength) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned invalid MP3 audio', true);
  return end;
}

export function inspectMp3(bytes: Uint8Array): Mp3Inspection {
  let offset = id3PayloadEnd(bytes);
  let frameCount = 0;
  let durationSeconds = 0;
  let encodedAudioBytes = 0;
  let firstSampleRate = 0;
  while (offset + 4 <= bytes.byteLength) {
    const first = bytes[offset];
    const second = bytes[offset + 1];
    if (first !== 0xff || (second & 0xe0) !== 0xe0) {
      if (frameCount > 0) break;
      offset += 1;
      continue;
    }
    const versionBits = (second >> 3) & 0x03;
    const layerBits = (second >> 1) & 0x03;
    const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
    const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;
    if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      if (frameCount > 0) break;
      offset += 1;
      continue;
    }
    const mpeg1 = versionBits === 3;
    const sampleRateDivisor = mpeg1 ? 1 : versionBits === 2 ? 2 : 4;
    const sampleRate = MPEG1_SAMPLE_RATES[sampleRateIndex] / sampleRateDivisor;
    const bitrateKbps = (mpeg1 ? MPEG1_LAYER_3_BITRATES : MPEG2_LAYER_3_BITRATES)[bitrateIndex];
    const padding = (bytes[offset + 2] >> 1) & 0x01;
    const frameLength = Math.floor(((mpeg1 ? 144_000 : 72_000) * bitrateKbps) / sampleRate) + padding;
    if (frameLength <= 4 || offset + frameLength > bytes.byteLength) break;
    frameCount += 1;
    encodedAudioBytes += frameLength;
    firstSampleRate ||= sampleRate;
    durationSeconds += (mpeg1 ? 1_152 : 576) / sampleRate;
    offset += frameLength;
  }
  if (!frameCount || !durationSeconds) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned invalid MP3 audio', true);
  return {
    durationSeconds: Number(durationSeconds.toFixed(6)),
    sampleRate: firstSampleRate,
    bitrate: Math.round((encodedAudioBytes * 8) / durationSeconds),
  };
}

export function validateChirpVoice(voiceName: string, languageCode: string): void {
  const match = ChirpVoicePattern.exec(voiceName);
  if (!match) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS requires a valid Chirp 3 HD voice name');
  if (match[1] !== languageCode) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS voice locale must match the language code');
}

export function decodeMp3Base64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned invalid audio data', true);
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO_BYTES) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned invalid audio data', true);
  inspectMp3(bytes);
  return bytes;
}

export class ProductionGoogleCloudTtsTransport implements SpeechTransport {
  private readonly completed = new Map<string, TransportStatus>();

  constructor(
    private readonly mediaStore: PrivateMediaObjectStore,
    private readonly tokenProvider: AccessTokenProvider = new GoogleApplicationDefaultTokenProvider(),
    private readonly httpClient: ProviderHttpClient = new FetchProviderHttpClient(),
    private readonly endpoint = 'https://texttospeech.googleapis.com/v1',
  ) {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || (url.hostname !== 'googleapis.com' && !url.hostname.endsWith('.googleapis.com'))) throw new Error('unsupported endpoint');
    } catch {
      throw providerError(ProviderErrorCode.ConfigurationError, 'Google Cloud TTS endpoint must be an HTTPS googleapis.com URL');
    }
  }

  async submitSpeechGeneration(request: Parameters<SpeechTransport['submitSpeechGeneration']>[0]) {
    if (!request.operationId) throw providerError(ProviderErrorCode.InvalidRequest, 'Generation identity is required');
    if (request.model !== 'chirp-3-hd') throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS model must be chirp-3-hd');
    if (request.outputFormat !== 'MP3') throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS output format must be MP3');
    if (!request.language) throw providerError(ProviderErrorCode.InvalidRequest, 'Google Cloud TTS language code is required');
    validateChirpVoice(request.voiceId, request.language);
    if (Buffer.byteLength(request.text, 'utf8') > MAX_TEXT_BYTES) throw providerError(ProviderErrorCode.InvalidRequest, 'Speech text exceeds the Google Cloud TTS 5,000-byte limit');

    const response = await this.httpClient.request(`${this.endpoint}/text:synthesize`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.tokenProvider.getAccessToken()}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ input: { text: request.text }, voice: { languageCode: request.language, name: request.voiceId }, audioConfig: { audioEncoding: 'MP3' } }),
    });
    if (response.status < 200 || response.status >= 300) throw providerHttpError(response.status, response.body);
    const parsed = ResponseSchema.safeParse(response.body);
    if (!parsed.success) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Google Cloud TTS returned an invalid response', true);
    const bytes = decodeMp3Base64(parsed.data.audioContent);
    const audio = inspectMp3(bytes);
    const storageUri = await this.mediaStore.uploadGeneratedAudio(request.operationId, bytes);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const output: ProviderOutput = {
      uri: storageUri, storageUri, mimeType: 'audio/mpeg', width: 0, height: 0, durationSeconds: audio.durationSeconds, fileSize: bytes.byteLength,
      checksum, codec: 'mp3', sampleRate: audio.sampleRate, bitrate: audio.bitrate, channels: 1,
      metadata: { responseMode: 'private-gcs', voiceName: request.voiceId, languageCode: request.language, outputFormat: 'MP3', durationSource: 'mp3-frame-scan' },
    };
    const jobId = `google-tts-${checksum.slice(0, 24)}`;
    const status: TransportStatus = { status: 'succeeded', progress: 100, output, metadata: { synchronous: true, storage: 'private-gcs' } };
    this.completed.set(jobId, status);
    return { jobId, status: 'succeeded' as const, output, metadata: status.metadata };
  }

  async getSpeechGenerationStatus(jobId: string): Promise<TransportStatus> {
    return this.completed.get(jobId) || { status: 'failed', errorCode: 'STATUS_UNAVAILABLE', errorMessage: 'Speech generation result is unavailable in this process' };
  }
}
