import { describe, expect, it } from 'vitest';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { AuthenticatedUser } from '@/lib/auth';
import { OrchestrationService } from '@/lib/orchestration';

const owner: AuthenticatedUser = { id: 'storyboard-owner', email: 'storyboard@example.test', displayName: 'Storyboard Owner', provider: 'mock', subject: 'storyboard-owner' };
const input = { title: 'Storyboard Test', logline: 'A production.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 4, episodeDurationSeconds: 75 };

async function setup() { const repository = new InMemoryPersistenceRepository(); const service = new ProductionService(repository); const series = await service.createSeries(owner, input); const episode = await service.createEpisode(owner, series.id, { episodeNumber: 1, title: 'Opening', synopsis: 'Opening.' }); const scene = await service.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Opening scene', description: 'Scene.' }); return { repository, service, series, episode, scene }; }

describe('storyboard production', () => {
  it('creates, orders, and persists shots with a storyboard placeholder', async () => {
    const { service, series, episode, scene } = await setup();
    const first = await service.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, title: 'Wide', description: 'A wide view.', durationSeconds: 4, visualPrompt: 'A cinematic vertical city view.' });
    const second = await service.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 2, title: 'Close', description: 'A close view.', durationSeconds: 3, visualPrompt: 'A cinematic vertical face close-up.' });
    const reordered = await service.reorderShots(owner, series.id, episode.id, scene.id, [second.id, first.id]);
    const storyboard = await service.createStoryboard(owner, series.id, episode.id, scene.id, second.id);
    expect(reordered[0].shotNumber).toBe(1);
    expect(reordered[0].id).toBe(second.id);
    expect(storyboard.generationStatus).toBe('placeholder');
    expect(storyboard.aspectRatio).toBe('9:16');
  });

  it('returns structured readiness blockers and warnings', async () => {
    const { service, series, episode, scene } = await setup();
    const shot = await service.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Needs a prompt.', durationSeconds: 3, visualPrompt: 'Prompt' });
    const readiness = await service.getShotReadiness(owner, series.id, episode.id, scene.id, shot.id);
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings).toContain('No characters are attached to this shot.');
  });

  it('persists shots and makes them available to orchestration context', async () => {
    const { repository, service, series, episode, scene } = await setup();
    await service.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Persisted shot.', durationSeconds: 4, visualPrompt: 'A persisted vertical shot.' });
    const pipeline = await new OrchestrationService(repository).run('ep_1', series.id, owner.id);
    if (pipeline.error) throw new Error(pipeline.error);
    expect(pipeline.state).toBe('READY_FOR_APPROVAL');
  });
});
