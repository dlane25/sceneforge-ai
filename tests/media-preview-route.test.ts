import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAuthAdapter, setAuthAdapter, setMembershipRepository } from '@/lib/auth';
import { InMemoryPersistenceRepository } from '@/lib/repositories';

const mocks = vi.hoisted(() => ({ createPreview: vi.fn() }));
vi.mock('@/lib/media/preview-runtime', () => ({ mediaPreviewService: { createPreview: mocks.createPreview } }));

import { GET } from '@/app/api/series/[id]/episodes/[episodeId]/scenes/[sceneId]/shots/[shotId]/assets/[assetId]/[action]/route';

const user = { id: 'route-user', email: 'route@example.test', displayName: 'Route User', provider: 'mock', subject: 'route-user' };
const params = Promise.resolve({ id: 'series_1', episodeId: 'episode_1', sceneId: 'scene_1', shotId: 'shot_1', assetId: 'asset_1', action: 'preview' });

describe('generated media preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMembershipRepository(new InMemoryPersistenceRepository());
    setAuthAdapter(new MockAuthAdapter({ user }));
  });

  it('redirects an authenticated authorized request to the signed HTTPS URL without caching', async () => {
    mocks.createPreview.mockResolvedValue({ url: 'https://storage.googleapis.com/private-object?X-Goog-Signature=signed', expiresAt: new Date() });
    const response = await GET(new Request('https://sceneforge.example/api/preview', { headers: { 'x-request-id': 'preview_redirect' } }), { params });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://storage.googleapis.com/private-object?X-Goog-Signature=signed');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(mocks.createPreview).toHaveBeenCalledWith(expect.objectContaining({ email: user.email }), ['series_1', 'episode_1', 'scene_1', 'shot_1'], 'asset_1');
  });

  it('returns a generic safe error when signing fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.createPreview.mockRejectedValue(new Error('private-key credential token and GCP metadata'));
    const response = await GET(new Request('https://sceneforge.example/api/preview', { headers: { 'x-request-id': 'preview_failure' } }), { params });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'MEDIA_ACCESS_FAILED', message: 'Unable to open generated media', requestId: 'preview_failure' } });
    expect(String(log.mock.calls[0]?.[0])).not.toContain('credential');
    expect(String(log.mock.calls[0]?.[0])).not.toContain('GCP metadata');
    log.mockRestore();
  });
});
