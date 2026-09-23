import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { AudioGenerationService } from '@/lib/media/audio-service';
import type { GenerationConfig } from '@/lib/media/config';
import type { ProviderLogEvent } from '@/lib/media/provider-logging';
import { ProviderRegistry } from '@/lib/media/providers/registry';
import type { MediaProvider } from '@/lib/media/providers/types';
import { GoogleCloudTtsProvider } from '@/lib/media/adapters/google-cloud-tts-provider';
import type { SpeechTransport } from '@/lib/media/providers/transport';
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
  const location = await production.createLocation(owner, series.id, { name: 'Office', description: 'Late at night.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'Late at night.', locationId: location.id });
  const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Mara answers.', dialogue: 'The truth always leaves a shadow.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara in a dim office' });
  return { repository, production, service: new AudioGenerationService(repository), review: new MediaReviewService(repository), series, episode, scene, shot, character };
}

async function complete(service: AudioGenerationService, ids: string[], jobId: string) {
  let job = await service.start(owner, ids, jobId);
  while (job.status !== 'completed') job = await service.refresh(owner, ids, jobId);
  return job;
}

function elevenLabsPreparationService(repository: InMemoryPersistenceRepository) {
  const generateSpeech = vi.fn(async () => { throw new Error('Speech generation must not run during preparation'); });
  const estimateCost = vi.fn(async () => 0.0123);
  const unsupported = async () => { throw new Error('Unexpected provider operation'); };
  const provider: MediaProvider = {
    id: 'elevenlabs-voice',
    capabilities: { textToSpeech: true, speechGeneration: true, synchronous: true, costEstimation: true },
    generateImage: unsupported,
    generateVideo: unsupported,
    generateSpeech,
    extendVideo: unsupported,
    imageToVideo: unsupported,
    getStatus: unsupported,
    cancelJob: unsupported,
    estimateCost,
  };
  const registry = new ProviderRegistry({ 'elevenlabs-voice': () => provider });
  const config: GenerationConfig = {
    imageProvider: 'mock', videoProvider: 'mock', audioProvider: 'elevenlabs-voice', geminiModel: 'mock-v1', defaultAudioLanguage: 'en',
    providers: {
      mock: { imageModel: 'mock-v1', videoModel: 'mock-v1', audioModel: 'mock-v1' },
      'gemini-image': {},
      'vertex-video': {},
      'elevenlabs-voice': { apiKey: 'unit-test-placeholder', audioModel: 'eleven_multilingual_v2', outputFormat: 'mp3_44100_128' },
      'google-cloud-tts': { projectId: 'test-project', outputStorageUri: 'gs://test-bucket/sceneforge', audioModel: 'chirp-3-hd', outputFormat: 'MP3', pricePerMillionCharacters: '30', pricingVersion: 'test-v1' },
    },
  };
  return { service: new AudioGenerationService(repository, { registry, loadConfig: () => config }), generateSpeech, estimateCost };
}

function googleTtsService(repository: InMemoryPersistenceRepository) {
  const submitSpeechGeneration = vi.fn(async (request: Parameters<SpeechTransport['submitSpeechGeneration']>[0]) => {
    void request;
    return {
      jobId: 'fake-google-tts-job', status: 'succeeded' as const,
      output: { uri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_shot_1_1/v1.mp3', storageUri: 'gs://test-bucket/sceneforge/audio/google-cloud-tts/audio_shot_1_1/v1.mp3', mimeType: 'audio/mpeg', width: 0, height: 0, codec: 'mp3', metadata: { storage: 'private-gcs' } },
      metadata: { synchronous: true },
    };
  });
  const transport: SpeechTransport = { submitSpeechGeneration, getSpeechGenerationStatus: vi.fn() };
  const providerConfig = { projectId: 'test-project', outputStorageUri: 'gs://test-bucket/sceneforge', audioModel: 'chirp-3-hd', outputFormat: 'MP3', pricePerMillionCharacters: '30', pricingVersion: 'test-v1' };
  const provider = new GoogleCloudTtsProvider(providerConfig, transport);
  const registry = new ProviderRegistry({ 'google-cloud-tts': () => provider });
  const config: GenerationConfig = {
    imageProvider: 'mock', videoProvider: 'mock', audioProvider: 'google-cloud-tts', geminiModel: 'mock-v1', defaultAudioLanguage: 'en-US',
    providers: { mock: {}, 'gemini-image': {}, 'vertex-video': {}, 'elevenlabs-voice': {}, 'google-cloud-tts': providerConfig },
  };
  return { service: new AudioGenerationService(repository, { registry, loadConfig: () => config }), submitSpeechGeneration };
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

  it('prepares an ElevenLabs-compatible profile for approval without speech generation or network work', async () => {
    const { repository, production, series, episode, scene, shot, character } = await setup();
    await production.updateCharacter(owner, series.id, character.id, { voiceProfile: { provider: 'elevenlabs-voice', providerVoiceId: 'catalog_voice_test', displayName: 'Mara Catalog Voice', language: 'en', locale: 'en-US', active: true, tone: 'warm', pace: 'normal' } });
    const { service, generateSpeech, estimateCost } = elevenLabsPreparationService(repository);
    const prepared = await service.prepareLine(owner, series.id, episode.id, scene.id, shot.id);
    expect(prepared).toMatchObject({ status: 'awaiting_approval', provider: 'elevenlabs-voice', providerVoiceId: 'catalog_voice_test', characterId: character.id, language: 'en' });
    expect(estimateCost).toHaveBeenCalledOnce();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('keeps provider mismatch and missing provider voice ID blocked', async () => {
    const mismatch = await setup();
    const mismatchProvider = elevenLabsPreparationService(mismatch.repository);
    await expect(mismatchProvider.service.prepareLine(owner, mismatch.series.id, mismatch.episode.id, mismatch.scene.id, mismatch.shot.id)).rejects.toThrow('does not match');
    expect(mismatchProvider.estimateCost).not.toHaveBeenCalled();
    expect(mismatchProvider.generateSpeech).not.toHaveBeenCalled();

    const missing = await setup();
    await missing.production.updateCharacter(owner, missing.series.id, missing.character.id, { voiceProfile: { provider: 'elevenlabs-voice', providerVoiceId: '', displayName: 'Missing Voice', active: true, tone: 'warm', pace: 'normal' } });
    const missingProvider = elevenLabsPreparationService(missing.repository);
    await expect(missingProvider.service.prepareLine(owner, missing.series.id, missing.episode.id, missing.scene.id, missing.shot.id)).rejects.toThrow('provider voice ID');
    expect(missingProvider.estimateCost).not.toHaveBeenCalled();
    expect(missingProvider.generateSpeech).not.toHaveBeenCalled();
  });

  it('keeps inactive ElevenLabs voice profiles blocked before provider work', async () => {
    const context = await setup();
    await context.production.updateCharacter(owner, context.series.id, context.character.id, { voiceProfile: { provider: 'elevenlabs-voice', providerVoiceId: 'catalog_voice_test', displayName: 'Inactive Voice', active: false, tone: 'warm', pace: 'normal' } });
    const provider = elevenLabsPreparationService(context.repository);
    await expect(provider.service.prepareLine(owner, context.series.id, context.episode.id, context.scene.id, context.shot.id)).rejects.toThrow('inactive');
    expect(provider.estimateCost).not.toHaveBeenCalled();
    expect(provider.generateSpeech).not.toHaveBeenCalled();
  });

  it('preserves approval while completing Google TTS into canonical private GCS with deterministic cost', async () => {
    const context = await setup();
    await context.production.updateCharacter(owner, context.series.id, context.character.id, { voiceProfile: { provider: 'google-cloud-tts', providerVoiceId: 'en-US-Chirp3-HD-TestVoice', displayName: 'Mara Chirp Voice', language: 'en-US', locale: 'en-US', active: true, tone: 'warm', pace: 'normal' } });
    const { service, submitSpeechGeneration } = googleTtsService(context.repository);
    const ids: [string, string, string, string] = [context.series.id, context.episode.id, context.scene.id, context.shot.id];
    const prepared = await service.prepareLine(owner, ...ids);
    expect(prepared).toMatchObject({ status: 'awaiting_approval', provider: 'google-cloud-tts', providerModel: 'chirp-3-hd', language: 'en-US', generationParameters: { outputFormat: 'MP3', pace: 'normal', costAccounting: { unitCount: 33, unitPricePerMillion: 30, pricingVersion: 'test-v1' } } });
    expect(submitSpeechGeneration).not.toHaveBeenCalled();
    await expect(service.start(owner, ids, prepared.id)).rejects.toThrow('approval');
    await service.approve(owner, ids, prepared.id);
    const completed = await service.start(owner, ids, prepared.id);
    expect(completed).toMatchObject({ status: 'completed', actualCost: prepared.estimatedCost, completionMetadata: { costAccounting: { billingSource: 'calculated-configured-rate' } } });
    expect(submitSpeechGeneration).toHaveBeenCalledOnce();
    expect(submitSpeechGeneration.mock.calls[0][0]).toMatchObject({ operationId: prepared.id, outputFormat: 'MP3' });
    expect(submitSpeechGeneration.mock.calls[0][0]).not.toHaveProperty('stability');
    const [asset] = await context.repository.listGeneratedAssets(...ids);
    expect(asset).toMatchObject({ uri: expect.stringMatching(/^gs:\/\/test-bucket\/sceneforge\//), storageUri: expect.stringMatching(/^gs:\/\/test-bucket\/sceneforge\//), reviewStatus: 'pending' });
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
