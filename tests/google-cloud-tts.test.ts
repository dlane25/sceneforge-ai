import { describe, expect, it, vi } from 'vitest';
import { GoogleCloudTtsProvider } from '@/lib/media/adapters/google-cloud-tts-provider';
import { decodeMp3Base64, inspectMp3, ProductionGoogleCloudTtsTransport, validateChirpVoice } from '@/lib/media/providers/google-tts-transport';
import type { AccessTokenProvider, ProviderHttpClient } from '@/lib/media/providers/google-transport';
import type { PrivateMediaObjectStore } from '@/lib/storage/google-cloud-media-storage';

const voice = 'en-US-Chirp3-HD-TestVoice';

function mp3Frames(count = 115): Uint8Array {
  const frameLength = 104;
  const bytes = new Uint8Array(frameLength * count);
  for (let offset = 0; offset < bytes.byteLength; offset += frameLength) bytes.set([0xff, 0xfb, 0x10, 0x00], offset);
  return bytes;
}

const mp3 = mp3Frames();

function fakes(body: unknown = { audioContent: Buffer.from(mp3).toString('base64') }) {
  const token: AccessTokenProvider = { getAccessToken: vi.fn().mockResolvedValue('test-adc-token') };
  const http: ProviderHttpClient = { request: vi.fn().mockResolvedValue({ status: 200, body }) };
  const storage: PrivateMediaObjectStore = {
    uploadGeneratedAudio: vi.fn().mockResolvedValue('gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_job_1/v1.mp3'),
    downloadAuthorized: vi.fn(),
  };
  return { token, http, storage };
}

function request(overrides: Record<string, unknown> = {}) {
  return { type: 'audio' as const, prompt: 'Exact submitted text.', text: 'Exact submitted text.', voiceId: voice, language: 'en-US', model: 'chirp-3-hd', outputFormat: 'MP3', operationId: 'audio_job_1', ...overrides };
}

describe('Google Cloud TTS Chirp 3 HD transport', () => {
  it('uses ADC bearer auth, the documented REST payload, MP3 only, and durable private GCS output', async () => {
    const { token, http, storage } = fakes();
    const transport = new ProductionGoogleCloudTtsTransport(storage, token, http);
    const result = await transport.submitSpeechGeneration(request());
    expect(token.getAccessToken).toHaveBeenCalledOnce();
    expect(http.request).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(http.request).mock.calls[0];
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-adc-token', 'content-type': 'application/json; charset=utf-8' });
    expect(JSON.parse(String(init.body))).toEqual({ input: { text: 'Exact submitted text.' }, voice: { languageCode: 'en-US', name: voice }, audioConfig: { audioEncoding: 'MP3' } });
    expect(String(init.body)).not.toMatch(/speakingRate|pace|stability|similarity/i);
    expect(storage.uploadGeneratedAudio).toHaveBeenCalledWith('audio_job_1', expect.any(Uint8Array));
    expect(Array.from(vi.mocked(storage.uploadGeneratedAudio).mock.calls[0][1])).toEqual(Array.from(mp3));
    expect(result.output).toMatchObject({ uri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_job_1/v1.mp3', storageUri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_job_1/v1.mp3', mimeType: 'audio/mpeg', codec: 'mp3', durationSeconds: expect.closeTo(3.004, 3), sampleRate: 44_100, metadata: { durationSource: 'mp3-frame-scan' } });
    expect(result.output?.uri).not.toMatch(/^data:|^https:/);
  });

  it('validates Chirp voice syntax and exact voice/language locale matching', () => {
    expect(() => validateChirpVoice(voice, 'en-US')).not.toThrow();
    expect(() => validateChirpVoice(voice, 'fr-FR')).toThrow('locale');
    expect(() => validateChirpVoice('catalog-voice', 'en-US')).toThrow('Chirp 3 HD');
  });

  it('rejects empty, malformed base64, and non-MP3 responses before storage', async () => {
    expect(() => decodeMp3Base64('')).toThrow('invalid audio data');
    expect(() => decodeMp3Base64('%%%')).toThrow('invalid audio data');
    expect(() => decodeMp3Base64(Buffer.from('not mp3').toString('base64'))).toThrow('invalid MP3');
    for (const body of [{}, { audioContent: '' }, { audioContent: Buffer.from('not mp3').toString('base64') }]) {
      const { token, http, storage } = fakes(body);
      await expect(new ProductionGoogleCloudTtsTransport(storage, token, http).submitSpeechGeneration(request())).rejects.toThrow();
      expect(storage.uploadGeneratedAudio).not.toHaveBeenCalled();
    }
  });

  it('derives deterministic playback duration from MPEG frames instead of dialogue estimates', () => {
    expect(inspectMp3(mp3Frames(100))).toMatchObject({ durationSeconds: expect.closeTo(2.612, 3), sampleRate: 44_100, bitrate: expect.any(Number) });
    expect(() => inspectMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toThrow('invalid MP3');
  });

  it('normalizes synthesis and upload failures without persisting inline audio', async () => {
    const synthesis = fakes({ message: 'safe fake failure' });
    vi.mocked(synthesis.http.request).mockResolvedValue({ status: 503, body: {} });
    await expect(new ProductionGoogleCloudTtsTransport(synthesis.storage, synthesis.token, synthesis.http).submitSpeechGeneration(request())).rejects.toThrow();
    expect(synthesis.storage.uploadGeneratedAudio).not.toHaveBeenCalled();

    const upload = fakes();
    vi.mocked(upload.storage.uploadGeneratedAudio).mockRejectedValue(new Error('fake upload failure'));
    await expect(new ProductionGoogleCloudTtsTransport(upload.storage, upload.token, upload.http).submitSpeechGeneration(request())).rejects.toThrow('fake upload failure');
  });
});

describe('Google Cloud TTS provider validation and cost accounting', () => {
  const config = { projectId: 'test-project', outputStorageUri: 'gs://test-bucket/sceneforge', audioModel: 'chirp-3-hd', outputFormat: 'MP3', pricePerMillionCharacters: '30', pricingVersion: 'test-price-2026-09' };

  it('enforces the 5,000 UTF-8-byte limit during estimation before approval', async () => {
    const transport = { submitSpeechGeneration: vi.fn(), getSpeechGenerationStatus: vi.fn() };
    const provider = new GoogleCloudTtsProvider(config, transport);
    await expect(provider.estimateCost(request({ prompt: 'é'.repeat(2_501) }))).rejects.toThrow('5,000-byte');
    expect(transport.submitSpeechGeneration).not.toHaveBeenCalled();
  });

  it('snapshots deterministic configured-rate character cost and records it as calculated actual cost', async () => {
    const transport = {
      submitSpeechGeneration: vi.fn().mockResolvedValue({ jobId: 'fake-google-job', status: 'succeeded', output: { uri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_job_1/v1.mp3', storageUri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_job_1/v1.mp3', mimeType: 'audio/mpeg', width: 0, height: 0, metadata: {} }, metadata: { synchronous: true } }),
      getSpeechGenerationStatus: vi.fn(),
    };
    const provider = new GoogleCloudTtsProvider(config, transport);
    const details = await provider.estimateCostDetails!(request({ prompt: 'A😀' }));
    expect(details).toEqual({ amount: 0.00006, currency: 'USD', unit: 'character', unitCount: 2, unitPricePerMillion: 30, pricingVersion: 'test-price-2026-09', source: 'configured-rate' });
    const result = await provider.generateSpeech(request({ prompt: 'A😀' }));
    expect(result).toMatchObject({ provider: 'google-cloud-tts', model: 'chirp-3-hd', status: 'succeeded', estimatedCost: 0.00006, actualCost: 0.00006, lifecycleMetadata: { costAccounting: { billingSource: 'calculated-configured-rate', unitCount: 2 } } });
  });

  it('rejects non-MP3 output and unsupported models deterministically', async () => {
    const provider = new GoogleCloudTtsProvider(config, { submitSpeechGeneration: vi.fn(), getSpeechGenerationStatus: vi.fn() });
    await expect(provider.estimateCost(request({ outputFormat: 'LINEAR16' }))).rejects.toThrow('MP3');
    await expect(provider.estimateCost(request({ model: 'other-model' }))).rejects.toThrow('chirp-3-hd');
  });
});
