/**
 * Provider Registry and Configuration Tests
 * Validates provider resolution, configuration, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProviderRegistry,
  ProviderErrorCode,
  MockMediaProvider,
} from '@/lib/media/providers';
import {
  loadMediaProviderConfig,
  loadGenerationConfig,
  validateProviderConfig,
} from '@/lib/media/config';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';

describe('Provider Registry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should list all available providers', () => {
    const providers = registry.listAvailable();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.map(p => p.id)).toContain('mock');
    expect(providers.map(p => p.id)).toContain('gemini-image');
    expect(providers.map(p => p.id)).toContain('vertex-video');
  });

  it('should resolve mock provider without config', () => {
    const provider = registry.resolve('mock', {});
    expect(provider.id).toBe('mock');
    expect(provider).toBeInstanceOf(MockMediaProvider);
  });

  it('should describe mock provider capabilities', () => {
    const provider = registry.resolve('mock', {});
    expect(provider.capabilities.videoGeneration).toBe(true);
    expect(provider.capabilities.imageGeneration).toBe(true);
    expect(provider.capabilities.asyncWithPolling).toBe(true);
    expect(provider.capabilities.cancellation).toBe(true);
    expect(provider.capabilities.costEstimation).toBe(true);
    expect(provider.capabilities.supportedAspectRatios).toContain('9:16');
  });

  it('should reject gemini-image without API key', () => {
    const validation = registry.validateConfig('gemini-image', {});
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should accept gemini-image with API key', () => {
    const validation = registry.validateConfig('gemini-image', { apiKey: 'test-key' });
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should resolve gemini-image with API key', () => {
    const provider = registry.resolve('gemini-image', { apiKey: 'test-key' });
    expect(provider.id).toBe('gemini-image');
    expect(provider).toBeInstanceOf(GeminiImageProvider);
    expect(provider.capabilities.imageGeneration).toBe(true);
    expect(provider.capabilities.videoGeneration).toBeUndefined();
  });

  it('should reject vertex-video without projectId', () => {
    const validation = registry.validateConfig('vertex-video', { location: 'us-central1' });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('projectId'))).toBe(true);
  });

  it('should reject vertex-video without location', () => {
    const validation = registry.validateConfig('vertex-video', { projectId: 'test-project' });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('location'))).toBe(true);
  });

  it('should accept vertex-video with projectId and location', () => {
    const validation = registry.validateConfig('vertex-video', {
      projectId: 'test-project',
      location: 'us-central1',
    });
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should resolve vertex-video with projectId and location', () => {
    const provider = registry.resolve('vertex-video', {
      projectId: 'test-project',
      location: 'us-central1',
    });
    expect(provider.id).toBe('vertex-video');
    expect(provider).toBeInstanceOf(VertexAIVideoProvider);
    expect(provider.capabilities.videoGeneration).toBe(true);
    expect(provider.capabilities.imageGeneration).toBeUndefined();
  });

  it('should throw on unknown provider', () => {
    expect(() => registry.resolve('unknown-provider', {})).toThrow();
  });

  it('should report provider not available for unknown ID', () => {
    expect(registry.isAvailable('unknown')).toBe(false);
    expect(registry.isAvailable('mock')).toBe(true);
  });

  it('should get provider info by ID', () => {
    const info = registry.getProviderInfo('mock');
    expect(info).toBeDefined();
    expect(info?.id).toBe('mock');
    expect(info?.name).toBe('Mock Provider');
  });

  it('should return null for unknown provider info', () => {
    const info = registry.getProviderInfo('unknown');
    expect(info).toBeNull();
  });
});

describe('Mock Media Provider', () => {
  let provider: MockMediaProvider;

  beforeEach(() => {
    provider = new MockMediaProvider();
  });

  it('should generate image job', async () => {
    const job = await provider.generateImage({
      prompt: 'A beautiful landscape',
      duration: 10,
    });

    expect(job.provider).toBe('mock');
    expect(job.jobId).toBeDefined();
    expect(job.model).toBe('mock-v1');
    expect(job.estimatedCost).toBeGreaterThan(0);
    expect(job.createdAt).toBeDefined();
  });

  it('should generate video job', async () => {
    const job = await provider.generateVideo({
      prompt: 'A person walking through a city',
      duration: 15,
      style: 'cinematic',
    });

    expect(job.provider).toBe('mock');
    expect(job.model).toBe('mock-v1');
    expect(job.estimatedCost).toBeGreaterThan(0);
  });

  it('should estimate cost based on duration and style', async () => {
    const baseCost = await provider.estimateCost({
      prompt: 'Test',
      duration: 60,
    });

    const styledCost = await provider.estimateCost({
      prompt: 'Test',
      duration: 60,
      style: 'artistic',
    });

    expect(styledCost).toBeGreaterThan(baseCost);
  });

  it('should get job status', async () => {
    const job = await provider.generateVideo({
      prompt: 'Test video',
      duration: 10,
    });

    const status = await provider.getStatus(job.jobId);
    expect(status.jobId).toBe(job.jobId);
    expect(['queued', 'processing', 'succeeded', 'failed']).toContain(status.status);
  });

  it('should cancel job', async () => {
    const job = await provider.generateVideo({
      prompt: 'Test video',
      duration: 10,
    });

    const status = await provider.cancelJob(job.jobId);
    expect(status.status).toBe('cancelled');
  });

  it('should return error for non-existent job status', async () => {
    const status = await provider.getStatus('non-existent-job');
    expect(status.status).toBe('failed');
    expect(status.error).toBeDefined();
    expect(status.error?.code).toBe(ProviderErrorCode.UnknownError);
  });
});

describe('Configuration Loading', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Restore env from copy
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it('should load default mock config', () => {
    delete (process.env as Record<string, string | undefined>).MEDIA_PROVIDER;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const config = loadMediaProviderConfig();
    expect(config.providerId).toBe('mock');
    expect(config.strict).toBe(false);
  });

  it('should load gemini-image config with API key', () => {
    (process.env as Record<string, string>).MEDIA_PROVIDER = 'gemini-image';
    (process.env as Record<string, string>).MEDIA_PROVIDER_API_KEY = 'test-key';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const config = loadMediaProviderConfig();
    expect(config.providerId).toBe('gemini-image');
    expect(config.config.apiKey).toBe('test-key');
  });

  it('should load vertex-video config with GCP settings', () => {
    (process.env as Record<string, string>).MEDIA_PROVIDER = 'vertex-video';
    (process.env as Record<string, string>).GOOGLE_CLOUD_PROJECT = 'test-project';
    (process.env as Record<string, string>).GOOGLE_CLOUD_LOCATION = 'us-central1';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const config = loadMediaProviderConfig();
    expect(config.providerId).toBe('vertex-video');
    expect(config.config.projectId).toBe('test-project');
    expect(config.config.location).toBe('us-central1');
  });

  it('should load generation config with image and video providers', () => {
    (process.env as Record<string, string>).IMAGE_PROVIDER = 'gemini-image';
    (process.env as Record<string, string>).VIDEO_PROVIDER = 'vertex-video';
    (process.env as Record<string, string>).GEMINI_MODEL = 'gemini-2.0-flash';
    (process.env as Record<string, string>).MEDIA_PROVIDER_API_KEY = 'test-key';

    const config = loadGenerationConfig();
    expect(config.imageProvider).toBe('gemini-image');
    expect(config.videoProvider).toBe('vertex-video');
    expect(config.geminiModel).toBe('gemini-2.0-flash');
  });

  it('should fail production config without provider specified', () => {
    delete (process.env as Record<string, string | undefined>).MEDIA_PROVIDER;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    expect(() => {
      loadMediaProviderConfig();
    }).toThrow();
  });
});

describe('Configuration Validation', () => {
  it('should reject empty provider ID', () => {
    const errors = validateProviderConfig({
      providerId: '',
      config: {},
      strict: false,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject mock provider in production', () => {
    const errors = validateProviderConfig({
      providerId: 'mock',
      config: {},
      strict: true,
    });

    expect(errors.some(e => e.includes('Mock provider'))).toBe(true);
  });

  it('should accept mock provider in development', () => {
    const errors = validateProviderConfig({
      providerId: 'mock',
      config: {},
      strict: false,
    });

    expect(errors).toHaveLength(0);
  });

  it('should require API key for gemini-image in production', () => {
    const errors = validateProviderConfig({
      providerId: 'gemini-image',
      config: {},
      strict: true,
    });

    expect(errors.some(e => e.includes('API key'))).toBe(true);
  });

  it('should accept gemini-image in production with API key', () => {
    const errors = validateProviderConfig({
      providerId: 'gemini-image',
      config: { apiKey: 'test-key' },
      strict: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('should require projectId for vertex-video in production', () => {
    const errors = validateProviderConfig({
      providerId: 'vertex-video',
      config: { location: 'us-central1' },
      strict: true,
    });

    expect(errors.some(e => e.includes('GOOGLE_CLOUD_PROJECT'))).toBe(true);
  });

  it('should require location for vertex-video in production', () => {
    const errors = validateProviderConfig({
      providerId: 'vertex-video',
      config: { projectId: 'test' },
      strict: true,
    });

    expect(errors.some(e => e.includes('GOOGLE_CLOUD_LOCATION'))).toBe(true);
  });

  it('should accept vertex-video in production with full config', () => {
    const errors = validateProviderConfig({
      providerId: 'vertex-video',
      config: { projectId: 'test', location: 'us-central1' },
      strict: true,
    });

    expect(errors).toHaveLength(0);
  });
});
