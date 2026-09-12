import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSceneCreateInput, nextSceneNumber } from '@/components/series/scene-create';
import { sceneInputSchema } from '@/lib/validation/schemas';

describe('scene creation contract and UI input', () => {
  it('rejects a missing or empty locationId and accepts a valid locationId', () => {
    const base = { sceneNumber: 1, title: 'Opening beat', description: 'A new production scene.' };
    expect(sceneInputSchema.safeParse(base).success).toBe(false);
    expect(sceneInputSchema.safeParse({ ...base, locationId: '' }).success).toBe(false);
    expect(sceneInputSchema.safeParse({ ...base, locationId: 'location_42' }).success).toBe(true);
  });

  it('requires an episode and location before building a request body', () => {
    const episode = { id: 'episode_1', scenes: [] };
    expect(buildSceneCreateInput(undefined, 'location_1')).toBeUndefined();
    expect(buildSceneCreateInput(episode, '')).toBeUndefined();
  });

  it('includes the selected location and deterministically chooses the next unused scene number', () => {
    const episode = { id: 'episode_1', scenes: [{ sceneNumber: 1 }, { sceneNumber: 4 }, { sceneNumber: 2 }] };
    expect(nextSceneNumber(episode.scenes)).toBe(5);
    expect(buildSceneCreateInput(episode, 'location_selected')).toEqual({
      sceneNumber: 5,
      title: 'Opening beat',
      description: 'A new production scene.',
      locationId: 'location_selected',
    });
  });

  it('keeps the Add scene control gated by both persisted selections', () => {
    const source = readFileSync(path.join(process.cwd(), 'components/series/production-data-manager.tsx'), 'utf8');
    expect(source).toContain('disabled={!selectedEpisode || !selectedLocation}');
    expect(source).toContain('value={selectedLocation}');
    expect(source).toContain('buildSceneCreateInput(episode, selectedLocation)');
    expect(source).toContain('body: JSON.stringify(input)');
    expect(source).not.toContain('sceneNumber: 1, title:');
  });
});
