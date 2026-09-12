import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth';
import { EpisodeAssemblyService } from '@/lib/assembly';
import { assemblyActionParamsSchema, exportActionParamsSchema, exportCreateSchema } from '@/lib/assembly/api-schemas';
import { loadExportConfig } from '@/lib/export/config';
import { normalizeExportError } from '@/lib/export/errors';
import { EpisodeExportService } from '@/lib/export/service';
import type { ExportLogEvent } from '@/lib/export/logging';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import type { CaptionTrack, GeneratedAsset } from '@/types';

const owner: AuthenticatedUser = { id: 'export-owner', email: 'export@example.test', displayName: 'Export Owner', provider: 'mock', subject: 'export-owner' };
const viewer: AuthenticatedUser = { id: 'export-viewer', email: 'export-viewer@example.test', displayName: 'Export Viewer', provider: 'invited', subject: 'export-viewer@example.test' };

async function setup() {
  const repository = new InMemoryPersistenceRepository(); const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Export', logline: 'Ready.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Vertical', episodeCount: 1, episodeDurationSeconds: 60 });
  await production.addMember(owner, series.id, { email: viewer.email, role: 'VIEWER' });
  const character = await production.createCharacter(owner, series.id, { name: 'Mara', role: 'protagonist', age: 30, appearance: 'Dark coat', wardrobe: 'Black coat', personality: 'Direct', voiceProfile: { tone: 'warm', pace: 'normal' } });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'One', synopsis: 'Opening.' });
  const location = await production.createLocation(owner, series.id, { name: 'Office', description: 'Night.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Office', description: 'Night.', locationId: location.id });
  const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Mara speaks.', dialogue: 'Go now.', durationSeconds: 4, characterIds: [character.id], visualPrompt: 'Mara speaks' });
  const now = new Date('2026-01-01T00:00:00Z');
  const common = { seriesId: series.id, episodeId: episode.id, sceneId: scene.id, shotId: shot.id, provider: 'mock', reviewStatus: 'approved' as const, preferred: true, version: 1, createdAt: now, updatedAt: now };
  const video: GeneratedAsset = { ...common, id: 'export-video', generationJobId: 'export-video-job', assetType: 'video-clip', uri: 'mock://output/export-video.mp4', mimeType: 'video/mp4', width: 1080, height: 1920, durationSeconds: 4, fingerprint: 'video' };
  const audio: GeneratedAsset = { ...common, id: 'export-audio', generationJobId: 'export-audio-job', assetType: 'audio', uri: 'mock://output/export-audio.mp3', mimeType: 'audio/mpeg', width: 0, height: 0, durationSeconds: 4, fingerprint: 'audio' };
  await repository.createGeneratedAsset(video); await repository.createGeneratedAsset(audio);
  const caption: CaptionTrack = { id: 'export-captions', seriesId: series.id, episodeId: episode.id, language: 'en', format: 'srt', source: 'dialogue-timing', content: '1\n00:00:00,000 --> 00:00:04,000\nMara: Go now.\n', version: 1, reviewStatus: 'approved', preferred: true, generatedAt: now, createdAt: now, updatedAt: now, segments: [{ id: 'export-caption-1', trackId: 'export-captions', sequence: 1, sceneId: scene.id, shotId: shot.id, startMs: 0, endMs: 4000, text: 'Go now.', speaker: 'Mara' }] };
  await repository.createCaptionTrack(caption);
  const assemblyService = new EpisodeAssemblyService(repository); const assembly = await assemblyService.build(owner, series.id, episode.id); await assemblyService.approve(owner, series.id, episode.id, assembly.id); await assemblyService.setPreferred(owner, series.id, episode.id, assembly.id);
  return { repository, production, series, episode, assembly: (await assemblyService.get(owner, series.id, episode.id, assembly.id)), service: new EpisodeExportService(repository) };
}

describe('episode export lifecycle', () => {
  it('requires approval and persists deterministic mock output metadata', async () => {
    const { repository, series, episode, assembly, service } = await setup(); const job = await service.create(owner, series.id, episode.id, assembly.id, 'sidecar-srt');
    expect(job).toMatchObject({ status: 'awaiting_approval', approvalState: 'pending', engine: 'mock', preset: 'vertical-social-1080p', width: 1080, height: 1920, frameRate: 30, videoCodec: 'h264', audioCodec: 'aac', captionMode: 'sidecar-srt' });
    await expect(service.start(owner, series.id, episode.id, job.id)).rejects.toThrow('approval');
    await service.approve(owner, series.id, episode.id, job.id, 'Export approved.');
    let current = await service.start(owner, series.id, episode.id, job.id); expect(current.status).toBe('queued');
    current = await service.refresh(owner, series.id, episode.id, job.id); expect(current).toMatchObject({ status: 'processing', progress: 50 });
    current = await service.refresh(owner, series.id, episode.id, job.id); expect(current).toMatchObject({ status: 'completed', progress: 100, outputFileName: expect.stringMatching(/\.mp4$/), durationMs: 4000, checksum: expect.any(String), sidecarUri: expect.stringMatching(/\.srt$/) });
    expect(current.outputUri).toContain('mock://exports/'); expect((await repository.listEpisodeExportJobs(series.id, episode.id))).toHaveLength(1);
    expect((await service.refresh(owner, series.id, episode.id, job.id)).checksum).toBe(current.checksum);
  });

  it('supports cancellation and creates a separately approved retry version', async () => {
    const { series, episode, assembly, service } = await setup(); const job = await service.create(owner, series.id, episode.id, assembly.id, 'none');
    const cancelled = await service.cancel(owner, series.id, episode.id, job.id); expect(cancelled).toMatchObject({ status: 'cancelled', errorCode: 'cancelled' });
    const retry = await service.retry(owner, series.id, episode.id, job.id); expect(retry).toMatchObject({ exportVersion: 2, retryCount: 1, status: 'awaiting_approval', approvalState: 'pending' });
  });

  it('records export rejection and requires a new job for changed settings', async () => {
    const { series, episode, assembly, service } = await setup(); const job = await service.create(owner, series.id, episode.id, assembly.id, 'none');
    const rejected = await service.reject(owner, series.id, episode.id, job.id, 'Use burned-in captions.');
    expect(rejected).toMatchObject({ status: 'rejected', approvalState: 'rejected', approvalNotes: 'Use burned-in captions.' });
    expect(rejected.rejectedAt).toBeInstanceOf(Date); await expect(service.start(owner, series.id, episode.id, job.id)).rejects.toThrow('approval');
  });

  it('enforces ownership for export approval and execution', async () => {
    const { series, episode, assembly, service } = await setup(); const job = await service.create(viewer, series.id, episode.id, assembly.id, 'none');
    await expect(service.approve(viewer, series.id, episode.id, job.id)).rejects.toThrow('role');
    await expect(service.start(viewer, series.id, episode.id, job.id)).rejects.toThrow('role');
  });

  it('logs only safe structured identifiers and lifecycle metadata', async () => {
    const { repository, series, episode, assembly } = await setup(); const events: ExportLogEvent[] = []; const service = new EpisodeExportService(repository, { logger: { write: (event) => events.push(event) } });
    const job = await service.create(owner, series.id, episode.id, assembly.id, 'none'); await service.approve(owner, series.id, episode.id, job.id); await service.start(owner, series.id, episode.id, job.id); await service.refresh(owner, series.id, episode.id, job.id); await service.refresh(owner, series.id, episode.id, job.id);
    expect(events.map((event) => event.operation)).toEqual(['submit', 'refresh', 'refresh', 'complete']);
    const serialized = JSON.stringify(events); expect(serialized).not.toContain('Go now.'); expect(serialized).not.toMatch(/authorization|api.?key|filesystem/i);
  });
});

describe('export configuration and API validation', () => {
  it('requires explicit safe production configuration', () => {
    expect(loadExportConfig({ NODE_ENV: 'test' }).engine).toBe('mock');
    expect(() => loadExportConfig({ NODE_ENV: 'development' })).toThrow('EXPORT_ENGINE');
    expect(() => loadExportConfig({ NODE_ENV: 'production', EXPORT_ENGINE: 'mock' })).toThrow('not allowed');
    expect(loadExportConfig({ NODE_ENV: 'production', EXPORT_ENGINE: 'ffmpeg-local', EXPORT_MEDIA_ROOT: path.resolve('managed-media'), EXPORT_OUTPUT_ROOT: path.resolve('managed-output') }).engine).toBe('ffmpeg-local');
    try { loadExportConfig({ NODE_ENV: 'production', EXPORT_ENGINE: 'mock' }); } catch (error) { expect(normalizeExportError(error).code).toBe('configuration'); }
  });
  it('validates nested assembly and export actions', () => {
    expect(assemblyActionParamsSchema.safeParse({ id: 's', episodeId: 'e', assemblyId: 'a', action: 'preferred' }).success).toBe(true);
    expect(exportActionParamsSchema.safeParse({ id: 's', episodeId: 'e', jobId: 'j', action: 'execute' }).success).toBe(false);
    expect(exportCreateSchema.safeParse({ assemblyId: '', captionMode: 'burn-in' }).success).toBe(false);
    expect(exportCreateSchema.safeParse({ assemblyId: 'a', captionMode: 'sidecar-vtt' }).success).toBe(true);
  });
});
