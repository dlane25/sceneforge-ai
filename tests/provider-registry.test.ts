import { describe, expect, it } from 'vitest';
import { loadGenerationConfig, loadMediaProviderConfig, validateProviderConfig } from '@/lib/media/config';
import { MockMediaProvider, ProviderRegistry } from '@/lib/media/providers';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';
import { ElevenLabsVoiceProvider } from '@/lib/media/adapters/elevenlabs-voice-provider';

const imageConfig = { apiKey: 'test-key', imageModel: 'gemini-3.1-flash-image' };
const videoConfig = { projectId: 'test-project', location: 'us-central1', outputStorageUri: 'gs://test-output/video/', videoModel: 'veo-3.1-generate-001' };
const audioConfig = { apiKey: 'test-key', audioModel: 'eleven_multilingual_v2', outputFormat: 'mp3_44100_128' };

describe('provider registry', () => {
  it('lists stable provider IDs in deterministic order', () => {
    expect(new ProviderRegistry().listAvailable().map((provider) => provider.id)).toEqual(['mock', 'gemini-image', 'vertex-video', 'elevenlabs-voice']);
  });

  it('resolves and caches the explicit mock provider', () => {
    const registry = new ProviderRegistry();
    const first = registry.resolve('mock', {});
    expect(first).toBeInstanceOf(MockMediaProvider);
    expect(registry.resolve('mock', {})).toBe(first);
  });

  it('reports accurate mock capabilities', () => {
    const capabilities = new ProviderRegistry().getProviderInfo('mock')?.capabilities;
    expect(capabilities).toMatchObject({ imageGeneration: true, videoGeneration: true, cancellation: true, asyncWithPolling: true });
    expect(capabilities).toMatchObject({ textToSpeech: true, speechGeneration: true, voiceCloning: false });
  });

  it('reports Gemini as synchronous image-only without cancellation', () => {
    const capabilities = new ProviderRegistry().getProviderInfo('gemini-image')?.capabilities;
    expect(capabilities).toMatchObject({ imageGeneration: true, videoGeneration: false, synchronous: true, asyncWithPolling: false, cancellation: false });
  });

  it('reports Vertex as async text-to-video without unsupported cancellation or extension', () => {
    const capabilities = new ProviderRegistry().getProviderInfo('vertex-video')?.capabilities;
    expect(capabilities).toMatchObject({ videoGeneration: true, asyncWithPolling: true, cancellation: false, videoExtension: false, imageToVideo: false });
  });

  it('reports ElevenLabs as synchronous speech-only without cloning or captions', () => {
    expect(new ProviderRegistry().getProviderInfo('elevenlabs-voice')?.capabilities).toMatchObject({ textToSpeech: true, speechGeneration: true, voiceCloning: false, captionGeneration: false, synchronous: true, cancellation: false });
  });

  it('validates complete Gemini and Vertex configurations', () => {
    const registry = new ProviderRegistry();
    expect(registry.validateConfig('gemini-image', imageConfig)).toEqual({ valid: true, errors: [], warnings: [] });
    expect(registry.validateConfig('vertex-video', videoConfig)).toEqual({ valid: true, errors: [], warnings: [] });
    expect(registry.validateConfig('elevenlabs-voice', audioConfig)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('rejects missing credentials, storage, and models', () => {
    const registry = new ProviderRegistry();
    expect(registry.validateConfig('gemini-image', {}).errors).toEqual(expect.arrayContaining([expect.stringContaining('apiKey'), expect.stringContaining('imageModel')]));
    expect(registry.validateConfig('vertex-video', { projectId: 'p', location: 'l' }).errors).toEqual(expect.arrayContaining([expect.stringContaining('outputStorageUri'), expect.stringContaining('videoModel')]));
    expect(registry.validateConfig('elevenlabs-voice', {}).errors).toEqual(expect.arrayContaining([expect.stringContaining('apiKey'), expect.stringContaining('audioModel')]));
  });

  it('rejects unsupported models and unsafe endpoint overrides', () => {
    const registry = new ProviderRegistry();
    expect(registry.validateConfig('gemini-image', { ...imageConfig, imageModel: 'text-model' }).valid).toBe(false);
    expect(registry.validateConfig('vertex-video', { ...videoConfig, endpoint: 'http://localhost:9999' }).valid).toBe(false);
    expect(registry.validateConfig('elevenlabs-voice', { ...audioConfig, endpoint: 'https://elevenlabs.io.attacker.test' }).valid).toBe(false);
  });

  it('resolves real adapters without executing their transports', () => {
    const registry = new ProviderRegistry();
    expect(registry.resolve('gemini-image', imageConfig)).toBeInstanceOf(GeminiImageProvider);
    expect(registry.resolve('vertex-video', videoConfig)).toBeInstanceOf(VertexAIVideoProvider);
    expect(registry.resolve('elevenlabs-voice', audioConfig)).toBeInstanceOf(ElevenLabsVoiceProvider);
  });

  it('rejects unknown providers deterministically', () => {
    const registry = new ProviderRegistry();
    expect(registry.isAvailable('unknown')).toBe(false);
    expect(registry.getProviderInfo('unknown')).toBeNull();
    expect(() => registry.resolve('unknown', {})).toThrow('configuration');
  });
});

describe('server-only provider configuration', () => {
  it('allows a test-only default mock configuration', () => {
    const config = loadGenerationConfig({ NODE_ENV: 'test' });
    expect(config.imageProvider).toBe('mock');
    expect(config.videoProvider).toBe('mock');
    expect(config.audioProvider).toBe('mock');
  });

  it('requires explicit mock mode during local development', () => {
    expect(() => loadGenerationConfig({ NODE_ENV: 'development' })).toThrow('IMAGE_PROVIDER');
    expect(loadGenerationConfig({ NODE_ENV: 'development', IMAGE_PROVIDER: 'mock', VIDEO_PROVIDER: 'mock', AUDIO_PROVIDER: 'mock' }).audioProvider).toBe('mock');
  });

  it('loads separate real image, video, AI model, and storage configuration', () => {
    const config = loadGenerationConfig({
      NODE_ENV: 'development', IMAGE_PROVIDER: 'gemini-image', VIDEO_PROVIDER: 'vertex-video', AUDIO_PROVIDER: 'elevenlabs-voice',
      GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image',
      GOOGLE_CLOUD_PROJECT: 'project', GOOGLE_CLOUD_LOCATION: 'us-central1', GOOGLE_CLOUD_VIDEO_OUTPUT_URI: 'gs://output/video/', VERTEX_VIDEO_MODEL: 'veo-3.1-generate-001',
      ELEVENLABS_API_KEY: 'audio-key', ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2', DEFAULT_AUDIO_LANGUAGE: 'en-US',
    });
    expect(config.geminiModel).toBe('gemini-2.5-flash');
    expect(config.providers['gemini-image']).toMatchObject({ apiKey: 'test-key', imageModel: 'gemini-3.1-flash-image' });
    expect(config.providers['vertex-video']).toMatchObject({ projectId: 'project', location: 'us-central1', outputStorageUri: 'gs://output/video/' });
    expect(config.providers['elevenlabs-voice']).toMatchObject({ apiKey: 'audio-key', audioModel: 'eleven_multilingual_v2' });
    expect(config.defaultAudioLanguage).toBe('en-US');
  });

  it('rejects any production mock selection and missing production selection', () => {
    expect(() => loadGenerationConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => loadGenerationConfig({ NODE_ENV: 'production', IMAGE_PROVIDER: 'mock', VIDEO_PROVIDER: 'vertex-video', AUDIO_PROVIDER: 'elevenlabs-voice' })).toThrow('Mock');
    expect(() => loadGenerationConfig({
      NODE_ENV: 'production', IMAGE_PROVIDER: 'gemini-image', VIDEO_PROVIDER: 'vertex-video', AUDIO_PROVIDER: 'elevenlabs-voice',
      GEMINI_API_KEY: 'test-key', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image', GOOGLE_CLOUD_PROJECT: 'project', GOOGLE_CLOUD_LOCATION: 'us-central1',
      VERTEX_OUTPUT_STORAGE_URI: 'gs://output/video/', VERTEX_VIDEO_MODEL: 'veo-3.1-generate-001',
    })).toThrow('ELEVENLABS_API_KEY');
  });

  it('loads the legacy primary provider only when explicitly configured', () => {
    const config = loadMediaProviderConfig({ NODE_ENV: 'development', MEDIA_PROVIDER: 'mock' });
    expect(config).toMatchObject({ providerId: 'mock', strict: false });
  });

  it('validates public configuration shapes without reading process environment', () => {
    expect(validateProviderConfig({ providerId: '', config: {}, strict: false })).not.toHaveLength(0);
    expect(validateProviderConfig({ providerId: 'mock', config: {}, strict: true })).toContain('Mock provider is not allowed in production');
    expect(validateProviderConfig({ providerId: 'gemini-image', config: imageConfig, strict: true })).toHaveLength(0);
    expect(validateProviderConfig({ providerId: 'vertex-video', config: videoConfig, strict: true })).toHaveLength(0);
    expect(validateProviderConfig({ providerId: 'elevenlabs-voice', config: audioConfig, strict: true })).toHaveLength(0);
  });
});

describe('mock provider behavior', () => {
  it('runs deterministic normalized lifecycle and cancellation', async () => {
    const provider = new MockMediaProvider();
    const job = await provider.generateVideo({ type: 'video', prompt: 'City walk', duration: 6, aspectRatio: '9:16' });
    expect(job).toMatchObject({ provider: 'mock', model: 'mock-v1', status: 'queued' });
    expect((await provider.getStatus(job.jobId)).status).toBe('processing');
    const completed = await provider.getStatus(job.jobId);
    expect(completed).toMatchObject({ status: 'succeeded', output: { mimeType: 'video/mp4', width: 720, height: 1280, durationSeconds: 6 } });
    const cancellable = await provider.generateImage({ type: 'image', prompt: 'Portrait', width: 512, height: 512, aspectRatio: '1:1' });
    expect((await provider.cancelJob(cancellable.jobId)).status).toBe('cancelled');
  });
});
