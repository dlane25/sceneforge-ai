import { describe, expect, it, vi } from 'vitest';
import { GoogleCloudPrivateMediaStore, type BinaryHttpClient } from '@/lib/storage/google-cloud-media-storage';
import type { AccessTokenProvider } from '@/lib/media/providers/google-transport';

const token: AccessTokenProvider = { getAccessToken: vi.fn().mockResolvedValue('test-adc-token') };

describe('private Google Cloud media storage', () => {
  it('uploads immutable server-named MP3 objects with ADC and a create-only precondition', async () => {
    const http: BinaryHttpClient = { request: vi.fn().mockResolvedValue({ status: 200, body: new Uint8Array([1]) }) };
    const store = new GoogleCloudPrivateMediaStore({ bucket: 'test-bucket', object: 'sceneforge' }, token, http);
    const uri = await store.uploadGeneratedAudio('audio_shot_1_1', new Uint8Array([0x49, 0x44, 0x33]));
    expect(uri).toBe('gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_shot_1_1/v1.mp3');
    const [url, init] = vi.mocked(http.request).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('storage.googleapis.com');
    expect(parsed.searchParams.get('uploadType')).toBe('media');
    expect(parsed.searchParams.get('ifGenerationMatch')).toBe('0');
    expect(parsed.searchParams.get('name')).toBe('sceneforge/audio/google-cloud-tts/audio_shot_1_1/v1.mp3');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-adc-token', 'content-type': 'audio/mpeg' });
  });

  it('rejects client-like operation paths and unauthorized buckets/prefixes before HTTP', async () => {
    const http: BinaryHttpClient = { request: vi.fn() };
    const store = new GoogleCloudPrivateMediaStore({ bucket: 'test-bucket', object: 'sceneforge' }, token, http);
    await expect(store.uploadGeneratedAudio('../escape', new Uint8Array([1]))).rejects.toThrow('identity');
    await expect(store.downloadAuthorized('gs://other-bucket/sceneforge/file.mp3')).rejects.toThrow('authorized');
    await expect(store.downloadAuthorized('gs://test-bucket/other/file.mp3')).rejects.toThrow('authorized');
    expect(http.request).not.toHaveBeenCalled();
  });

  it('downloads only authorized private objects through ADC', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const http: BinaryHttpClient = { request: vi.fn().mockResolvedValue({ status: 200, body: bytes }) };
    const store = new GoogleCloudPrivateMediaStore({ bucket: 'test-bucket', object: 'sceneforge' }, token, http);
    await expect(store.downloadAuthorized('gs://test-bucket/sceneforge/audio/file.mp3')).resolves.toEqual(bytes);
    expect(vi.mocked(http.request).mock.calls[0][0]).toContain('alt=media');
  });
});
