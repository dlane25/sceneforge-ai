import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaPersistenceRepository } from '@/lib/repositories/prisma';

const now = new Date('2026-01-01T00:00:00Z');
const episodeRecord = { id: 'episode_1', seriesId: 'series_1', episodeNumber: 1, title: 'One', hook: '', synopsis: 'One.', cliffhanger: '', status: 'draft', estimatedDurationSeconds: null, createdAt: now, updatedAt: now, scenes: [] };
const locationRecord = { id: 'location_1', seriesId: 'series_1', name: 'Office', description: 'Office.', type: null, visualDescription: null, roomDetails: null, lighting: null, visualStyle: null, props: [], continuityNotes: [], createdAt: now, updatedAt: now };

function database(location: typeof locationRecord | null) {
  const create = vi.fn().mockResolvedValue({ id: 'scene_1', episodeId: episodeRecord.id, sceneNumber: 1, title: 'Opening', description: 'Opening.', locationId: 'location_1', timeOfDay: null, estimatedDurationSeconds: null, status: 'draft', createdAt: now, updatedAt: now, shots: [] });
  const client = {
    episode: { findFirst: vi.fn().mockResolvedValue(episodeRecord) },
    location: { findFirst: vi.fn().mockResolvedValue(location) },
    scene: { create },
  } as unknown as PrismaClient;
  return { repository: new PrismaPersistenceRepository(client), create };
}

describe('Prisma scene persistence', () => {
  it('writes the validated locationId without an empty-string fallback', async () => {
    const { repository, create } = database(locationRecord);
    await repository.createScene('series_1', 'episode_1', { sceneNumber: 1, title: 'Opening', description: 'Opening.', locationId: 'location_1' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ locationId: 'location_1' }) }));
    expect(create.mock.calls[0][0].data.locationId).not.toBe('');
  });

  it('rejects a location outside the series before attempting the insert', async () => {
    const { repository, create } = database(null);
    await expect(repository.createScene('series_1', 'episode_1', { sceneNumber: 1, title: 'Opening', description: 'Opening.', locationId: 'location_foreign' })).rejects.toThrow('belong');
    expect(create).not.toHaveBeenCalled();
  });

  it('never writes an empty-string location foreign key', async () => {
    const { repository, create } = database(null);
    await expect(repository.createScene('series_1', 'episode_1', { sceneNumber: 1, title: 'Opening', description: 'Opening.', locationId: '' })).rejects.toThrow('belong');
    expect(create).not.toHaveBeenCalled();
  });
});
