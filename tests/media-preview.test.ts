import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { AuthorizationError } from '@/lib/auth';
import {
  DEFAULT_MEDIA_PREVIEW_TTL_SECONDS,
  GoogleCloudMediaSigner,
  MediaPreviewService,
  assertWithinConfiguredRoot,
  loadMediaPreviewConfig,
  parseGcsUri,
  type MediaObjectSigner,
} from '@/lib/media/media-preview-service';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { GeneratedAsset } from '@/types';

const owner: AuthenticatedUser = { id: 'preview-owner', email: 'preview@example.test', displayName: 'Preview Owner', provider: 'mock', subject: 'preview-owner' };
const outsider: AuthenticatedUser = { id: 'preview-outsider', email: 'outsider@example.test', displayName: 'Outsider', provider: 'mock', subject: 'preview-outsider' };
const root = { bucket: 'sceneforge-ai-media', object: 'sceneforge' };
const mediaLocation = { bucket: root.bucket, object: 'sceneforge/series/episode/sample_0.mp4' };

function fakeSigner(overrides: Partial<MediaObjectSigner> = {}): MediaObjectSigner {
  return {
    objectExists: vi.fn().mockResolvedValue(true),
    createSignedGetUrl: vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-preview'),
    ...overrides,
  };
}

async function setup(sourceUri = 'gs://sceneforge-ai-media/sceneforge/series/episode/sample_0.mp4') {
  const repository = new InMemoryPersistenceRepository();
  const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Preview', logline: 'Private media.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 1, episodeDurationSeconds: 60 });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'Episode', synopsis: 'Preview.' });
  const location = await production.createLocation(owner, series.id, { name: 'Set', description: 'A controlled set.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Scene', description: 'Scene.', locationId: location.id });
  const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Shot', durationSeconds: 4, visualPrompt: 'A private generated shot' });
  const asset: GeneratedAsset = {
    id: 'asset-private-video', generationJobId: 'generation-private-video', seriesId: series.id, episodeId: episode.id, sceneId: scene.id, shotId: shot.id,
    assetType: 'video-clip', uri: sourceUri, storageUri: sourceUri, mimeType: 'video/mp4', width: 720, height: 1280, durationSeconds: 4,
    provider: 'vertex-video', providerModel: 'veo-3.1-generate-001', fingerprint: 'private-video', version: 1, reviewStatus: 'pending', createdAt: new Date(), updatedAt: new Date(),
  };
  await repository.createGeneratedAsset(asset);
  return { repository, ids: [series.id, episode.id, scene.id, shot.id] as [string, string, string, string], asset };
}

describe('private generated media preview', () => {
  it('parses valid GCS locations', () => {
    expect(parseGcsUri('gs://sceneforge-ai-media/sceneforge/series/episode/sample_0.mp4')).toEqual(mediaLocation);
  });

  it.each(['https://storage.googleapis.com/bucket/object.mp4', 'mock://video.mp4', 'gs://bucket', 'gs://bucket/path/../object.mp4', 'gs://bucket/path%2Fobject.mp4'])('rejects invalid or non-GCS URI %s', (uri) => {
    expect(() => parseGcsUri(uri)).toThrow('storage');
  });

  it('rejects locations outside the configured bucket or prefix', () => {
    expect(() => assertWithinConfiguredRoot({ ...mediaLocation, bucket: 'other-private-media' }, root)).toThrow('not authorized');
    expect(() => assertWithinConfiguredRoot({ ...mediaLocation, object: 'other/sample_0.mp4' }, root)).toThrow('not authorized');
    expect(() => assertWithinConfiguredRoot({ ...mediaLocation, object: 'sceneforge-escape/sample_0.mp4' }, root)).toThrow('not authorized');
    expect(() => assertWithinConfiguredRoot(root, root)).toThrow('not authorized');
  });

  it('uses a five-minute default with bounded configurable expiration', () => {
    expect(loadMediaPreviewConfig({ VERTEX_OUTPUT_STORAGE_URI: 'gs://sceneforge-ai-media/sceneforge/' })).toEqual({ root, expiresInSeconds: DEFAULT_MEDIA_PREVIEW_TTL_SECONDS });
    expect(loadMediaPreviewConfig({ VERTEX_OUTPUT_STORAGE_URI: 'gs://sceneforge-ai-media/sceneforge', MEDIA_PREVIEW_URL_TTL_SECONDS: '120' }).expiresInSeconds).toBe(120);
    expect(() => loadMediaPreviewConfig({ VERTEX_OUTPUT_STORAGE_URI: 'gs://sceneforge-ai-media/sceneforge', MEDIA_PREVIEW_URL_TTL_SECONDS: '3600' })).toThrow('expiration');
  });

  it('authorizes and scopes the asset before checking or signing media', async () => {
    const { repository, ids, asset } = await setup();
    const signer = fakeSigner();
    const service = new MediaPreviewService(repository, { signer, loadConfig: () => ({ root, expiresInSeconds: 300 }) });
    await expect(service.createPreview(outsider, ids, asset.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect(signer.objectExists).not.toHaveBeenCalled();
    expect(signer.createSignedGetUrl).not.toHaveBeenCalled();
  });

  it('handles a missing scoped asset without invoking storage', async () => {
    const { repository, ids } = await setup();
    const signer = fakeSigner();
    const service = new MediaPreviewService(repository, { signer, loadConfig: () => ({ root, expiresInSeconds: 300 }) });
    await expect(service.createPreview(owner, ids, 'missing-asset')).rejects.toThrow('Generated media was not found');
    expect(signer.objectExists).not.toHaveBeenCalled();
    expect(signer.createSignedGetUrl).not.toHaveBeenCalled();
  });

  it('rejects malformed and wrong-bucket persisted locations before signing', async () => {
    for (const sourceUri of ['https://example.test/video.mp4', 'gs://different-media/sceneforge/video.mp4']) {
      const { repository, ids, asset } = await setup(sourceUri);
      const signer = fakeSigner();
      const service = new MediaPreviewService(repository, { signer, loadConfig: () => ({ root, expiresInSeconds: 300 }) });
      await expect(service.createPreview(owner, ids, asset.id)).rejects.toThrow();
      expect(signer.objectExists).not.toHaveBeenCalled();
      expect(signer.createSignedGetUrl).not.toHaveBeenCalled();
    }
  });

  it('returns a signed HTTPS preview with the configured expiration without changing review state', async () => {
    const { repository, ids, asset } = await setup();
    const signer = fakeSigner();
    const now = new Date('2026-09-15T12:00:00.000Z');
    const service = new MediaPreviewService(repository, { signer, loadConfig: () => ({ root, expiresInSeconds: 300 }), now: () => now });
    const preview = await service.createPreview(owner, ids, asset.id);
    expect(preview).toEqual({ url: 'https://storage.googleapis.com/signed-preview', expiresAt: new Date('2026-09-15T12:05:00.000Z') });
    expect(signer.objectExists).toHaveBeenCalledWith(mediaLocation);
    expect(signer.createSignedGetUrl).toHaveBeenCalledWith(mediaLocation, { expiresInSeconds: 300, now });
    expect((await repository.getGeneratedAsset(...ids, asset.id))?.reviewStatus).toBe('pending');
  });

  it('handles missing objects and signing failures without retaining sensitive causes', async () => {
    const { repository, ids, asset } = await setup();
    const missing = new MediaPreviewService(repository, { signer: fakeSigner({ objectExists: vi.fn().mockResolvedValue(false) }), loadConfig: () => ({ root, expiresInSeconds: 300 }) });
    await expect(missing.createPreview(owner, ids, asset.id)).rejects.toThrow('Generated media was not found');

    const failing = new MediaPreviewService(repository, { signer: fakeSigner({ createSignedGetUrl: vi.fn().mockRejectedValue(new Error('private-key credential token')) }), loadConfig: () => ({ root, expiresInSeconds: 300 }) });
    await expect(failing.createPreview(owner, ids, asset.id)).rejects.toThrow('Generated media access could not be created');
    await failing.createPreview(owner, ids, asset.id).catch((error: Error) => expect(error.message).not.toContain('credential'));
  });

  it('creates a V4 signed HTTPS URL with the requested short lifetime using injected signing dependencies', async () => {
    const signer = new GoogleCloudMediaSigner({
      getServiceAccountEmail: vi.fn().mockResolvedValue('preview-signer@example.iam.gserviceaccount.com'),
      objectExists: vi.fn().mockResolvedValue(true),
      sign: vi.fn().mockResolvedValue(Buffer.from('signed-value').toString('base64')),
    });
    const url = new URL(await signer.createSignedGetUrl(mediaLocation, { expiresInSeconds: 300, now: new Date('2026-09-15T12:00:00.000Z') }));
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('storage.googleapis.com');
    expect(url.pathname).toBe('/sceneforge-ai-media/sceneforge/series/episode/sample_0.mp4');
    expect(url.searchParams.get('X-Goog-Algorithm')).toBe('GOOG4-RSA-SHA256');
    expect(url.searchParams.get('X-Goog-Expires')).toBe('300');
    expect(url.searchParams.get('X-Goog-Signature')).toBe(Buffer.from('signed-value').toString('hex'));
  });

  it('never navigates the media review UI to a raw asset URI', () => {
    const source = readFileSync('components/series/media-review-panel.tsx', 'utf8');
    expect(source).toContain('/preview');
    expect(source).not.toMatch(/href=\{asset\.(?:storageUri|uri)\}/);
  });

  it('routes private generated audio through the same authenticated preview endpoint', () => {
    const source = readFileSync('components/series/audio-caption-panel.tsx', 'utf8');
    expect(source).toContain('/preview`');
    expect(source).toContain("startsWith('gs://')");
    expect(source).not.toContain('src={asset.uri}');
  });
});
