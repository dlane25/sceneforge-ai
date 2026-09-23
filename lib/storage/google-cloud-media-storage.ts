import 'server-only';

import { GoogleApplicationDefaultTokenProvider, type AccessTokenProvider } from '@/lib/media/providers/google-transport';
import { providerError, providerHttpError } from '@/lib/media/providers/errors';
import { ProviderErrorCode } from '@/lib/media/providers/types';
import { assertWithinGcsRoot, canonicalGcsUri, parseGcsUri, safeGcsEncode, type GcsLocation } from './gcs';

export interface BinaryHttpResponse {
  status: number;
  body: Uint8Array | unknown;
}

export interface BinaryHttpClient {
  request(url: string, init: RequestInit): Promise<BinaryHttpResponse>;
}

export class FetchBinaryHttpClient implements BinaryHttpClient {
  constructor(private readonly timeoutMs = 120_000) {}

  async request(url: string, init: RequestInit): Promise<BinaryHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
      return { status: response.status, body: { message: 'Cloud Storage request failed' } };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw providerError(ProviderErrorCode.ProviderTimeout, 'Cloud Storage request timed out', true);
      throw providerError(ProviderErrorCode.ProviderUnavailable, 'Cloud Storage request failed', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface PrivateMediaObjectStore {
  uploadGeneratedAudio(operationId: string, bytes: Uint8Array): Promise<string>;
  downloadAuthorized(uri: string): Promise<Uint8Array>;
}

const SAFE_OPERATION_ID = /^[A-Za-z0-9_-]{1,300}$/;

export class GoogleCloudPrivateMediaStore implements PrivateMediaObjectStore {
  constructor(
    private readonly root: GcsLocation,
    private readonly tokenProvider: AccessTokenProvider = new GoogleApplicationDefaultTokenProvider(),
    private readonly httpClient: BinaryHttpClient = new FetchBinaryHttpClient(),
  ) {}

  private async authorization(): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.tokenProvider.getAccessToken()}` };
  }

  async uploadGeneratedAudio(operationId: string, bytes: Uint8Array): Promise<string> {
    if (!SAFE_OPERATION_ID.test(operationId)) throw providerError(ProviderErrorCode.InvalidRequest, 'Generation identity is invalid');
    if (!bytes.byteLength) throw providerError(ProviderErrorCode.InvalidRequest, 'Generated audio is empty');
    const location = { bucket: this.root.bucket, object: `${this.root.object}/audio/google-cloud-tts/${operationId}/v1.mp3` };
    assertWithinGcsRoot(location, this.root);
    const query = new URLSearchParams({ uploadType: 'media', name: location.object, ifGenerationMatch: '0' });
    const response = await this.httpClient.request(`https://storage.googleapis.com/upload/storage/v1/b/${safeGcsEncode(location.bucket)}/o?${query}`, {
      method: 'POST',
      headers: { ...(await this.authorization()), 'content-type': 'audio/mpeg' },
      body: Buffer.from(bytes),
    });
    if (response.status < 200 || response.status >= 300) throw providerHttpError(response.status, response.body);
    return canonicalGcsUri(location);
  }

  async downloadAuthorized(uri: string): Promise<Uint8Array> {
    const location = parseGcsUri(uri);
    assertWithinGcsRoot(location, this.root);
    const response = await this.httpClient.request(`https://storage.googleapis.com/storage/v1/b/${safeGcsEncode(location.bucket)}/o/${safeGcsEncode(location.object)}?alt=media`, {
      method: 'GET', headers: await this.authorization(),
    });
    if (response.status < 200 || response.status >= 300) throw providerHttpError(response.status, response.body);
    if (!(response.body instanceof Uint8Array) || !response.body.byteLength) throw providerError(ProviderErrorCode.ProviderUnavailable, 'Cloud Storage returned an empty media object', true);
    return response.body;
  }
}
