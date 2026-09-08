export const PROVIDER_IDS = ['mock', 'gemini-image', 'vertex-video', 'elevenlabs-voice'] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderMediaType = 'image' | 'video' | 'audio';
export type ProviderLifecycleStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface ProviderCapabilities {
  imageGeneration?: boolean;
  videoGeneration?: boolean;
  textToSpeech?: boolean;
  speechGeneration?: boolean;
  voiceCloning?: boolean;
  soundEffectsGeneration?: boolean;
  captionGeneration?: boolean;
  imageMasking?: boolean;
  imageInpainting?: boolean;
  imageOutpainting?: boolean;
  videoExtension?: boolean;
  imageToVideo?: boolean;
  synchronous?: boolean;
  asyncWithPolling?: boolean;
  cancellation?: boolean;
  costEstimation?: boolean;
  supportedAspectRatios?: string[];
  supportedDurations?: { min: number; max: number };
  supportedResolutions?: { min: number; max: number };
  supportedModels?: string[];
  requestValidation?: boolean;
}

export interface ProviderConfig {
  apiKey?: string;
  projectId?: string;
  location?: string;
  endpoint?: string;
  outputStorageUri?: string;
  imageModel?: string;
  videoModel?: string;
  audioModel?: string;
  outputFormat?: string;
  [key: string]: string | undefined;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  capabilities: ProviderCapabilities;
  configRequired: (keyof ProviderConfig)[];
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export enum ProviderErrorCode {
  ConfigurationError = 'configuration',
  AuthenticationError = 'auth',
  RateLimited = 'rate_limited',
  QuotaExceeded = 'quota',
  InvalidRequest = 'invalid_request',
  UnsupportedCapability = 'unsupported',
  ProviderUnavailable = 'provider_unavailable',
  ProviderTimeout = 'timeout',
  ContentPolicy = 'content_policy',
  Cancelled = 'cancelled',
  UnknownError = 'unknown',
}

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  providerCode?: string;
  timestamp: Date;
}

export interface ProviderGenerationRequest {
  type?: ProviderMediaType;
  prompt?: string;
  negativePrompt?: string;
  duration?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  width?: number;
  height?: number;
  seed?: string;
  style?: string;
  model?: string;
  continuityConstraints?: string[];
  voiceId?: string;
  language?: string;
  locale?: string;
  stability?: number;
  similarityBoost?: number;
  styleExaggeration?: number;
  speakerBoost?: boolean;
  outputFormat?: string;
}

export interface ProviderOutput {
  uri: string;
  storageUri?: string;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  fileSize?: number;
  checksum?: string;
  codec?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  transcriptSegments?: Array<{ startMs: number; endMs: number; text: string; speaker?: string; confidence?: number }>;
  metadata: Record<string, unknown>;
}

export interface ProviderJobMetadata {
  jobId: string;
  provider: ProviderId;
  model: string;
  status: ProviderLifecycleStatus;
  estimatedCost?: number;
  actualCost?: number;
  output?: ProviderOutput;
  createdAt: Date;
  submittedAt: Date;
  lastUpdated?: Date;
  lifecycleMetadata?: Record<string, unknown>;
}

export interface ProviderJobStatus {
  jobId: string;
  status: ProviderLifecycleStatus;
  progress?: number;
  outputUrl?: string;
  actualCost?: number;
  output?: ProviderOutput;
  error?: NormalizedProviderError;
  lastUpdated: Date;
  lifecycleMetadata?: Record<string, unknown>;
}

export interface MediaProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  generateSpeech(request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  extendVideo(jobId: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  imageToVideo(imageUri: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
  cancelJob(jobId: string): Promise<ProviderJobStatus>;
  estimateCost(request: ProviderGenerationRequest): Promise<number>;
}

export interface IProviderRegistry {
  resolve(providerId: string, config: ProviderConfig): MediaProvider;
  listAvailable(): ProviderInfo[];
  validateConfig(providerId: string, config: ProviderConfig): ConfigValidationResult;
  isAvailable(providerId: string): boolean;
}
