import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { AudioGenerationService } from '@/lib/media/audio-service';
import type { ProviderLogEvent } from '@/lib/media/provider-logging';
import { MediaReviewService } from '@/lib/media/review-service';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';

const owner: AuthenticatedUser = { id: 'audio-owner', email: 'audio@example.test', displayName: 'Audio Owner', provider: 'mock', subject: 'audio-owner' };

async function setup(sourceType: 'synthetic' | 'cloned' = 'synthetic', consentConfirmed = true) {
  const repository = new InMemoryPersistenceRepository();
  const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Voices', logline: 'A spoken drama.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 1, episodeDurationSeconds: 60 });
  const character = await production.createCharacter(owner, series.id, {
    name: 'Mara', role: 'protagonist', age: 32, appearance: 'Dark coat', wardrobe: 'Tailored black coat', personality: 'Measured and incisive',
    voiceProfile: {
      tone: 'warm', pace: 'normal', provider: 'mock', providerVoiceId: 'voice-mara', language: 'en', locale: 'en-US', stability: 0.65, similarityBoost: 0.8, styleExaggeration: 0.2, speakerBoost: true,
      rights: { sourceType, rightsConfirmed: true, consentConfirmed, approvalState: sourceType === 'synthetic' ? 'not-required' : 'approved', confirmedAt: consentConfirmed ? new Date('2026-01-01T00:00:00Z') : undefined },
    },
  });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'One', synopsis: 'Opening.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'Late at night.' });
  const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Mara answers.', dialogue: 'The truth always leaves a shadow.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara in a dim office' });
  return { repository, production, service: new AudioGenerationService(repository), review: new MediaReviewService(repository), series, episode, scene, shot, character };
}

async function complete(service: AudioGenerationService, ids: string[], jobId: string) {
  let job = await service.start(owner, ids, jobId);
  while (job.status !== 'completed') job = await service.refresh(owner, ids, jobId);
  return job;
}

describe('audio generation lifecycle', () => {
  it('snapshots dialogue and voice settings, gates submission, and persists normalized audio', async () => {
    const { repository, service, review, series, episode, scene, shot, character } = await setup();
    const ids: [string, string, string, string] = [series.id, episode.id, scene.id, shot.id];
    const prepared = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    expect(prepared).toMatchObject({ generationType: 'audio', status: 'awaiting_approval', provider: 'mock', providerVoiceId: 'voice-mara', characterId: character.id, language: 'en', promptSnapshot: 'The truth always leaves a shadow.' });
    expect(prepared.generationParameters).toMatchObject({ stability: 0.65, similarityBoost: 0.8, outputFormat: 'mp3_44100_128' });
    await expect(service.start(owner, ids, prepared.id)).rejects.toThrow('approval');

    await service.approve(owner, ids, prepared.id);
    const completed = await complete(service, ids, prepared.id);
    expect(completed.status).toBe('completed');
    const [asset] = await repository.listGeneratedAssets(...ids);
    expect(asset).toMatchObject({ assetType: 'audio', mimeType: 'audio/mpeg', codec: 'mp3', sampleRate: 44_100, bitrate: 128_000, channels: 1, version: 1, reviewStatus: 'pending', sourceTextSnapshot: prepared.promptSnapshot });
    expect(asset.uri).toContain('mock://');
    expect((await service.refresh(owner, ids, prepared.id)).outputAssetIds).toEqual([asset.id]);
    expect(await repository.listGeneratedAssets(...ids)).toHaveLength(1);

    await review.submitReview(owner, ids, asset.id, 'approved', { notes: 'Voice and timing approved.' });
    expect((await review.selectPreferredAsset(owner, ids, asset.id)).preferred).toBe(true);
  });

  it('supports cancellation, retry approval, regeneration history, and media-type-scoped preference', async () => {
    const { repository, service, review, series, episode, scene, shot } = await setup();
    const ids: [string, string, string, string] = [series.id, episode.id, scene.id, shot.id];
    const first = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    await service.approve(owner, ids, first.id);
    await complete(service, ids, first.id);
    const firstAsset = (await repository.listGeneratedAssets(...ids))[0];
    await review.submitReview(owner, ids, firstAsset.id, 'approved');
    await review.selectPreferredAsset(owner, ids, firstAsset.id);

    const second = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    await service.approve(owner, ids, second.id);
    await complete(service, ids, second.id);
    const secondAsset = (await repository.listGeneratedAssets(...ids)).find((asset) => asset.generationJobId === second.id)!;
    expect(secondAsset).toMatchObject({ version: 2, parentAssetId: firstAsset.id });
    await review.submitReview(owner, ids, secondAsset.id, 'approved');

    await repository.createGeneratedAsset({ ...firstAsset, id: 'preferred-video', generationJobId: 'video-job', assetType: 'video-clip', uri: 'mock://video.mp4', mimeType: 'video/mp4', preferred: true, version: 1 });
    await review.selectPreferredAsset(owner, ids, secondAsset.id);
    expect((await repository.getGeneratedAsset(...ids, firstAsset.id))?.reviewStatus).toBe('rejected');
    expect((await repository.getGeneratedAsset(...ids, 'preferred-video'))?.preferred).toBe(true);

    const cancellable = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    expect((await service.cancel(owner, ids, cancellable.id)).status).toBe('cancelled');
    const retry = await service.retry(owner, ids, cancellable.id);
    expect(retry).toMatchObject({ status: 'awaiting_approval', retryCount: 1 });
  });

  it('blocks cloned or reference-derived voices without approved rights and consent', async () => {
    const { service, series, episode, scene, shot } = await setup('cloned', false);
    await expect(service.prepareLine(owner, series.id, episode.id, scene.id, shot.id)).rejects.toThrow('rights and consent');
  });

  it('blocks reference metadata when no rights record exists', async () => {
    const { production, service, series, episode, scene, shot, character } = await setup();
    await production.updateCharacter(owner, series.id, character.id, { voiceProfile: { ...character.voiceProfile, reference: { referenceId: 'internal-reference', checksum: 'sha256-test' }, rights: undefined } });
    await expect(service.prepareLine(owner, series.id, episode.id, scene.id, shot.id)).rejects.toThrow('metadata is required');
  });

  it('emits structured audio lifecycle metadata without dialogue or credentials', async () => {
    const { repository, series, episode, scene, shot } = await setup();
    const events: ProviderLogEvent[] = [];
    const service = new AudioGenerationService(repository, { logger: { write: (event) => events.push(event) } });
    const ids: [string, string, string, string] = [series.id, episode.id, scene.id, shot.id];
    const job = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    await service.approve(owner, ids, job.id);
    await complete(service, ids, job.id);
    expect(events.map((event) => event.operation)).toEqual(['submit', 'poll', 'poll', 'complete']);
    expect(events[0]).toMatchObject({ provider: 'mock', model: 'mock-v1', voiceId: 'voice-mara', status: 'queued' });
    expect(JSON.stringify(events)).not.toContain(job.promptSnapshot);
    expect(JSON.stringify(events)).not.toMatch(/api.?key|authorization|rightsConfirmed/i);
  });
});
