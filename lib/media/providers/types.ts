/**
 * Provider Registry and Capability Types
 * Defines the contract for all media providers and their capabilities
 */

/**
 * Provider capabilities describe what a provider can do
 */
export interface ProviderCapabilities {
  imageGeneration?: boolean;
  videoGeneration?: boolean;
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
  supportedDurations?: {
    min: number; // seconds
    max: number; // seconds
  };
  supportedResolutions?: {
    min: number; // width in pixels
    max: number; // width in pixels
  };
  supportedModels?: string[];
  requestValidation?: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  projectId?: string;
  location?: string;
  endpoint?: string;
  [key: string]: string | undefined;
}

/**
 * Provider information for registry
 */
export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  capabilities: ProviderCapabilities;
  configRequired: (keyof ProviderConfig)[];
}

/**
 * Provider validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Error codes for provider operations
 */
export enum ProviderErrorCode {
  ConfigurationError = 'configuration_error',
  AuthenticationError = 'authentication_error',
  RateLimited = 'rate_limited',
  QuotaExceeded = 'quota_exceeded',
  InvalidRequest = 'invalid_request',
  UnsupportedCapability = 'unsupported_capability',
  ProviderUnavailable = 'provider_unavailable',
  ProviderTimeout = 'provider_timeout',
  ContentPolicy = 'content_policy',
  Cancelled = 'cancelled',
  UnknownError = 'unknown_provider_error',
}

/**
 * Normalized provider error
 */
export interface NormalizedProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  providerCode?: string; // Keep provider-specific code for reference
  timestamp: Date;
}

/**
 * Video generation request details
 */
export interface ProviderGenerationRequest {
  type?: 'image' | 'video';
  prompt?: string;
  negativePrompt?: string;
  duration?: number; // seconds (for video)
  aspectRatio?: '9:16' | '16:9' | '1:1';
  width?: number;
  height?: number;
  seed?: string;
  style?: string;
  model?: string;
  continuityConstraints?: string[];
}

/**
 * Normalized provider job metadata
 */
export interface ProviderJobMetadata {
  jobId: string;
  provider: string;
  model: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  estimatedCost?: number;
  actualCost?: number;
  outputUrl?: string;
  createdAt: Date;
  lastUpdated?: Date;
}

/**
 * Normalized provider output
 */
export interface ProviderOutput {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  fileSize?: number;
  checksum?: string;
  metadata: Record<string, unknown>;
}

/**
 * Provider job status response
 */
export interface ProviderJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number; // 0-100
  outputUrl?: string;
  actualCost?: number;
  output?: ProviderOutput;
  error?: NormalizedProviderError;
  lastUpdated: Date;
}

/**
 * Abstract provider interface (internal to lib/media)
 */
export interface MediaProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  
  generateImage(request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  generateVideo(request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  extendVideo(jobId: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  imageToVideo(imageUri: string, request: ProviderGenerationRequest): Promise<ProviderJobMetadata>;
  
  getStatus(jobId: string): Promise<ProviderJobStatus>;
  cancelJob(jobId: string): Promise<ProviderJobStatus>;
  
  estimateCost(request: ProviderGenerationRequest): Promise<number>;
}

/**
 * Provider registry interface
 */
export interface IProviderRegistry {
  /**
   * Resolve a provider by ID with configuration
   * Throws if provider not found or configuration invalid
   */
  resolve(providerId: string, config: ProviderConfig): MediaProvider;
  
  /**
   * Get information about all available providers
   */
  listAvailable(): ProviderInfo[];
  
  /**
   * Validate provider configuration
   */
  validateConfig(providerId: string, config: ProviderConfig): ConfigValidationResult;
  
  /**
   * Check if a provider is available (installed/configured)
   */
  isAvailable(providerId: string): boolean;
}
