import { afterEach, describe, expect, it } from 'vitest';
import { AuthenticationError, AuthorizationError, MockAuthAdapter, requireSeriesAccess, setAuthAdapter, setMembershipRepository } from '@/lib/auth';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { OrchestrationService } from '@/lib/orchestration';
import type { ContinuityFact } from '@/types';

const seriesId = 'series-auth-test';
const fact: ContinuityFact = {
  id: 'temporal-injury',
  seriesId,
  subjectType: 'character',
  subjectId: 'character-1',
  key: 'injury',
  value: 'left-arm-injured',
  validFromEpisode: 12,
  validToEpisode: 15,
  source: 'story event',
  confidence: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

afterEach(() => { setAuthAdapter(new MockAuthAdapter(null)); setMembershipRepository(new InMemoryPersistenceRepository()); });

describe('persistence repositories', () => {
  it('persists pipeline updates and approval decisions in memory', async () => {
    const repository = new InMemoryPersistenceRepository();
    const service = new OrchestrationService(repository);
    const pipeline = await service.run('ep_1', 'series_empire_of_lies', 'owner-1');
    const beforeApproval = await repository.get(pipeline.id);

    expect(beforeApproval?.state).toBe('READY_FOR_APPROVAL');
    const approved = await service.approve(pipeline.id, 'Reviewed by producer');
    const persisted = await repository.get(pipeline.id);

    expect(approved.state).toBe('APPROVED');
    expect(persisted?.approval?.status).toBe('approved');
    expect(persisted?.approval?.decisionNote).toBe('Reviewed by producer');
  });

  it('supports episode-scoped temporal Series Memory facts', async () => {
    const repository = new InMemoryPersistenceRepository();
    await repository.addFact(fact);

    expect((await repository.getActiveFacts(seriesId, 11))).toHaveLength(0);
    expect((await repository.getActiveFacts(seriesId, 13))).toHaveLength(1);
    expect((await repository.getActiveFacts(seriesId, 16))).toHaveLength(0);
  });
});

describe('authentication and authorization boundaries', () => {
  it('rejects unauthenticated access', async () => {
    setAuthAdapter(new MockAuthAdapter(null));
    await expect(requireSeriesAccess(seriesId)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('allows OWNER approval-level access and EDITOR edit access', async () => {
    const owner = { user: { id: 'owner', email: 'owner@example.test', displayName: 'Owner' } };
    setAuthAdapter(new MockAuthAdapter(owner));
    const repository = new InMemoryPersistenceRepository();
    setMembershipRepository(repository);
    await repository.upsertMembership({ id: 'membership-owner', userId: 'owner', seriesId, role: 'OWNER' });
    await repository.upsertUser(owner.user);

    await expect(requireSeriesAccess(seriesId, 'OWNER')).resolves.toBeDefined();
  });

  it('does not grant access from an ID alone', async () => {
    setAuthAdapter(new MockAuthAdapter({ user: { id: 'stranger', email: 'stranger@example.test', displayName: 'Stranger' } }));
    await expect(requireSeriesAccess('private-series', 'VIEWER')).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('enforces VIEWER restrictions through role helpers', async () => {
    setAuthAdapter(new MockAuthAdapter({ user: { id: 'viewer', email: 'viewer@example.test', displayName: 'Viewer' } }));
    const repository = new InMemoryPersistenceRepository();
    setMembershipRepository(repository);
    await repository.upsertUser({ id: 'viewer', email: 'viewer@example.test', displayName: 'Viewer' });
    await repository.upsertMembership({ id: 'membership-viewer', userId: 'viewer', seriesId, role: 'VIEWER' });

    await expect(requireSeriesAccess(seriesId, 'EDITOR')).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireSeriesAccess(seriesId, 'VIEWER')).resolves.toBeDefined();
  });

  it('allows EDITOR access for content work but not owner approval', async () => {
    setAuthAdapter(new MockAuthAdapter({ user: { id: 'editor', email: 'editor@example.test', displayName: 'Editor' } }));
    const repository = new InMemoryPersistenceRepository();
    setMembershipRepository(repository);
    await repository.upsertMembership({ id: 'membership-editor', userId: 'editor', seriesId, role: 'EDITOR' });

    await expect(requireSeriesAccess(seriesId, 'EDITOR')).resolves.toBeDefined();
    await expect(requireSeriesAccess(seriesId, 'OWNER')).rejects.toBeInstanceOf(AuthorizationError);
  });
});
