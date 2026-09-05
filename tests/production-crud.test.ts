import { describe, expect, it } from 'vitest';
import { AuthorizationError } from '@/lib/auth';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { AuthenticatedUser } from '@/lib/auth';

const owner: AuthenticatedUser = { id: 'user_mock_owner-subject', email: 'owner@example.test', displayName: 'Owner', provider: 'mock', subject: 'owner-subject' };
const editor: AuthenticatedUser = { id: 'user_invited_editor_example_test', email: 'editor@example.test', displayName: 'Editor', provider: 'mock', subject: 'editor-subject' };
const viewer: AuthenticatedUser = { id: 'user_invited_viewer_example_test', email: 'viewer@example.test', displayName: 'Viewer', provider: 'mock', subject: 'viewer-subject' };
const input = { title: 'Glass Signal', logline: 'A producer discovers a hidden pattern.', genre: 'Thriller', targetAudience: 'Adults', visualStyle: 'Neon noir', episodeCount: 12, episodeDurationSeconds: 75 };

async function setup() {
  const repository = new InMemoryPersistenceRepository();
  const service = new ProductionService(repository);
  const series = await service.createSeries(owner, input);
  await service.addMember(owner, series.id, { email: editor.email, displayName: editor.displayName, role: 'EDITOR' });
  await service.addMember(owner, series.id, { email: viewer.email, displayName: viewer.displayName, role: 'VIEWER' });
  return { repository, service, series };
}

describe('production CRUD and membership authorization', () => {
  it('creates a production and gives its creator OWNER membership', async () => {
    const { repository, series } = await setup();
    const membership = await repository.getMembership(owner.id, series.id);
    expect(series.title).toBe('Glass Signal');
    expect(membership?.role).toBe('OWNER');
  });

  it('lists only productions available to the current member', async () => {
    const { service, series } = await setup();
    expect((await service.listAccessibleSeries(owner)).map((item) => item.id)).toContain(series.id);
    await expect(service.getSeries({ ...viewer, email: 'stranger@example.test', id: 'unknown' }, series.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('allows OWNER and EDITOR updates but denies VIEWER updates', async () => {
    const { service, series } = await setup();
    await expect(service.updateSeries(owner, series.id, { title: 'Owner Edit' })).resolves.toMatchObject({ title: 'Owner Edit' });
    await expect(service.updateSeries(editor, series.id, { title: 'Editor Edit' })).resolves.toMatchObject({ title: 'Editor Edit' });
    await expect(service.updateSeries(viewer, series.id, { title: 'Blocked Edit' })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('protects the last OWNER from demotion or removal', async () => {
    const { service, series } = await setup();
    await expect(service.updateMemberRole(owner, series.id, owner.id, 'EDITOR')).rejects.toThrow('at least one OWNER');
    await expect(service.removeMember(owner, series.id, owner.id)).rejects.toThrow('at least one OWNER');
  });

  it('allows only OWNER membership management and archives safely', async () => {
    const { service, series } = await setup();
    await expect(service.addMember(editor, series.id, { email: 'new@example.test', role: 'VIEWER' })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.archiveSeries(editor, series.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.archiveSeries(owner, series.id)).resolves.toMatchObject({ status: 'archived' });
  });
});
