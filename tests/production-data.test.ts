import { describe, expect, it } from 'vitest';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { AuthenticatedUser } from '@/lib/auth';

const owner: AuthenticatedUser = { id: 'production-data-owner', email: 'data@example.test', displayName: 'Data Owner', provider: 'mock', subject: 'data-owner' };
const editor: AuthenticatedUser = { id: 'production-data-editor', email: 'data-editor@example.test', displayName: 'Data Editor', provider: 'mock', subject: 'data-editor' };
const input = { title: 'Production Data Test', logline: 'A test production.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 10, episodeDurationSeconds: 75 };

async function setup() {
  const repository = new InMemoryPersistenceRepository();
  const service = new ProductionService(repository);
  const series = await service.createSeries(owner, input);
  const persistedEditor = await repository.upsertUserIdentity({ email: editor.email, displayName: editor.displayName, provider: editor.provider, providerSubject: editor.subject });
  await repository.upsertMembership({ id: 'editor-membership', userId: persistedEditor.id, seriesId: series.id, role: 'EDITOR' });
  return { repository, service, series };
}

describe('production data foundation', () => {
  it('supports character, location, and episode CRUD', async () => {
    const { service, series } = await setup();
    const character = await service.createCharacter(editor, series.id, { name: 'Avery', role: 'protagonist', age: 30, appearance: 'Sharp-eyed', personality: 'Curious', wardrobe: 'Black coat', voiceProfile: { tone: 'warm', pace: 'normal' } });
    const location = await service.createLocation(editor, series.id, { name: 'Archive', description: 'A sealed archive.' });
    const episode = await service.createEpisode(editor, series.id, { episodeNumber: 1, title: 'The Door', synopsis: 'A door opens.' });

    expect((await service.listCharacters(owner, series.id))[0].id).toBe(character.id);
    expect((await service.listLocations(owner, series.id))[0].id).toBe(location.id);
    expect((await service.listEpisodes(owner, series.id))[0].id).toBe(episode.id);
  });

  it('rejects duplicate episode and scene numbers', async () => {
    const { service, series } = await setup();
    const episode = await service.createEpisode(editor, series.id, { episodeNumber: 1, title: 'One', synopsis: 'One.' });
    const location = await service.createLocation(editor, series.id, { name: 'Office', description: 'Production office.' });
    await expect(service.createEpisode(editor, series.id, { episodeNumber: 1, title: 'Duplicate', synopsis: 'Duplicate.' })).rejects.toThrow('unique');
    await service.createScene(editor, series.id, episode.id, { sceneNumber: 1, title: 'Opening', description: 'Open.', locationId: location.id });
    expect((await service.listEpisodes(editor, series.id))[0].scenes.map((scene) => scene.sceneNumber)).toEqual([1]);
    await expect(service.createScene(editor, series.id, episode.id, { sceneNumber: 1, title: 'Duplicate', description: 'Duplicate.', locationId: location.id })).rejects.toThrow('unique');
  });

  it('rejects cross-production location references and persists temporal story facts', async () => {
    const { repository, service, series } = await setup();
    const other = await service.createSeries(owner, { ...input, title: 'Other Production' });
    const persistedEditor = await repository.findUserByEmail(editor.email);
    await repository.upsertMembership({ id: 'other-editor-membership', userId: persistedEditor!.id, seriesId: other.id, role: 'EDITOR' });
    const foreignLocation = await service.createLocation(editor, other.id, { name: 'Foreign', description: 'Other production.' });
    const episode = await service.createEpisode(editor, series.id, { episodeNumber: 1, title: 'One', synopsis: 'One.' });
    await expect(service.createScene(editor, series.id, episode.id, { sceneNumber: 1, title: 'Bad', description: 'Bad.', locationId: foreignLocation.id })).rejects.toThrow('belong');
    await service.createStoryFact(editor, series.id, { subjectType: 'character', category: 'injury', description: 'Avery is injured.', source: 'episode outline', validFromEpisode: 2, validUntilEpisode: 4 });
    expect((await service.listStoryFacts(owner, series.id))[0].description).toBe('Avery is injured.');
    await expect(repository.getActiveFacts(series.id, 1)).resolves.toHaveLength(0);
  });

  it('rejects stale or cross-production character assignments on shot writes', async () => {
    const { repository, service, series } = await setup();
    const other = await service.createSeries(owner, { ...input, title: 'Other Character Production' });
    const persistedEditor = await repository.findUserByEmail(editor.email);
    await repository.upsertMembership({ id: 'other-character-editor-membership', userId: persistedEditor!.id, seriesId: other.id, role: 'EDITOR' });
    const foreignCharacter = await service.createCharacter(editor, other.id, { name: 'Outsider', role: 'minor', age: 40, appearance: 'Unknown', personality: 'Reserved', wardrobe: 'Grey coat', voiceProfile: { tone: 'quiet', pace: 'normal' } });
    const location = await service.createLocation(editor, series.id, { name: 'Stage', description: 'A production stage.' });
    const episode = await service.createEpisode(editor, series.id, { episodeNumber: 1, title: 'One', synopsis: 'One.' });
    const scene = await service.createScene(editor, series.id, episode.id, { sceneNumber: 1, title: 'Opening', description: 'Open.', locationId: location.id });
    const shot = await service.createShot(editor, series.id, episode.id, scene.id, { shotNumber: 1, description: 'An empty line.', durationSeconds: 4, visualPrompt: 'A stage.' });

    await expect(service.updateShot(editor, series.id, episode.id, scene.id, shot.id, { characterIds: [foreignCharacter.id], dialogue: 'Not allowed.' })).rejects.toThrow('belong to the production');
    await expect(service.updateShot(editor, series.id, episode.id, scene.id, shot.id, { characterIds: ['character_missing'], dialogue: 'Also not allowed.' })).rejects.toThrow('belong to the production');
    await expect(service.updateShot(editor, series.id, episode.id, scene.id, shot.id, { characterIds: [], dialogue: '' })).resolves.toMatchObject({ characterIds: [], dialogue: '' });
  });
});
