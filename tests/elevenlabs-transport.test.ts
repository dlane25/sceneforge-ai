import { describe, expect, it } from 'vitest';
import { ElevenLabsVoiceProvider } from '@/lib/media/adapters/elevenlabs-voice-provider';
import { ProductionElevenLabsSpeechTransport, type AudioHttpClient, type AudioHttpResponse } from '@/lib/media/providers/elevenlabs-transport';
import { ProviderErrorCode } from '@/lib/media/providers/types';

class FakeAudioHttp implements AudioHttpClient {
  readonly requests: Array<{ url: string; init: RequestInit }> = [];
  constructor(private readonly responses: AudioHttpResponse[]) {}
  async request(url: string, init: RequestInit): Promise<AudioHttpResponse> { this.requests.push({ url, init }); const response = this.responses.shift(); if (!response) throw new Error('No fake audio response configured'); return response; }
}

describe('ElevenLabs production transport with fake HTTP', () => {
  it('maps speech requests and normalizes binary audio metadata', async () => {
    const http = new FakeAudioHttp([{ status: 200, body: new Uint8Array([1, 2, 3, 4]), headers: { requestId: 'request-123', durationSeconds: '1.25', characterCost: '24' } }]);
    const transport = new ProductionElevenLabsSpeechTransport('test-key', http);
    const provider = new ElevenLabsVoiceProvider('test-key', transport);
    const result = await provider.generateSpeech({ type: 'audio', prompt: 'Approved dialogue.', voiceId: 'voice_123', model: 'eleven_multilingual_v2', language: 'en', stability: 0.6, similarityBoost: 0.8, outputFormat: 'mp3_44100_128' });
    expect(result).toMatchObject({ provider: 'elevenlabs-voice', model: 'eleven_multilingual_v2', status: 'succeeded', output: { mimeType: 'audio/mpeg', codec: 'mp3', sampleRate: 44100, bitrate: 128000, channels: 1, durationSeconds: 1.25, fileSize: 4 } });
    expect(result.output?.uri).toBe('data:audio/mpeg;base64,AQIDBA==');
    expect(http.requests[0].url).toContain('/text-to-speech/voice_123?output_format=mp3_44100_128');
    const body = JSON.parse(String(http.requests[0].init.body));
    expect(body).toMatchObject({ text: 'Approved dialogue.', model_id: 'eleven_multilingual_v2', language_code: 'en', voice_settings: { stability: 0.6, similarity_boost: 0.8 } });
  });

  it('normalizes provider HTTP errors without returning raw credentials', async () => {
    const http = new FakeAudioHttp([{ status: 401, body: { detail: { message: 'xi-api-key test-key was rejected' } }, headers: {} }]);
    const provider = new ElevenLabsVoiceProvider('test-key', new ProductionElevenLabsSpeechTransport('test-key', http));
    await expect(provider.generateSpeech({ type: 'audio', prompt: 'Line', voiceId: 'voice_123', model: 'eleven_multilingual_v2' })).rejects.toMatchObject({ normalized: { code: ProviderErrorCode.AuthenticationError, message: 'Provider authentication failed' } });
  });

  it.each([
    [429, { error: { message: 'Too many requests' } }, ProviderErrorCode.RateLimited],
    [429, { error: { message: 'Monthly quota exhausted' } }, ProviderErrorCode.QuotaExceeded],
    [400, { error: { message: 'Blocked by content policy' } }, ProviderErrorCode.ContentPolicy],
    [504, {}, ProviderErrorCode.ProviderTimeout],
    [503, {}, ProviderErrorCode.ProviderUnavailable],
  ])('maps HTTP %i into the shared provider error taxonomy', async (status, body, code) => {
    const provider = new ElevenLabsVoiceProvider('test-key', new ProductionElevenLabsSpeechTransport('test-key', new FakeAudioHttp([{ status, body, headers: {} }])));
    await expect(provider.generateSpeech({ type: 'audio', prompt: 'Line', voiceId: 'voice_123', model: 'eleven_multilingual_v2' })).rejects.toMatchObject({ normalized: { code } });
  });

  it('rejects credential-forwarding endpoint overrides outside the provider domain', () => {
    expect(() => new ProductionElevenLabsSpeechTransport('test-key', new FakeAudioHttp([]), 'https://elevenlabs.io.attacker.test/v1')).toThrow('HTTPS elevenlabs.io');
  });
});
