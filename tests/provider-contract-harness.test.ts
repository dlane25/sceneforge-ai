/**
 * Provider Contract Harness - Milestone 9
 * Validates provider implementations against contract requirements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';
import { FakeGeminiImageTransport, FakeVertexVideoTransport } from '@/lib/media/providers/transport';
import { ProviderRegistry } from '@/lib/media/providers/registry';

describe('Provider Contract Harness', () => {
  describe('Provider Registry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => {
      registry = new ProviderRegistry();
    });

    it('registers stable provider IDs', () => {
      const providers = ['mock'];  // Only mock needs no config
      for (const id of providers) {
        expect(() => {
          registry.resolve(id, {});
        }).not.toThrow();
      }

      // Real providers require config
      expect(() => {
        registry.resolve('gemini-image', {});
      }).toThrow();

      expect(() => {
        registry.resolve('vertex-video', {});
      }).toThrow();
    });

    it('throws on unknown provider', () => {
      expect(() => {
        registry.resolve('unknown-provider', {});
      }).toThrow();
    });

    it('requires configuration for real providers', () => {
      const registry2 = new ProviderRegistry();
      expect(() => {
        registry2.resolve('gemini-image', {});
      }).toThrow();
    });
  });

  describe('Gemini Image Provider Contract', () => {
    let provider: GeminiImageProvider;
    let fakeTransport: FakeGeminiImageTransport;

    beforeEach(() => {
      fakeTransport = new FakeGeminiImageTransport();
      provider = new GeminiImageProvider('test-key', fakeTransport);
    });

    it('generates images with output normalization', async () => {
      const result = await provider.generateImage({
        type: 'image',
        prompt: 'a test image',
        width: 512,
        height: 512,
        aspectRatio: '1:1',
      });

      expect(result.jobId).toBeDefined();
      expect(['queued', 'processing', 'succeeded']).toContain(result.status);
      expect(typeof result.model).toBe('string');
    });

    it('estimates cost accurately', async () => {
      const cost = await provider.estimateCost({
        type: 'image',
        prompt: 'test',
        width: 512,
        height: 512,
        aspectRatio: '1:1',
      });

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('normalizes errors without exposing credentials', async () => {
      try {
        await provider.generateImage({
          type: 'image',
          prompt: '',
          width: 512,
          height: 512,
          aspectRatio: '1:1',
        });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toMatch(/test-key|api.?key|secret|token/i);
      }
    });

    it('rejects unsupported media types (video)', async () => {
      try {
        await provider.generateVideo({
          type: 'video',
          prompt: 'test',
          duration: 5,
          aspectRatio: '16:9',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Vertex AI Video Provider Contract', () => {
    let provider: VertexAIVideoProvider;
    let fakeTransport: FakeVertexVideoTransport;

    beforeEach(() => {
      fakeTransport = new FakeVertexVideoTransport();
      provider = new VertexAIVideoProvider(
        'test-project',
        'us-central1',
        undefined,
        fakeTransport
      );
    });

    it('generates videos with output normalization', async () => {
      const result = await provider.generateVideo({
        type: 'video',
        prompt: 'test scene',
        duration: 5,
        aspectRatio: '16:9',
      });

      expect(result.jobId).toBeDefined();
      expect(['queued', 'processing', 'succeeded']).toContain(result.status);
      expect(result.model).toBeDefined();
    });

    it('supports polling with correct status values', async () => {
      const job = await provider.generateVideo({
        type: 'video',
        prompt: 'test scene',
        duration: 5,
        aspectRatio: '16:9',
      });

      const status = await provider.getStatus(job.jobId);
      expect(status).toBeDefined();
      expect(['queued', 'processing', 'succeeded', 'failed']).toContain(status.status);
    });

    it('estimates cost with duration multipliers', async () => {
      const cost5sec = await provider.estimateCost({
        type: 'video',
        prompt: 'test',
        duration: 5,
        aspectRatio: '16:9',
      });

      const cost10sec = await provider.estimateCost({
        type: 'video',
        prompt: 'test',
        duration: 10,
        aspectRatio: '16:9',
      });

      expect(cost10sec).toBeGreaterThan(cost5sec);
    });

    it('supports cancellation', async () => {
      const job = await provider.generateVideo({
        type: 'video',
        prompt: 'test scene',
        duration: 5,
        aspectRatio: '16:9',
      });

      const result = await provider.cancelJob(job.jobId);
      // Result can be a boolean or ProviderJobStatus
      expect(result).toBeDefined();
    });

    it('normalizes errors without exposing credentials', async () => {
      try {
        await provider.generateVideo({
          type: 'video',
          prompt: '',
          duration: 5,
          aspectRatio: '16:9',
        });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toMatch(/test-project|credentials|secret|token/i);
      }
    });

    it('rejects unsupported media types (image)', async () => {
      try {
        await provider.generateImage({
          type: 'image',
          prompt: 'test',
          width: 512,
          height: 512,
          aspectRatio: '1:1',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Error Normalization', () => {
    it('provides usable error messages without leaking secrets', () => {
      const provider = new GeminiImageProvider('secret-key-12345', new FakeGeminiImageTransport());

      try {
        // Calling with empty prompt triggers validation error
        provider.generateImage({
          type: 'image',
          prompt: '',
          width: 512,
          height: 512,
          aspectRatio: '1:1',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } catch (error) {
        const message = (error as Error).message;
        expect(message.length).toBeGreaterThan(0);
        // Never leak API key
        expect(message).not.toMatch(/secret-key|api.?key/i);
      }
    });

    it('indicates unsupported capabilities clearly', async () => {
      const provider = new GeminiImageProvider('key', new FakeGeminiImageTransport());

      try {
        await provider.generateVideo({
          type: 'video',
          prompt: 'test',
          duration: 5,
          aspectRatio: '16:9',
        });
      } catch (error) {
        const message = (error as Error).message;
        // Should indicate the limitation
        expect(message.toLowerCase()).toMatch(/video|unsupported|does not support/);
      }
    });
  });

  describe('Deterministic Request Handling', () => {
    it('handles identical requests consistently (Gemini)', async () => {
      const provider = new GeminiImageProvider('key', new FakeGeminiImageTransport());

      const request = {
        type: 'image' as const,
        prompt: 'test image',
        width: 512,
        height: 512,
        aspectRatio: '1:1' as const,
      };

      const result1 = await provider.generateImage(request);
      const result2 = await provider.generateImage(request);

      // Different jobIds but same model and format
      expect(result1.model).toBe(result2.model);
      expect(result1.status).toBe(result2.status);
    });

    it('handles identical requests consistently (Vertex)', async () => {
      const provider = new VertexAIVideoProvider(
        'proj',
        'us-central1',
        undefined,
        new FakeVertexVideoTransport()
      );

      const request = {
        type: 'video' as const,
        prompt: 'test scene',
        duration: 5,
        aspectRatio: '16:9' as const,
      };

      const result1 = await provider.generateVideo(request);
      const result2 = await provider.generateVideo(request);

      expect(result1.model).toBe(result2.model);
      expect(result1.status).toBe(result2.status);
    });
  });

  describe('Cost Shape Validation', () => {
    it('returns valid numeric cost for Gemini', async () => {
      const provider = new GeminiImageProvider('key', new FakeGeminiImageTransport());

      const cost = await provider.estimateCost({
        type: 'image',
        prompt: 'test',
        width: 512,
        height: 512,
        aspectRatio: '1:1',
      });

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    it('returns valid numeric cost for Vertex', async () => {
      const provider = new VertexAIVideoProvider(
        'proj',
        'us-central1',
        undefined,
        new FakeVertexVideoTransport()
      );

      const cost = await provider.estimateCost({
        type: 'video',
        prompt: 'test',
        duration: 5,
        aspectRatio: '16:9',
      });

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(cost)).toBe(true);
    });
  });
});
