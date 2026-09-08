import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { captionMutationSchema, sceneAudioActionParamsSchema, sceneAudioCreateSchema } from '@/lib/media/api-schemas';
import { CaptionService, renderCaptionContent } from '@/lib/media/caption-service';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';

const owner: AuthenticatedUser = { id: 'caption-owner', email: 'captions@example.test', displayName: 'Caption Owner', provider: 'mock', subject: 'caption-owner' };

async function setup() {
  const repository = new InMemoryPersistenceRepository(); const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Captions', logline: 'Timed dialogue.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 1, episodeDurationSeconds: 60 });
  const character = await production.createCharacter(owner, series.id, { name: 'Mara', role: 'protagonist', age: 32, appearance: 'Dark coat', wardrobe: 'Black coat', personality: 'Direct', voiceProfile: { tone: 'warm', pace: 'normal' } });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'One', synopsis: 'Opening.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'Late at night.' });
  await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Silence.', durationSeconds: 2, visualPrompt: 'Empty office' });
  await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 2, description: 'Mara speaks.', dialogue: 'We have one chance.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara turns' });
  await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 3, description: 'Mara continues.', dialogue: 'Do not waste it.', durationSeconds: 3, characterIds: [character.id], visualPrompt: 'Mara watches' });
  return { repository, service: new CaptionService(repository), series, episode };
}

describe('deterministic caption workflow', () => {
  it('derives ordered SRT and WebVTT cues from persisted shot timing', async () => {
    const { service, series, episode } = await setup();
    const srt = await service.generateEpisode(owner, series.id, episode.id, { language: 'en', format: 'srt' });
    expect(srt.content).toContain('1\n00:00:02,000 --> 00:00:06,000\nMara: We have one chance.');
    expect(srt.content).toContain('2\n00:00:06,000 --> 00:00:09,000\nMara: Do not waste it.');
    expect(srt.segments.map((segment) => segment.sequence)).toEqual([1, 2]);

    const vtt = await service.generateEpisode(owner, series.id, episode.id, { language: 'en', format: 'vtt' });
    expect(vtt.content).toContain('WEBVTT\n\n00:00:02.000 --> 00:00:06.000\n<v Mara>We have one chance.</v>');
    expect(renderCaptionContent('vtt', vtt.segments)).toBe(vtt.content);
    expect(await service.list(owner, series.id, episode.id)).toHaveLength(2);
  });

  it('preserves versions and human review history when selecting a preferred track', async () => {
    const { service, series, episode } = await setup();
    const first = await service.generateEpisode(owner, series.id, episode.id, { language: 'en', format: 'srt' });
    await service.review(owner, series.id, episode.id, first.id, 'approved', 'Timing checked.');
    await service.setPreferred(owner, series.id, episode.id, first.id);
    const second = await service.generateEpisode(owner, series.id, episode.id, { language: 'en', format: 'srt' });
    expect(second.version).toBe(2);
    await expect(service.setPreferred(owner, series.id, episode.id, second.id)).rejects.toThrow('approved');
    await service.review(owner, series.id, episode.id, second.id, 'approved');
    await service.setPreferred(owner, series.id, episode.id, second.id);
    const tracks = await service.list(owner, series.id, episode.id);
    expect(tracks.find((track) => track.id === first.id)).toMatchObject({ preferred: false, reviewStatus: 'superseded' });
    expect(tracks.find((track) => track.id === second.id)).toMatchObject({ preferred: true, reviewStatus: 'approved' });
    expect((await service.export(owner, series.id, episode.id, second.id)).content).toBe(second.content);
  });

  it('validates nested audio and caption mutations', () => {
    expect(sceneAudioCreateSchema.safeParse({ mode: 'line' }).success).toBe(false);
    expect(sceneAudioActionParamsSchema.safeParse({ id: 's', episodeId: 'e', sceneId: 'c', jobId: 'j', action: 'asset-approve' }).success).toBe(true);
    expect(captionMutationSchema.safeParse({ action: 'generate', language: 'e', format: 'srt' }).success).toBe(false);
    expect(captionMutationSchema.safeParse({ action: 'preferred', trackId: '' }).success).toBe(false);
  });
});
