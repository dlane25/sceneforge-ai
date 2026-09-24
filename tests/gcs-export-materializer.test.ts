import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GcsExportMediaMaterializer, type MaterializerFileSystem } from '@/lib/export/gcs-media-materializer';
import { FfmpegExportEngine, type ExportProcessExecutor, type ExportWorkspace } from '@/lib/export/ffmpeg-engine';
import { getExportPreset } from '@/lib/export/presets';
import type { ExportRenderRequest } from '@/lib/export/engine-types';
import type { ExportConfig } from '@/lib/export/config';
import { ExportEngineRegistry } from '@/lib/export/registry';
import { EpisodeExportService } from '@/lib/export/service';
import { generatedMediaSourcePolicy } from '@/lib/export/source-safety';
import { EpisodeAssemblyService } from '@/lib/assembly';
import type { AuthenticatedUser } from '@/lib/auth';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { GeneratedAsset } from '@/types';
import { GoogleCloudPrivateMediaStore, type BinaryHttpClient, type PrivateMediaObjectStore } from '@/lib/storage/google-cloud-media-storage';
import type { AccessTokenProvider } from '@/lib/media/providers/google-transport';

const mediaRoot = path.resolve('test-fixtures', 'managed-media');
const temporaryDirectory = path.join(mediaRoot, '.sceneforge-export-test');
const owner: AuthenticatedUser = { id: 'gcs-export-owner', email: 'gcs-export@example.test', displayName: 'GCS Export Owner', provider: 'mock', subject: 'gcs-export-owner' };

function request(): ExportRenderRequest {
  return {
    exportJobId: 'export-gcs-1', preset: getExportPreset('vertical-social-1080p'), durationMs: 4_000, captionMode: 'none',
    clips: [{ sequence: 1, videoUri: 'gs://test-bucket/sceneforge/video/clip.mp4', audioUri: 'gs://test-bucket/sceneforge/audio/dialogue.mp3', startMs: 0, durationMs: 4_000, trimInMs: 0, trimOutMs: 0, volume: 1, muted: false }],
  };
}

function fileSystem() {
  const fs: MaterializerFileSystem = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn().mockResolvedValue(temporaryDirectory),
    writeFile: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return fs;
}

function workspace(): ExportWorkspace {
  return {
    outputPath: vi.fn().mockResolvedValue(path.resolve('test-fixtures', 'output', 'export-gcs-1.mp4')),
    writeCaption: vi.fn(),
    complete: vi.fn().mockResolvedValue({ uri: 'managed://exports/export-gcs-1.mp4', fileName: 'export-gcs-1.mp4', mimeType: 'video/mp4', durationMs: 4_000 }),
  };
}

describe('authorized GCS-to-FFmpeg materialization', () => {
  it('downloads GCS sources to server-named managed files and never passes gs:// to FFmpeg', async () => {
    const store: PrivateMediaObjectStore = { uploadGeneratedAudio: vi.fn(), downloadAuthorized: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    const fs = fileSystem();
    const materializer = new GcsExportMediaMaterializer(mediaRoot, store, fs);
    const calls: string[][] = [];
    const executor: ExportProcessExecutor = { run: vi.fn(async (_executable, args) => { calls.push(args); return { exitCode: 0 }; }) };
    const engine = new FfmpegExportEngine(mediaRoot, executor, workspace(), 'ffmpeg', materializer);
    await expect(engine.render(request())).resolves.toMatchObject({ status: 'succeeded' });
    expect(store.downloadAuthorized).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(calls[0].join(' ')).not.toContain('gs://');
    expect(calls[0].join(' ')).toContain('.sceneforge-export-test');
    expect(fs.remove).toHaveBeenCalledWith(temporaryDirectory);
  });

  it('cleans temporary materialized files when FFmpeg fails', async () => {
    const store: PrivateMediaObjectStore = { uploadGeneratedAudio: vi.fn(), downloadAuthorized: vi.fn().mockResolvedValue(new Uint8Array([1])) };
    const fs = fileSystem();
    const engine = new FfmpegExportEngine(mediaRoot, { run: vi.fn().mockResolvedValue({ exitCode: 1 }) }, workspace(), 'ffmpeg', new GcsExportMediaMaterializer(mediaRoot, store, fs));
    await expect(engine.render(request())).resolves.toMatchObject({ status: 'failed', error: { code: 'processing_failed' } });
    expect(fs.remove).toHaveBeenCalledWith(temporaryDirectory);
  });

  it('cleans partial materialization after a download failure', async () => {
    const store: PrivateMediaObjectStore = { uploadGeneratedAudio: vi.fn(), downloadAuthorized: vi.fn().mockResolvedValueOnce(new Uint8Array([1])).mockRejectedValueOnce(new Error('fake download failure')) };
    const fs = fileSystem();
    await expect(new GcsExportMediaMaterializer(mediaRoot, store, fs).materialize(request())).rejects.toThrow('fake download failure');
    expect(fs.remove).toHaveBeenCalledWith(temporaryDirectory);
  });

  it('rejects arbitrary buckets, prefixes, object types, and path traversal before download', async () => {
    const token: AccessTokenProvider = { getAccessToken: vi.fn().mockResolvedValue('test-token') };
    const http: BinaryHttpClient = { request: vi.fn() };
    const store = new GoogleCloudPrivateMediaStore({ bucket: 'test-bucket', object: 'sceneforge' }, token, http);
    const fs = fileSystem();
    const materializer = new GcsExportMediaMaterializer(mediaRoot, store, fs);
    for (const uri of ['gs://other-bucket/sceneforge/video.mp4', 'gs://test-bucket/other/video.mp4', 'gs://test-bucket/sceneforge/file.txt', 'gs://test-bucket/sceneforge/../video.mp4']) {
      const value = request(); value.clips[0].videoUri = uri; value.clips[0].audioUri = undefined;
      await expect(materializer.materialize(value)).rejects.toThrow();
    }
    expect(http.request).not.toHaveBeenCalled();
  });

  it('allows an approved trusted-GCS assembly through export while FFmpeg receives only materialized paths', async () => {
    const repository = new InMemoryPersistenceRepository();
    const production = new ProductionService(repository);
    const series = await production.createSeries(owner, { title: 'GCS Export', logline: 'Private media.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Vertical', episodeCount: 1, episodeDurationSeconds: 60 });
    const character = await production.createCharacter(owner, series.id, { name: 'Mara', role: 'protagonist', age: 30, appearance: 'Dark coat', wardrobe: 'Black coat', personality: 'Direct', voiceProfile: { tone: 'warm', pace: 'normal' } });
    const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'One', synopsis: 'Opening.' });
    const location = await production.createLocation(owner, series.id, { name: 'Office', description: 'Night.' });
    const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'Night.', locationId: location.id });
    const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Mara speaks.', dialogue: 'Go now.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara speaks' });
    const now = new Date('2026-01-01T00:00:00Z');
    const common = { seriesId: series.id, episodeId: episode.id, sceneId: scene.id, shotId: shot.id, reviewStatus: 'approved' as const, preferred: true, version: 1, createdAt: now, updatedAt: now };
    const video: GeneratedAsset = { ...common, id: 'gcs-video', generationJobId: 'gcs-video-job', assetType: 'video-clip', uri: 'gs://test-bucket/sceneforge/video/clip.mp4', storageUri: 'gs://test-bucket/sceneforge/video/clip.mp4', mimeType: 'video/mp4', width: 1080, height: 1920, durationSeconds: 4, provider: 'vertex-video', fingerprint: 'video' };
    const audio: GeneratedAsset = { ...common, id: 'gcs-audio', generationJobId: 'gcs-audio-job', assetType: 'audio', uri: 'gs://test-bucket/sceneforge/audio/dialogue.mp3', storageUri: 'gs://test-bucket/sceneforge/audio/dialogue.mp3', mimeType: 'audio/mpeg', width: 0, height: 0, durationSeconds: 3, provider: 'google-cloud-tts', fingerprint: 'audio', generationParameters: { mediaDurationSource: 'mp3-frame-scan' } };
    await repository.createGeneratedAsset(video);
    await repository.createGeneratedAsset(audio);

    const config: ExportConfig = { engine: 'ffmpeg-local', ffmpegPath: 'ffmpeg', mediaRoot, outputRoot: path.resolve('test-fixtures', 'output'), mediaStorageUri: 'gs://test-bucket/sceneforge' };
    const assemblies = new EpisodeAssemblyService(repository, { loadSourcePolicy: () => generatedMediaSourcePolicy(config, false) });
    let assembly = await assemblies.build(owner, series.id, episode.id);
    expect(assembly.validationPassed).toBe(true);
    assembly = await assemblies.approve(owner, series.id, episode.id, assembly.id);
    await assemblies.setPreferred(owner, series.id, episode.id, assembly.id);

    const store: PrivateMediaObjectStore = { uploadGeneratedAudio: vi.fn(), downloadAuthorized: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    const fs = fileSystem();
    const calls: string[][] = [];
    const executor: ExportProcessExecutor = { run: vi.fn(async (_executable, args) => { calls.push(args); return { exitCode: 0 }; }) };
    const engine = new FfmpegExportEngine(mediaRoot, executor, workspace(), 'ffmpeg', new GcsExportMediaMaterializer(mediaRoot, store, fs));
    const exports = new EpisodeExportService(repository, { loadConfig: () => config, registry: new ExportEngineRegistry({ 'ffmpeg-local': () => engine }) });
    let job = await exports.create(owner, series.id, episode.id, assembly.id, 'none');
    job = await exports.approve(owner, series.id, episode.id, job.id);
    job = await exports.start(owner, series.id, episode.id, job.id);
    expect(job.status).toBe('completed');
    expect(store.downloadAuthorized).toHaveBeenCalledTimes(2);
    expect(calls[0].join(' ')).not.toContain('gs://');
    expect(calls[0].join(' ')).toContain('.sceneforge-export-test');
  });
});
