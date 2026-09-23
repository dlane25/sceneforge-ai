import 'server-only';

import { PROVIDER_IDS, type ProviderConfig, type ProviderId } from './providers/types';

export interface MediaProviderConfig {
  providerId: string;
  config: ProviderConfig;
  strict: boolean;
}

export interface GenerationConfig {
  imageProvider: ProviderId;
  videoProvider: ProviderId;
  audioProvider: ProviderId;
  geminiModel: string;
  defaultAudioLanguage: string;
  providers: Record<ProviderId, ProviderConfig>;
}

type Environment = Record<string, string | undefined>;

function providerId(value: string | undefined, name: string): ProviderId {
  if (!value || !PROVIDER_IDS.includes(value as ProviderId)) throw new Error(`${name} must be one of: ${PROVIDER_IDS.join(', ')}`);
  return value as ProviderId;
}

function testDefault(env: Environment): string | undefined { return env.NODE_ENV === 'test' ? 'mock' : undefined }

export function loadGenerationConfig(env: Environment = process.env): GenerationConfig {
  if (typeof window !== 'undefined') throw new Error('Generation configuration is server-only');
  const fallback = env.MEDIA_PROVIDER || testDefault(env);
  const imageProvider = providerId(env.IMAGE_PROVIDER || fallback, 'IMAGE_PROVIDER');
  const videoProvider = providerId(env.VIDEO_PROVIDER || fallback, 'VIDEO_PROVIDER');
  const audioProvider = providerId(env.AUDIO_PROVIDER || fallback, 'AUDIO_PROVIDER');
  const strict = env.NODE_ENV === 'production';
  if (strict && (imageProvider === 'mock' || videoProvider === 'mock' || audioProvider === 'mock')) throw new Error('Mock media providers are not allowed in production');

  const imageModel = env.GEMINI_IMAGE_MODEL || (env.NODE_ENV === 'test' ? 'mock-v1' : 'gemini-3.1-flash-image');
  const videoModel = env.VERTEX_VIDEO_MODEL || (env.NODE_ENV === 'test' ? 'mock-v1' : 'veo-3.1-generate-001');
  const providers: Record<ProviderId, ProviderConfig> = {
    mock: { imageModel: 'mock-v1', videoModel: 'mock-v1', audioModel: 'mock-v1', outputFormat: 'mp3_44100_128' },
    'gemini-image': {
      apiKey: env.GEMINI_API_KEY || env.MEDIA_PROVIDER_API_KEY,
      imageModel,
      endpoint: env.GEMINI_API_ENDPOINT,
    },
    'vertex-video': {
      projectId: env.GOOGLE_CLOUD_PROJECT,
      location: env.GOOGLE_CLOUD_LOCATION,
      outputStorageUri: env.VERTEX_OUTPUT_STORAGE_URI || env.GOOGLE_CLOUD_VIDEO_OUTPUT_URI,
      videoModel,
      endpoint: env.VERTEX_API_ENDPOINT,
    },
    'elevenlabs-voice': {
      apiKey: env.ELEVENLABS_API_KEY,
      audioModel: env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      outputFormat: env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
      endpoint: env.ELEVENLABS_API_ENDPOINT,
    },
    'google-cloud-tts': {
      projectId: env.GOOGLE_CLOUD_PROJECT,
      outputStorageUri: env.MEDIA_STORAGE_URI || env.VERTEX_OUTPUT_STORAGE_URI || env.GOOGLE_CLOUD_VIDEO_OUTPUT_URI,
      audioModel: env.GOOGLE_TTS_MODEL || 'chirp-3-hd',
      outputFormat: env.GOOGLE_TTS_OUTPUT_FORMAT || 'MP3',
      endpoint: env.GOOGLE_TTS_API_ENDPOINT,
      pricePerMillionCharacters: env.GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS || (env.NODE_ENV === 'test' ? '30' : undefined),
      pricingVersion: env.GOOGLE_TTS_PRICING_VERSION || (env.NODE_ENV === 'test' ? 'test-pricing-v1' : undefined),
    },
  };
  if (strict) {
    const errors: string[] = [];
    if (imageProvider === 'gemini-image') {
      if (!providers['gemini-image'].apiKey) errors.push('GEMINI_API_KEY is required for the configured image provider');
      if (!providers['gemini-image'].imageModel) errors.push('GEMINI_IMAGE_MODEL is required for the configured image provider');
    }
    if (videoProvider === 'vertex-video') {
      if (!providers['vertex-video'].projectId) errors.push('GOOGLE_CLOUD_PROJECT is required for the configured video provider');
      if (!providers['vertex-video'].location) errors.push('GOOGLE_CLOUD_LOCATION is required for the configured video provider');
      if (!providers['vertex-video'].outputStorageUri) errors.push('VERTEX_OUTPUT_STORAGE_URI is required for the configured video provider');
      if (!providers['vertex-video'].videoModel) errors.push('VERTEX_VIDEO_MODEL is required for the configured video provider');
    }
    if (audioProvider === 'elevenlabs-voice') {
      if (!providers['elevenlabs-voice'].apiKey) errors.push('ELEVENLABS_API_KEY is required for the configured audio provider');
      if (!providers['elevenlabs-voice'].audioModel) errors.push('ELEVENLABS_MODEL_ID is required for the configured audio provider');
    }
    if (audioProvider === 'google-cloud-tts') {
      if (!providers['google-cloud-tts'].projectId) errors.push('GOOGLE_CLOUD_PROJECT is required for the configured audio provider');
      if (!env.MEDIA_STORAGE_URI) errors.push('MEDIA_STORAGE_URI is required for the configured audio provider');
      if (!providers['google-cloud-tts'].audioModel) errors.push('GOOGLE_TTS_MODEL is required for the configured audio provider');
      if (providers['google-cloud-tts'].outputFormat !== 'MP3') errors.push('GOOGLE_TTS_OUTPUT_FORMAT must be MP3');
      if (!providers['google-cloud-tts'].pricePerMillionCharacters) errors.push('GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS is required for the configured audio provider');
      if (!providers['google-cloud-tts'].pricingVersion) errors.push('GOOGLE_TTS_PRICING_VERSION is required for the configured audio provider');
      if (env.GOOGLE_APPLICATION_CREDENTIALS) errors.push('GOOGLE_APPLICATION_CREDENTIALS is not allowed; use runtime Application Default Credentials');
    }
    if (errors.length) throw new Error(`Provider configuration is invalid: ${errors.join('; ')}`);
  }
  return { imageProvider, videoProvider, audioProvider, geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash', defaultAudioLanguage: env.DEFAULT_AUDIO_LANGUAGE || 'en', providers };
}

export function loadMediaProviderConfig(env: Environment = process.env): MediaProviderConfig {
  const generation = loadGenerationConfig(env);
  const id = providerId(env.MEDIA_PROVIDER || generation.videoProvider, 'MEDIA_PROVIDER');
  return { providerId: id, config: generation.providers[id], strict: env.NODE_ENV === 'production' };
}

export function validateProviderConfig(config: MediaProviderConfig): string[] {
  const errors: string[] = [];
  if (!PROVIDER_IDS.includes(config.providerId as ProviderId)) errors.push('Provider ID is invalid');
  if (config.strict && config.providerId === 'mock') errors.push('Mock provider is not allowed in production');
  if (config.providerId === 'gemini-image') {
    if (!config.config.apiKey) errors.push('Gemini API key is required');
    if (!config.config.imageModel) errors.push('Gemini image model is required');
  }
  if (config.providerId === 'vertex-video') {
    if (!config.config.projectId) errors.push('Google Cloud project is required');
    if (!config.config.location) errors.push('Google Cloud location is required');
    if (!config.config.outputStorageUri) errors.push('Google Cloud video output URI is required');
    if (!config.config.videoModel) errors.push('Vertex video model is required');
  }
  if (config.providerId === 'elevenlabs-voice') {
    if (!config.config.apiKey) errors.push('ElevenLabs API key is required');
    if (!config.config.audioModel) errors.push('ElevenLabs model is required');
  }
  if (config.providerId === 'google-cloud-tts') {
    if (!config.config.projectId) errors.push('Google Cloud project is required');
    if (!config.config.outputStorageUri) errors.push('Google Cloud media storage URI is required');
    if (config.config.audioModel !== 'chirp-3-hd') errors.push('Google Cloud TTS model must be chirp-3-hd');
    if (config.config.outputFormat !== 'MP3') errors.push('Google Cloud TTS output format must be MP3');
    if (!config.config.pricePerMillionCharacters) errors.push('Google Cloud TTS character pricing is required');
    if (!config.config.pricingVersion) errors.push('Google Cloud TTS pricing version is required');
  }
  return errors;
}
