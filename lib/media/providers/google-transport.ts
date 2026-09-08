import 'server-only';

import { createHash } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { providerError, providerHttpError } from './errors';
import { ProviderErrorCode, type ProviderOutput } from './types';
import type { GeminiImageTransport, TransportStatus, VertexVideoTransport } from './transport';

export interface ProviderHttpResponse { status: number; body: unknown }
export interface ProviderHttpClient {
  request(url: string, init: RequestInit): Promise<ProviderHttpResponse>;
}

export class FetchProviderHttpClient implements ProviderHttpClient {
  constructor(private readonly timeoutMs = 120_000) {}

  async request(url: string, init: RequestInit): Promise<ProviderHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let body: unknown = {};
      if (text) {
        try { body = JSON.parse(text); }
        catch { body = { message: 'Provider returned a non-JSON response' }; }
      }
      return { status: response.status, body };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw providerError(ProviderErrorCode.ProviderTimeout, 'Provider request timed out', true);
      }
      throw providerError(ProviderErrorCode.ProviderUnavailable, 'Provider network request failed', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface AccessTokenProvider { getAccessToken(): Promise<string> }

export class GoogleApplicationDefaultTokenProvider implements AccessTokenProvider {
  private readonly auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

  async getAccessToken(): Promise<string> {
    try {
      const client = await this.auth.getClient();
      const result = await client.getAccessToken();
      if (!result.token) throw new Error('No access token returned');
      return result.token;
    } catch {
      throw providerError(ProviderErrorCode.AuthenticationError, 'Google Application Default Credentials are unavailable');
    }
  }
}

const GeminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
        text: z.string().optional(),
      }).passthrough()),
    }).passthrough(),
    finishReason: z.string().optional(),
  }).passthrough()).min(1),
  usageMetadata: z.record(z.string(), z.unknown()).optional(),
  promptFeedback: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const VertexSubmissionSchema = z.object({ name: z.string().min(1) }).passthrough();
const VertexStatusSchema = z.object({
  name: z.string().optional(),
  done: z.boolean().optional(),
  error: z.object({ code: z.union([z.string(), z.number()]).optional(), message: z.string().optional(), status: z.string().optional() }).passthrough().optional(),
  response: z.object({
    videos: z.array(z.object({
      gcsUri: z.string().optional(),
      bytesBase64Encoded: z.string().optional(),
      mimeType: z.string().optional(),
    }).passthrough()).optional(),
    raiMediaFilteredCount: z.number().optional(),
    raiMediaFilteredReasons: z.array(z.string()).optional(),
  }).passthrough().optional(),
}).passthrough();

async function requestJson(http: ProviderHttpClient, url: string, init: RequestInit): Promise<unknown> {
  const response = await http.request(url, init);
  if (response.status < 200 || response.status >= 300) throw providerHttpError(response.status, response.body);
  return response.body;
}

function encodeModel(model: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw providerError(ProviderErrorCode.InvalidRequest, 'Provider model identifier is invalid');
  return model;
}

export class ProductionGeminiImageTransport implements GeminiImageTransport {
  private readonly completed = new Map<string, TransportStatus>();

  constructor(
    private readonly apiKey: string,
    private readonly httpClient: ProviderHttpClient = new FetchProviderHttpClient(),
    private readonly endpoint = 'https://generativelanguage.googleapis.com/v1'
  ) {
    if (!apiKey) throw providerError(ProviderErrorCode.ConfigurationError, 'Gemini API key is required');
  }

  async submitImageGeneration(request: Parameters<GeminiImageTransport['submitImageGeneration']>[0]) {
    const prompt = request.negativePrompt ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}` : request.prompt;
    const body = await requestJson(
      this.httpClient,
      `${this.endpoint}/models/${encodeModel(request.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            responseFormat: { image: { aspectRatio: request.aspectRatio } },
          },
        }),
      }
    );

    const parsed = GeminiResponseSchema.safeParse(body);
    if (!parsed.success) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Gemini returned an invalid image response', true);
    const candidate = parsed.data.candidates[0];
    const image = candidate.content.parts.find((part) => part.inlineData)?.inlineData;
    if (!image) {
      const blocked = candidate.finishReason || (parsed.data.promptFeedback ? 'PROMPT_BLOCKED' : 'NO_IMAGE');
      throw providerError(ProviderErrorCode.ContentPolicy, 'Gemini did not return an image', false, blocked);
    }

    const bytes = Buffer.from(image.data, 'base64');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const jobId = `gemini-image-${checksum.slice(0, 24)}`;
    const output: ProviderOutput = {
      uri: `data:${image.mimeType};base64,${image.data}`,
      mimeType: image.mimeType,
      width: request.width,
      height: request.height,
      fileSize: bytes.byteLength,
      checksum,
      metadata: { responseMode: 'inline', model: request.model },
    };
    const status: TransportStatus = { status: 'succeeded', progress: 100, output, metadata: { synchronous: true } };
    this.completed.set(jobId, status);
    return { jobId, status: 'succeeded' as const, output, metadata: { synchronous: true } };
  }

  async getImageGenerationStatus(jobId: string): Promise<TransportStatus> {
    return this.completed.get(jobId) || {
      status: 'failed',
      errorCode: 'STATUS_UNAVAILABLE',
      errorMessage: 'Gemini image generation is synchronous and this result is not available in this process',
    };
  }
}

export class ProductionVertexVideoTransport implements VertexVideoTransport {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly outputStorageUri: string,
    private readonly tokenProvider: AccessTokenProvider = new GoogleApplicationDefaultTokenProvider(),
    private readonly httpClient: ProviderHttpClient = new FetchProviderHttpClient(),
    private readonly endpoint?: string
  ) {
    if (!projectId || !location || !outputStorageUri) {
      throw providerError(ProviderErrorCode.ConfigurationError, 'Vertex project, location, and output storage URI are required');
    }
    if (!outputStorageUri.startsWith('gs://')) {
      throw providerError(ProviderErrorCode.ConfigurationError, 'Vertex output storage URI must use gs://');
    }
  }

  private modelEndpoint(model: string): string {
    const base = this.endpoint || `https://${this.location}-aiplatform.googleapis.com/v1`;
    return `${base}/projects/${encodeURIComponent(this.projectId)}/locations/${encodeURIComponent(this.location)}/publishers/google/models/${encodeModel(model)}`;
  }

  private async headers(): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.tokenProvider.getAccessToken()}`, 'content-type': 'application/json; charset=utf-8' };
  }

  async submitVideoGeneration(request: Parameters<VertexVideoTransport['submitVideoGeneration']>[0]) {
    const parameters: Record<string, unknown> = {
      storageUri: this.outputStorageUri,
      sampleCount: 1,
      aspectRatio: request.aspectRatio,
      durationSeconds: request.duration,
      personGeneration: 'allow_adult',
    };
    if (request.negativePrompt) parameters.negativePrompt = request.negativePrompt;
    if (request.seed !== undefined) parameters.seed = request.seed;
    if (request.model.startsWith('veo-3')) parameters.resolution = request.width >= 1080 ? '1080p' : '720p';

    const body = await requestJson(this.httpClient, `${this.modelEndpoint(request.model)}:predictLongRunning`, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ instances: [{ prompt: request.prompt }], parameters }),
    });
    const parsed = VertexSubmissionSchema.safeParse(body);
    if (!parsed.success) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Vertex returned an invalid submission response', true);
    return { jobId: parsed.data.name, status: 'queued' as const, metadata: { operationName: parsed.data.name } };
  }

  async getVideoGenerationStatus(jobId: string): Promise<TransportStatus> {
    const marker = '/operations/';
    const markerIndex = jobId.lastIndexOf(marker);
    if (markerIndex < 0) throw providerError(ProviderErrorCode.InvalidRequest, 'Vertex operation identifier is invalid');
    const modelPath = jobId.slice(0, markerIndex);
    const expectedPrefix = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/`;
    if (!modelPath.startsWith(expectedPrefix)) throw providerError(ProviderErrorCode.InvalidRequest, 'Vertex operation does not belong to the configured project and location');
    const model = modelPath.slice(expectedPrefix.length);

    const body = await requestJson(this.httpClient, `${this.modelEndpoint(model)}:fetchPredictOperation`, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ operationName: jobId }),
    });
    const parsed = VertexStatusSchema.safeParse(body);
    if (!parsed.success) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Vertex returned an invalid operation response', true);
    if (!parsed.data.done) return { status: 'processing', metadata: { operationName: jobId } };
    if (parsed.data.error) {
      return { status: 'failed', errorCode: String(parsed.data.error.status || parsed.data.error.code || 'UNKNOWN'), errorMessage: parsed.data.error.message || 'Vertex video operation failed' };
    }

    const response = parsed.data.response;
    const video = response?.videos?.[0];
    if (!video) {
      const policy = (response?.raiMediaFilteredCount || 0) > 0;
      return { status: 'failed', errorCode: policy ? 'CONTENT_POLICY' : 'NO_OUTPUT', errorMessage: policy ? 'Vertex content policy filtered the generated video' : 'Vertex completed without a video output' };
    }
    const mimeType = video.mimeType || 'video/mp4';
    const inline = video.bytesBase64Encoded;
    const uri = video.gcsUri || (inline ? `data:${mimeType};base64,${inline}` : '');
    if (!uri) return { status: 'failed', errorCode: 'NO_OUTPUT_URI', errorMessage: 'Vertex completed without an output URI' };
    const bytes = inline ? Buffer.from(inline, 'base64') : undefined;
    return {
      status: 'succeeded',
      progress: 100,
      output: {
        uri,
        storageUri: video.gcsUri,
        mimeType,
        width: 0,
        height: 0,
        fileSize: bytes?.byteLength,
        checksum: bytes ? createHash('sha256').update(bytes).digest('hex') : undefined,
        metadata: { operationName: jobId, raiMediaFilteredCount: response?.raiMediaFilteredCount || 0 },
      },
      metadata: { operationName: jobId },
    };
  }
}
