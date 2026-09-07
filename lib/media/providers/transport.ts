/**
 * Provider Transport Abstraction
 * Allows injectable real and fake transports for Gemini and Vertex AI providers.
 * This enables production API calls while maintaining deterministic testing.
 */

import type { ProviderGenerationRequest, ProviderJobMetadata, ProviderJobStatus, NormalizedProviderError } from './types';

/**
 * Transport interface for Gemini image generation
 */
export interface GeminiImageTransport {
  submitImageGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }>;
  
  getImageGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }>;
  
  cancelImageGeneration(jobId: string): Promise<void>;
}

/**
 * Transport interface for Vertex AI video generation
 */
export interface VertexVideoTransport {
  submitVideoGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    duration: number;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }>;
  
  getVideoGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }>;
  
  cancelVideoGeneration(jobId: string): Promise<void>;
}

/**
 * Fake Gemini transport for deterministic testing
 * Returns fake responses based on request content
 */
export class FakeGeminiImageTransport implements GeminiImageTransport {
  private jobs: Map<string, {
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> = new Map();

  async submitImageGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }> {
    const jobId = `fake-gemini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Deterministic: use prompt hash to determine status
    const promptHash = this.hashPrompt(request.prompt);
    const willFail = promptHash % 10 === 0; // 10% failure rate deterministically
    
    if (willFail) {
      this.jobs.set(jobId, {
        status: 'failed',
        errorCode: 'CONTENT_POLICY_VIOLATION',
        errorMessage: 'Fake content policy violation (deterministic)',
      });
    } else {
      this.jobs.set(jobId, {
        status: 'processing',
      });
    }
    
    return {
      jobId,
      estimatedCost: request.width * request.height / 1000 * 0.01, // Fake cost calculation
    };
  }

  async getImageGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        status: 'failed',
        errorCode: 'NOT_FOUND',
        errorMessage: 'Job not found',
      };
    }

    // Simulate progression: processing → succeeded
    if (job.status === 'processing') {
      job.status = 'succeeded';
      job.outputUrl = `fake://gemini/images/${jobId}.png`;
      job.actualCost = 0.001; // Fake actual cost
      this.jobs.set(jobId, job);
    }

    return job;
  }

  async cancelImageGeneration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
      this.jobs.set(jobId, job);
    }
  }

  private hashPrompt(prompt: string): number {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Fake Vertex AI video transport for deterministic testing
 */
export class FakeVertexVideoTransport implements VertexVideoTransport {
  private jobs: Map<string, {
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> = new Map();

  async submitVideoGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    duration: number;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }> {
    const jobId = `fake-vertex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Deterministic: use prompt hash to determine status
    const promptHash = this.hashPrompt(request.prompt);
    const willFail = promptHash % 15 === 0; // ~7% failure rate
    
    if (willFail) {
      this.jobs.set(jobId, {
        status: 'failed',
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'Fake invalid request (deterministic)',
      });
    } else {
      this.jobs.set(jobId, {
        status: 'queued',
      });
    }
    
    // Fake cost: (width * height * duration) / 1000 * price_per_frame
    const estimatedCost = (request.width * request.height * request.duration) / 1000 * 0.05;
    
    return { jobId, estimatedCost };
  }

  async getVideoGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        status: 'failed',
        errorCode: 'NOT_FOUND',
        errorMessage: 'Job not found',
      };
    }

    // Simulate progression: queued → processing → succeeded
    if (job.status === 'queued') {
      job.status = 'processing';
      this.jobs.set(jobId, job);
    } else if (job.status === 'processing') {
      job.status = 'succeeded';
      job.outputUrl = `fake://vertex/videos/${jobId}.mp4`;
      job.actualCost = 0.005; // Fake actual cost
      this.jobs.set(jobId, job);
    }

    return job;
  }

  async cancelVideoGeneration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'queued' || job.status === 'processing')) {
      job.status = 'cancelled';
      this.jobs.set(jobId, job);
    }
  }

  private hashPrompt(prompt: string): number {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Default production Gemini transport (stub - real SDK would replace this)
 * This is a placeholder for actual Gemini API integration
 */
export class DefaultGeminiImageTransport implements GeminiImageTransport {
  constructor(private apiKey: string) {}

  async submitImageGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }> {
    // TODO: Replace with actual Gemini API call
    // This would use the Gemini SDK with this.apiKey
    throw new Error(
      'DefaultGeminiImageTransport: Real Gemini SDK integration not yet implemented. ' +
      'Use FakeGeminiImageTransport for testing, or implement real integration for production.'
    );
  }

  async getImageGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> {
    throw new Error(
      'DefaultGeminiImageTransport: Real Gemini SDK integration not yet implemented.'
    );
  }

  async cancelImageGeneration(jobId: string): Promise<void> {
    throw new Error(
      'DefaultGeminiImageTransport: Real Gemini SDK integration not yet implemented.'
    );
  }
}

/**
 * Default production Vertex AI video transport (stub)
 * This is a placeholder for actual Vertex AI API integration
 */
export class DefaultVertexVideoTransport implements VertexVideoTransport {
  constructor(
    private projectId: string,
    private location: string,
    private credentials?: unknown
  ) {}

  async submitVideoGeneration(request: {
    prompt: string;
    negativePrompt?: string;
    duration: number;
    width: number;
    height: number;
    model: string;
  }): Promise<{ jobId: string; estimatedCost?: number }> {
    // TODO: Replace with actual Vertex AI API call
    // This would use the Vertex AI SDK with this.projectId and this.location
    throw new Error(
      'DefaultVertexVideoTransport: Real Vertex AI SDK integration not yet implemented. ' +
      'Use FakeVertexVideoTransport for testing, or implement real integration for production.'
    );
  }

  async getVideoGenerationStatus(jobId: string): Promise<{
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    outputUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    actualCost?: number;
  }> {
    throw new Error(
      'DefaultVertexVideoTransport: Real Vertex AI SDK integration not yet implemented.'
    );
  }

  async cancelVideoGeneration(jobId: string): Promise<void> {
    throw new Error(
      'DefaultVertexVideoTransport: Real Vertex AI SDK integration not yet implemented.'
    );
  }
}
