import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GcsExportMediaMaterializer, type MaterializerFileSystem } from '@/lib/export/gcs-media-materializer';
import { FfmpegExportEngine, type ExportProcessExecutor, type ExportWorkspace } from '@/lib/export/ffmpeg-engine';
import { getExportPreset } from '@/lib/export/presets';
import type { ExportRenderRequest } from '@/lib/export/engine-types';
import { GoogleCloudPrivateMediaStore, type BinaryHttpClient, type PrivateMediaObjectStore } from '@/lib/storage/google-cloud-media-storage';
import type { AccessTokenProvider } from '@/lib/media/providers/google-transport';

const mediaRoot = path.resolve('test-fixtures', 'managed-media');
const temporaryDirectory = path.join(mediaRoot, '.sceneforge-export-test');

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
});
