/** Provider contract checks shared by deterministic and fake-transport providers. */

import { describe, expect, it } from 'vitest';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';
import { ElevenLabsVoiceProvider } from '@/lib/media/adapters/elevenlabs-voice-provider';
import { MockMediaProvider } from '@/lib/media/providers/mock-provider';
import { FakeGeminiImageTransport, FakeSpeechTransport, FakeVertexVideoTransport } from '@/lib/media/providers/transport';
import { ProviderErrorCode, type MediaProvider, type ProviderJobMetadata } from '@/lib/media/providers/types';
import { ProviderOperationError } from '@/lib/media/providers/errors';

const imageRequest = {
  type: 'image' as const,
  prompt: 'a cinematic test frame',
  width: 512,
  height: 512,
  aspectRatio: '1:1' as const,
};

const videoRequest = {
  type: 'video' as const,
  prompt: 'a cinematic test shot',
  duration: 4,
  aspectRatio: '16:9' as const,
};

const audioRequest = { type: 'audio' as const, prompt: 'A governed dialogue line.', voiceId: 'voice-test', model: 'eleven_multilingual_v2', language: 'en', outputFormat: 'mp3_44100_128' };

async function expectUnsupported(action: () => Promise<unknown>): Promise<void> {
  await expect(action()).rejects.toMatchObject({ normalized: { code: ProviderErrorCode.UnsupportedCapability } });
}

function requestFor(media: 'image' | 'video' | 'audio') { return media === 'image' ? imageRequest : media === 'video' ? videoRequest : audioRequest; }

function contract(name: string, create: () => MediaProvider, media: 'image' | 'video' | 'audio'): void {
  describe(`${name} provider contract`, () => {
    it('exposes stable capability and cost metadata', async () => {
      const provider = create();
      expect(provider.id).toMatch(/^(mock|gemini-image|vertex-video|elevenlabs-voice)$/);
      expect(provider.capabilities.costEstimation).toBe(true);
      const cost = await provider.estimateCost(requestFor(media));
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('normalizes a submitted job and lifecycle status', async () => {
      const provider = create();
      const request = requestFor(media);
      const job: ProviderJobMetadata = media === 'image' ? await provider.generateImage(request) : media === 'video' ? await provider.generateVideo(request) : await provider.generateSpeech(request);
      expect(job.jobId).toBeTruthy();
      expect(job.provider).toBe(provider.id);
      expect(['queued', 'processing', 'succeeded']).toContain(job.status);
      let status = await provider.getStatus(job.jobId);
      for (let poll = 0; poll < 3 && !['succeeded', 'failed', 'cancelled'].includes(status.status); poll += 1) status = await provider.getStatus(job.jobId);
      expect(status.jobId).toBe(job.jobId);
      expect(['queued', 'processing', 'succeeded', 'failed', 'cancelled']).toContain(status.status);
      if (status.status === 'succeeded') {
        expect(status.output?.uri).toBeTruthy();
        expect(status.output?.mimeType).toMatch(/^[-\w]+\/[\w.+-]+$/);
        expect(status.output?.metadata).toBeDefined();
      }
    });

    it('rejects malformed requests with a typed, non-secret error', async () => {
      const provider = create();
      const request = { ...requestFor(media), prompt: '' };
      const operation = media === 'image' ? provider.generateImage(request) : media === 'video' ? provider.generateVideo(request) : provider.generateSpeech(request);
      await expect(operation).rejects.toBeInstanceOf(ProviderOperationError);
      await expect(operation).rejects.not.toMatchObject({ message: expect.stringMatching(/secret|token|api.?key/i) });
    });

    it('handles cancellation according to the declared capability', async () => {
      const provider = create();
      if (!provider.capabilities.cancellation) return;
      const job = media === 'image' ? await provider.generateImage(imageRequest) : media === 'video' ? await provider.generateVideo(videoRequest) : await provider.generateSpeech(audioRequest);
      await expect(provider.cancelJob(job.jobId)).resolves.toMatchObject({ status: 'cancelled' });
    });
  });
}

contract('Mock', () => new MockMediaProvider(), 'image');
contract('Gemini image', () => new GeminiImageProvider('test-key', new FakeGeminiImageTransport()), 'image');
contract('Vertex video', () => new VertexAIVideoProvider('test-project', 'us-central1', undefined, new FakeVertexVideoTransport()), 'video');
contract('Mock audio', () => new MockMediaProvider(), 'audio');
contract('ElevenLabs voice', () => new ElevenLabsVoiceProvider('test-key', new FakeSpeechTransport()), 'audio');

describe('Provider capability boundaries', () => {
  it('does not let Gemini image adapter generate video', async () => {
    const provider = new GeminiImageProvider('test-key', new FakeGeminiImageTransport());
    await expectUnsupported(() => provider.generateVideo(videoRequest));
    await expectUnsupported(() => provider.cancelJob('not-supported'));
  });

  it('does not let Vertex adapter generate images or cancel operations', async () => {
    const provider = new VertexAIVideoProvider('test-project', 'us-central1', undefined, new FakeVertexVideoTransport());
    await expectUnsupported(() => provider.generateImage(imageRequest));
    await expectUnsupported(() => provider.cancelJob('not-supported'));
  });

  it('does not let ElevenLabs adapter generate images, video, or cancel synchronous speech', async () => {
    const provider = new ElevenLabsVoiceProvider('test-key', new FakeSpeechTransport());
    await expectUnsupported(() => provider.generateImage(imageRequest));
    await expectUnsupported(() => provider.generateVideo(videoRequest));
    await expectUnsupported(() => provider.cancelJob('not-supported'));
  });

  it('keeps deterministic fake output stable for equivalent requests', async () => {
    const first = new MockMediaProvider();
    const second = new MockMediaProvider();
    const a = await first.generateVideo(videoRequest);
    const b = await second.generateVideo(videoRequest);
    expect(a.model).toBe(b.model);
    expect(a.lifecycleMetadata).toEqual(b.lifecycleMetadata);
  });

  it('keeps deterministic audio serialization stable for equivalent requests', async () => {
    const first = new MockMediaProvider();
    const second = new MockMediaProvider();
    const a = await first.generateSpeech(audioRequest);
    const b = await second.generateSpeech({ ...audioRequest });
    expect(a.lifecycleMetadata).toEqual(b.lifecycleMetadata);
    await first.getStatus(a.jobId); await second.getStatus(b.jobId);
    const [left, right] = await Promise.all([first.getStatus(a.jobId), second.getStatus(b.jobId)]);
    expect(left.output).toMatchObject({ mimeType: 'audio/mpeg', codec: 'mp3', sampleRate: 44_100, bitrate: 128_000, channels: 1 });
    expect(left.output?.metadata.serialization).toBe(right.output?.metadata.serialization);
  });
});
