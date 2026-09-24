import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { EpisodeAssemblyService, validateAssemblyTimeline } from '@/lib/assembly';
import { generatedMediaSourcePolicy } from '@/lib/export/source-safety';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { CaptionTrack, EpisodeAssembly, GeneratedAsset } from '@/types';

const owner: AuthenticatedUser = { id: 'assembly-owner', email: 'assembly@example.test', displayName: 'Assembly Owner', provider: 'mock', subject: 'assembly-owner' };
const viewer: AuthenticatedUser = { id: 'assembly-viewer', email: 'viewer@example.test', displayName: 'Assembly Viewer', provider: 'invited', subject: 'viewer@example.test' };

function asset(input: Partial<GeneratedAsset> & Pick<GeneratedAsset, 'id' | 'generationJobId' | 'seriesId' | 'episodeId' | 'sceneId' | 'shotId' | 'assetType' | 'durationSeconds' | 'version'>): GeneratedAsset {
  const now = new Date('2026-01-01T00:00:00Z');
  return { uri: `mock://output/${input.id}.${input.assetType === 'audio' ? 'mp3' : 'mp4'}`, mimeType: input.assetType === 'audio' ? 'audio/mpeg' : 'video/mp4', width: input.assetType === 'audio' ? 0 : 1080, height: input.assetType === 'audio' ? 0 : 1920, provider: 'mock', fingerprint: input.id, reviewStatus: 'approved', preferred: false, createdAt: now, updatedAt: now, ...input };
}

async function setup(options: { missingSecondVideo?: boolean; missingAudio?: boolean } = {}) {
  const repository = new InMemoryPersistenceRepository(); const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Assembly', logline: 'Assembled.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic', episodeCount: 1, episodeDurationSeconds: 60 });
  await production.addMember(owner, series.id, { email: viewer.email, displayName: viewer.displayName, role: 'VIEWER' });
  const character = await production.createCharacter(owner, series.id, { name: 'Mara', role: 'protagonist', age: 30, appearance: 'Dark coat', wardrobe: 'Black coat', personality: 'Direct', voiceProfile: { tone: 'warm', pace: 'normal' } });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'One', synopsis: 'Opening.' });
  const location = await production.createLocation(owner, series.id, { name: 'Office', description: 'Office and hall.' });
  const sceneTwo = await production.createScene(owner, series.id, episode.id, { sceneNumber: 2, title: 'Hall', description: 'Later.', locationId: location.id });
  const sceneOne = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'First.', locationId: location.id });
  const shotTwo = await production.createShot(owner, series.id, episode.id, sceneTwo.id, { shotNumber: 1, description: 'Exit.', durationSeconds: 3, visualPrompt: 'Exit hall' });
  const shotOne = await production.createShot(owner, series.id, episode.id, sceneOne.id, { shotNumber: 1, description: 'Speak.', dialogue: 'We leave now.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara speaks' });
  const firstVideo = asset({ id: 'video-one-v1', generationJobId: 'g-video-one-v1', seriesId: series.id, episodeId: episode.id, sceneId: sceneOne.id, shotId: shotOne.id, assetType: 'video-clip', durationSeconds: 4, version: 1, preferred: true });
  const laterVideo = asset({ id: 'video-one-v2', generationJobId: 'g-video-one-v2', seriesId: series.id, episodeId: episode.id, sceneId: sceneOne.id, shotId: shotOne.id, assetType: 'video-clip', durationSeconds: 5, version: 2 });
  const rejected = asset({ id: 'video-one-rejected', generationJobId: 'g-video-one-rejected', seriesId: series.id, episodeId: episode.id, sceneId: sceneOne.id, shotId: shotOne.id, assetType: 'video-clip', durationSeconds: 6, version: 3, preferred: true, reviewStatus: 'rejected' });
  const dialogue = asset({ id: 'audio-one', generationJobId: 'g-audio-one', seriesId: series.id, episodeId: episode.id, sceneId: sceneOne.id, shotId: shotOne.id, assetType: 'audio', durationSeconds: 3.9, version: 1, preferred: true });
  for (const value of [firstVideo, laterVideo, rejected]) await repository.createGeneratedAsset(value);
  if (!options.missingAudio) await repository.createGeneratedAsset(dialogue);
  if (!options.missingSecondVideo) await repository.createGeneratedAsset(asset({ id: 'video-two', generationJobId: 'g-video-two', seriesId: series.id, episodeId: episode.id, sceneId: sceneTwo.id, shotId: shotTwo.id, assetType: 'video-clip', durationSeconds: 3, version: 1 }));
  const now = new Date('2026-01-01T00:00:00Z'); const caption: CaptionTrack = { id: 'captions-approved', seriesId: series.id, episodeId: episode.id, language: 'en', format: 'srt', source: 'dialogue-timing', content: '1\n00:00:00,000 --> 00:00:03,900\nMara: We leave now.\n', version: 1, reviewStatus: 'approved', preferred: true, generatedAt: now, createdAt: now, updatedAt: now, segments: [{ id: 'caption-1', trackId: 'captions-approved', sequence: 1, sceneId: sceneOne.id, shotId: shotOne.id, startMs: 0, endMs: 3900, text: 'We leave now.', speaker: 'Mara', characterId: character.id }] };
  await repository.createCaptionTrack(caption);
  return { repository, production, service: new EpisodeAssemblyService(repository), series, episode, sceneOne, sceneTwo, shotOne, shotTwo, firstVideo, laterVideo, caption };
}

async function selectedAssets(repository: InMemoryPersistenceRepository, assembly: EpisodeAssembly): Promise<Map<string, GeneratedAsset>> {
  const values = new Map<string, GeneratedAsset>();
  for (const item of assembly.items) for (const id of [item.videoAssetId, item.audioAssetId]) if (id) {
    const value = await repository.getGeneratedAsset(assembly.seriesId, assembly.episodeId, item.sceneId, item.shotId, id);
    if (value) values.set(id, value);
  }
  return values;
}

const trustedGcsPolicy = generatedMediaSourcePolicy({ engine: 'ffmpeg-local', mediaStorageUri: 'gs://test-bucket/sceneforge' }, true);

describe('episode assembly', () => {
  it('orders canonical shots and deterministically selects approved preferred media', async () => {
    const { service, series, episode, sceneOne, sceneTwo, shotOne, shotTwo, firstVideo, caption } = await setup();
    const assembly = await service.build(owner, series.id, episode.id);
    expect(assembly).toMatchObject({ version: 1, status: 'validated', validationPassed: true, captionTrackId: caption.id, timelineDurationMs: 7000, aspectRatio: '9:16', width: 1080, height: 1920, frameRate: 30 });
    expect(assembly.items.map((item) => [item.sceneId, item.shotId, item.startMs, item.endMs])).toEqual([[sceneOne.id, shotOne.id, 0, 4000], [sceneTwo.id, shotTwo.id, 4000, 7000]]);
    expect(assembly.items[0]).toMatchObject({ videoAssetId: firstVideo.id, videoSelectionReason: 'preferred-approved', audioAssetId: 'audio-one', audioSelectionReason: 'preferred-approved' });
    expect(assembly.items.some((item) => item.videoAssetId === 'video-one-rejected')).toBe(false);
    expect((await service.build(owner, series.id, episode.id)).id).toBe(assembly.id);
  });

  it('reports actionable missing video and dialogue audio blockers', async () => {
    const { service, series, episode } = await setup({ missingSecondVideo: true, missingAudio: true });
    const assembly = await service.build(owner, series.id, episode.id);
    expect(assembly.validationPassed).toBe(false);
    expect(assembly.validationIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['MISSING_VIDEO', 'MISSING_DIALOGUE_AUDIO']));
    await expect(service.approve(owner, series.id, episode.id, assembly.id)).rejects.toThrow('validation');
  });

  it('detects invalid trims, gaps, overlaps, and captions outside the timeline', async () => {
    const { service, repository, series, episode, caption } = await setup(); const base = await service.build(owner, series.id, episode.id);
    const broken: EpisodeAssembly = structuredClone(base); broken.items[0].trimInMs = 4000; broken.items[1].startMs = 3500; broken.timelineDurationMs = 6500;
    const assets = new Map<string, GeneratedAsset>(); for (const item of base.items) for (const id of [item.videoAssetId, item.audioAssetId]) if (id) { const value = await repository.getGeneratedAsset(series.id, episode.id, item.sceneId, item.shotId, id); if (value) assets.set(id, value); }
    const lateCaption = { ...caption, segments: [{ ...caption.segments[0], endMs: 8000 }] };
    expect(validateAssemblyTimeline(broken, { assets, captionTrack: lateCaption }).map((issue) => issue.code)).toEqual(expect.arrayContaining(['INVALID_TRIM', 'TIMELINE_OVERLAP', 'CAPTION_OUT_OF_RANGE']));
    broken.items[1].startMs = 4500; broken.items[1].endMs = 7500; broken.timelineDurationMs = 7500;
    expect(validateAssemblyTimeline(broken, { assets, captionTrack: caption }).map((issue) => issue.code)).toContain('TIMELINE_GAP');
  });

  it('accepts approved SceneForge-managed GCS video and Google TTS audio inside the configured root', async () => {
    const { service, repository, series, episode, caption } = await setup();
    const assembly = await service.build(owner, series.id, episode.id);
    const assets = await selectedAssets(repository, assembly);
    const videoId = assembly.items[0].videoAssetId!;
    const audioId = assembly.items[0].audioAssetId!;
    assets.set(videoId, { ...assets.get(videoId)!, provider: 'vertex-video', uri: 'gs://test-bucket/sceneforge/video/clip.mp4', storageUri: 'gs://test-bucket/sceneforge/video/clip.mp4' });
    assets.set(audioId, { ...assets.get(audioId)!, provider: 'google-cloud-tts', uri: 'gs://test-bucket/sceneforge/audio/dialogue.mp3', storageUri: 'gs://test-bucket/sceneforge/audio/dialogue.mp3' });
    expect(validateAssemblyTimeline(assembly, { assets, captionTrack: caption, sourcePolicy: trustedGcsPolicy }).map((issue) => issue.code)).not.toContain('UNSAFE_SOURCE');
  });

  it('rejects out-of-prefix, different-bucket, malformed, and unapproved GCS assets', async () => {
    const { service, repository, series, episode, caption } = await setup();
    const assembly = await service.build(owner, series.id, episode.id);
    const baseline = await selectedAssets(repository, assembly);
    const videoId = assembly.items[0].videoAssetId!;
    for (const uri of ['gs://test-bucket/other/clip.mp4', 'gs://other-bucket/sceneforge/clip.mp4', 'gs://test-bucket/sceneforge/../clip.mp4']) {
      const assets = new Map(baseline);
      assets.set(videoId, { ...assets.get(videoId)!, uri, storageUri: uri });
      expect(validateAssemblyTimeline(assembly, { assets, captionTrack: caption, sourcePolicy: trustedGcsPolicy }).map((issue) => issue.code)).toContain('UNSAFE_SOURCE');
    }
    const assets = new Map(baseline);
    assets.set(videoId, { ...assets.get(videoId)!, uri: 'gs://test-bucket/sceneforge/video/clip.mp4', storageUri: 'gs://test-bucket/sceneforge/video/clip.mp4', reviewStatus: 'pending' });
    const codes = validateAssemblyTimeline(assembly, { assets, captionTrack: caption, sourcePolicy: trustedGcsPolicy }).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['REJECTED_ASSET', 'UNSAFE_SOURCE']));
    assets.set(videoId, { ...assets.get(videoId)!, reviewStatus: 'approved' });
    expect(validateAssemblyTimeline(assembly, { assets, captionTrack: caption, sourcePolicy: generatedMediaSourcePolicy({ engine: 'mock', mediaStorageUri: 'gs://test-bucket/sceneforge' }, true) }).map((issue) => issue.code)).toContain('UNSAFE_SOURCE');
  });

  it('keeps the existing public HTTPS policy while rejecting private HTTPS and unsupported sources', async () => {
    const { service, repository, series, episode, caption } = await setup();
    const assembly = await service.build(owner, series.id, episode.id);
    const baseline = await selectedAssets(repository, assembly);
    const videoId = assembly.items[0].videoAssetId!;
    const publicAssets = new Map(baseline);
    publicAssets.set(videoId, { ...publicAssets.get(videoId)!, uri: 'https://media.example.test/clip.mp4', storageUri: undefined });
    expect(validateAssemblyTimeline(assembly, { assets: publicAssets, captionTrack: caption, sourcePolicy: trustedGcsPolicy }).map((issue) => issue.code)).not.toContain('UNSAFE_SOURCE');
    for (const uri of ['https://127.0.0.1/clip.mp4', 'file:///tmp/clip.mp4']) {
      const assets = new Map(baseline);
      assets.set(videoId, { ...assets.get(videoId)!, uri, storageUri: undefined });
      expect(validateAssemblyTimeline(assembly, { assets, captionTrack: caption, sourcePolicy: trustedGcsPolicy }).map((issue) => issue.code)).toContain('UNSAFE_SOURCE');
    }
  });

  it('uses measured or legacy media metadata and preserves genuine audio-over-video blockers', async () => {
    const context = await setup();
    const legacy = await context.repository.getGeneratedAsset(context.series.id, context.episode.id, context.sceneOne.id, context.shotOne.id, 'audio-one');
    await context.repository.updateGeneratedAsset({ ...legacy!, provider: 'google-cloud-tts', durationSeconds: 5, fileSize: 12_000, codec: 'mp3', bitrate: 32_000 });
    const assembly = await context.service.build(owner, context.series.id, context.episode.id);
    expect(assembly.items[0].sourceAudioDurationMs).toBe(3_000);
    expect(assembly.validationIssues.map((issue) => issue.code)).not.toContain('AUDIO_EXCEEDS_CLIP');

    const assets = await selectedAssets(context.repository, assembly);
    const fitting: EpisodeAssembly = structuredClone(assembly);
    fitting.items[0].sourceAudioDurationMs = 4_100;
    expect(validateAssemblyTimeline(fitting, { assets, captionTrack: context.caption }).map((issue) => issue.code)).not.toContain('AUDIO_EXCEEDS_CLIP');
    fitting.items[0].sourceAudioDurationMs = 4_101;
    expect(validateAssemblyTimeline(fitting, { assets, captionTrack: context.caption }).map((issue) => issue.code)).toContain('AUDIO_EXCEEDS_CLIP');
  });

  it('preserves assembly versions, review decisions, and preferred history', async () => {
    const { repository, service, series, episode, firstVideo, laterVideo } = await setup(); const first = await service.build(owner, series.id, episode.id);
    await service.approve(owner, series.id, episode.id, first.id, 'Timeline approved.'); await service.setPreferred(owner, series.id, episode.id, first.id);
    await repository.updateGeneratedAsset({ ...firstVideo, preferred: false }); await repository.updateGeneratedAsset({ ...laterVideo, preferred: true });
    const second = await service.build(owner, series.id, episode.id, first.id); expect(second).toMatchObject({ version: 2, rebuiltFromAssemblyId: first.id }); expect(second.items[0].videoAssetId).toBe(laterVideo.id);
    await service.approve(owner, series.id, episode.id, second.id); await service.setPreferred(owner, series.id, episode.id, second.id);
    const history = await service.list(owner, series.id, episode.id); expect(history).toHaveLength(2); expect(history[0]).toMatchObject({ preferred: false, status: 'approved' }); expect(history[0].supersededAt).toBeInstanceOf(Date); expect(history[1].preferred).toBe(true);
  });

  it('records an owner rejection without mutating the timeline version', async () => {
    const { service, series, episode } = await setup(); const assembly = await service.build(owner, series.id, episode.id);
    const rejected = await service.reject(owner, series.id, episode.id, assembly.id, 'Replace the opening visual.');
    expect(rejected).toMatchObject({ id: assembly.id, version: 1, status: 'rejected', reviewState: 'rejected', reviewNotes: 'Replace the opening visual.', reviewedBy: owner.id });
    expect(rejected.reviewedAt).toBeInstanceOf(Date); expect(rejected.items).toEqual(assembly.items);
  });

  it('requires owner authorization for assembly decisions', async () => {
    const { service, series, episode } = await setup(); const assembly = await service.build(viewer, series.id, episode.id);
    await expect(service.approve(viewer, series.id, episode.id, assembly.id)).rejects.toThrow('role');
    await expect(service.reject(viewer, series.id, episode.id, assembly.id, 'No')).rejects.toThrow('role');
  });
});
