/** Provider contract checks shared by deterministic and fake-transport providers. */

import { describe, expect, it } from 'vitest';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';
import { MockMediaProvider } from '@/lib/media/providers/mock-provider';
import { FakeGeminiImageTransport, FakeVertexVideoTransport } from '@/lib/media/providers/transport';
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

async function expectUnsupported(action: () => Promise<unknown>): Promise<void> {
  await expect(action()).rejects.toMatchObject({ normalized: { code: ProviderErrorCode.UnsupportedCapability } });
}

function contract(name: string, create: () => MediaProvider, media: 'image' | 'video'): void {
  describe(`${name} provider contract`, () => {
    it('exposes stable capability and cost metadata', async () => {
      const provider = create();
      expect(provider.id).toMatch(/^(mock|gemini-image|vertex-video)$/);
      expect(provider.capabilities.costEstimation).toBe(true);
      const cost = await provider.estimateCost(media === 'image' ? imageRequest : videoRequest);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('normalizes a submitted job and lifecycle status', async () => {
      const provider = create();
      const request = media === 'image' ? imageRequest : videoRequest;
      const job: ProviderJobMetadata = media === 'image'
        ? await provider.generateImage(request)
        : await provider.generateVideo(request);
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
      const request = { ...(media === 'image' ? imageRequest : videoRequest), prompt: '' };
      const operation = media === 'image' ? provider.generateImage(request) : provider.generateVideo(request);
      await expect(operation).rejects.toBeInstanceOf(ProviderOperationError);
      await expect(operation).rejects.not.toMatchObject({ message: expect.stringMatching(/secret|token|api.?key/i) });
    });

    it('handles cancellation according to the declared capability', async () => {
      const provider = create();
      if (!provider.capabilities.cancellation) return;
      const job = media === 'image' ? await provider.generateImage(imageRequest) : await provider.generateVideo(videoRequest);
      await expect(provider.cancelJob(job.jobId)).resolves.toMatchObject({ status: 'cancelled' });
    });
  });
}

contract('Mock', () => new MockMediaProvider(), 'image');
contract('Gemini image', () => new GeminiImageProvider('test-key', new FakeGeminiImageTransport()), 'image');
contract('Vertex video', () => new VertexAIVideoProvider('test-project', 'us-central1', undefined, new FakeVertexVideoTransport()), 'video');

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

  it('keeps deterministic fake output stable for equivalent requests', async () => {
    const first = new MockMediaProvider();
    const second = new MockMediaProvider();
    const a = await first.generateVideo(videoRequest);
    const b = await second.generateVideo(videoRequest);
    expect(a.model).toBe(b.model);
    expect(a.lifecycleMetadata).toEqual(b.lifecycleMetadata);
  });
});
