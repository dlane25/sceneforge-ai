import { describe, expect, it } from 'vitest';
import { DefaultGeminiTransport } from '@/lib/media/ai/gemini-service';
import { ShotEnhancementSchema } from '@/lib/media/ai/gemini-schemas';
import {
  ProductionGeminiImageTransport,
  ProductionVertexVideoTransport,
  type AccessTokenProvider,
  type ProviderHttpClient,
  type ProviderHttpResponse,
} from '@/lib/media/providers/google-transport';
import { GeminiImageProvider } from '@/lib/media/adapters/gemini-image-provider';
import { VertexAIVideoProvider } from '@/lib/media/adapters/vertex-ai-video-provider';
import { ProviderOperationError } from '@/lib/media/providers/errors';

class FakeHttp implements ProviderHttpClient {
  readonly requests: Array<{ url: string; init: RequestInit }> = [];
  constructor(private readonly responses: ProviderHttpResponse[]) {}
  async request(url: string, init: RequestInit): Promise<ProviderHttpResponse> {
    this.requests.push({ url, init });
    const response = this.responses.shift();
    if (!response) throw new Error('No fake response configured');
    return response;
  }
}

const fakeToken: AccessTokenProvider = { getAccessToken: async () => 'test-token' };

describe('Google production transports (fake HTTP only)', () => {
  it('submits Gemini image generation and normalizes inline output', async () => {
    const http = new FakeHttp([{ status: 200, body: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] } }] } }]);
    const transport = new ProductionGeminiImageTransport('secret-key', http);
    const provider = new GeminiImageProvider('secret-key', transport);
    const job = await provider.generateImage({ type: 'image', prompt: 'test', width: 512, height: 512, aspectRatio: '1:1' });
    expect(job.status).toBe('succeeded');
    expect(job.output?.mimeType).toBe('image/png');
    expect(job.output?.uri).toBe('data:image/png;base64,aGVsbG8=');
    expect(http.requests[0].url).toContain('/models/gemini-3.1-flash-image:generateContent');
    expect(JSON.parse(String(http.requests[0].init.body)).generationConfig.responseModalities).toEqual(['IMAGE']);
    expect(String(http.requests[0].init.headers)).not.toContain('secret-key');
  });

  it('submits and polls a Vertex Veo operation', async () => {
    const operationName = 'projects/p/locations/us-central1/publishers/google/models/veo-3.1-generate-001/operations/op1';
    const http = new FakeHttp([
      { status: 200, body: { name: operationName } },
      { status: 200, body: { name: operationName, done: false } },
      { status: 200, body: { name: operationName, done: true, response: { videos: [{ gcsUri: 'gs://out/video.mp4', mimeType: 'video/mp4' }] } } },
    ]);
    const transport = new ProductionVertexVideoTransport('p', 'us-central1', 'gs://out/', fakeToken, http);
    const provider = new VertexAIVideoProvider('p', 'us-central1', 'gs://out/', transport);
    const job = await provider.generateVideo({ type: 'video', prompt: 'test', duration: 4, aspectRatio: '16:9' });
    expect(job.status).toBe('queued');
    expect((await provider.getStatus(job.jobId)).status).toBe('processing');
    const done = await provider.getStatus(job.jobId);
    expect(done.status).toBe('succeeded');
    expect(done.output?.uri).toBe('gs://out/video.mp4');
    expect(http.requests[0].url).toContain(':predictLongRunning');
    expect(http.requests[1].url).toContain(':fetchPredictOperation');
    expect(JSON.parse(String(http.requests[0].init.body)).parameters.storageUri).toBe('gs://out/');
  });

  it('uses Gemini structured output with Zod validation and redacts secrets', async () => {
    const http = new FakeHttp([{ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({ enhancedPrompt: 'bright', negativePrompt: 'blur', confidence: 0.9, reasoning: 'clear' }) }] } }] } }]);
    const transport = new DefaultGeminiTransport('secret-key', 'gemini-2.5-flash', http);
    const result = await transport.call('enhance this shot', ShotEnhancementSchema);
    expect(ShotEnhancementSchema.parse(result).enhancedPrompt).toBe('bright');
    expect(JSON.parse(String(http.requests[0].init.body)).generationConfig.responseMimeType).toBe('application/json');

    const failing = new FakeHttp([{ status: 401, body: { error: { message: 'Bearer secret-key should not be returned' } } }]);
    await expect(new DefaultGeminiTransport('secret-key', 'gemini-2.5-flash', failing).call('x', ShotEnhancementSchema))
      .rejects.toSatisfy((error: unknown) => error instanceof ProviderOperationError && !error.message.includes('secret-key'));
  });
});
