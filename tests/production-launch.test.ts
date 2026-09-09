import { describe, expect, it } from 'vitest';
import path from 'node:path';
import type { AuthenticatedUser } from '@/lib/auth';
import { EpisodeAssemblyService } from '@/lib/assembly';
import { EpisodeExportService } from '@/lib/export/service';
import { HealthService } from '@/lib/health';
import { assessProductionConfiguration, EpisodeLaunchPackageService, OperationsService, ProductionReadinessService } from '@/lib/launch';
import { apiError } from '@/lib/api';
import { InMemoryPersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series';
import { InMemoryRateLimiter, RateLimitError } from '@/lib/security/rate-limit';
import { validateRequestSafety } from '@/lib/security/request-safety';
import { DeclaredHttpsStorageInspector } from '@/lib/storage';
import type { CaptionTrack, GeneratedAsset, GenerationJob } from '@/types';
import { launchSecurityHeaders } from '@/next.config';

const owner: AuthenticatedUser = { id: 'launch-owner', email: 'launch@example.test', displayName: 'Launch Owner', provider: 'mock', subject: 'launch-owner' };

async function setupLaunchable() {
  const repository = new InMemoryPersistenceRepository(); const production = new ProductionService(repository);
  const series = await production.createSeries(owner, { title: 'Launch Series', logline: 'A complete launch story.', genre: 'Drama', targetAudience: 'Adults', visualStyle: 'Cinematic vertical', episodeCount: 1, episodeDurationSeconds: 60 });
  const character = await production.createCharacter(owner, series.id, { name: 'Mara', role: 'protagonist', age: 32, appearance: 'Black coat', wardrobe: 'Black coat', personality: 'Decisive', voiceProfile: { tone: 'warm', pace: 'normal' } });
  const location = await production.createLocation(owner, series.id, { name: 'Office', description: 'Executive office at night.' });
  const episode = await production.createEpisode(owner, series.id, { episodeNumber: 1, title: 'Ready', synopsis: 'Mara makes the final decision.' });
  const scene = await production.createScene(owner, series.id, episode.id, { sceneNumber: 1, title: 'Decision', description: 'The decision.', locationId: location.id });
  const shot = await production.createShot(owner, series.id, episode.id, scene.id, { shotNumber: 1, description: 'Mara speaks.', dialogue: 'We launch tonight.', durationSeconds: 4, characterIds: [character.id], locationId: location.id, visualPrompt: 'Mara in a vertical office frame.' });
  await production.createStoryboard(owner, series.id, episode.id, scene.id, shot.id);
  const now = new Date('2026-01-01T00:00:00Z'); const common = { seriesId: series.id, episodeId: episode.id, sceneId: scene.id, shotId: shot.id, provider: 'mock', reviewStatus: 'approved' as const, preferred: true, version: 1, createdAt: now, updatedAt: now };
  const video: GeneratedAsset = { ...common, id: 'launch-video', generationJobId: 'launch-video-job', assetType: 'video-clip', uri: 'mock://output/launch-video.mp4', mimeType: 'video/mp4', width: 1080, height: 1920, durationSeconds: 4, fingerprint: 'launch-video' };
  const audio: GeneratedAsset = { ...common, id: 'launch-audio', generationJobId: 'launch-audio-job', assetType: 'audio', uri: 'mock://output/launch-audio.mp3', mimeType: 'audio/mpeg', width: 0, height: 0, durationSeconds: 4, fingerprint: 'launch-audio' };
  await repository.createGeneratedAsset(video); await repository.createGeneratedAsset(audio);
  const caption: CaptionTrack = { id: 'launch-captions', seriesId: series.id, episodeId: episode.id, language: 'en', format: 'srt', source: 'dialogue-timing', content: '1\n00:00:00,000 --> 00:00:04,000\nMara: We launch tonight.\n', version: 1, reviewStatus: 'approved', preferred: true, generatedAt: now, createdAt: now, updatedAt: now, segments: [{ id: 'launch-caption-1', trackId: 'launch-captions', sequence: 1, sceneId: scene.id, shotId: shot.id, startMs: 0, endMs: 4000, text: 'We launch tonight.', speaker: 'Mara', characterId: character.id }] };
  await repository.createCaptionTrack(caption);
  const assemblies = new EpisodeAssemblyService(repository); let assembly = await assemblies.build(owner, series.id, episode.id); assembly = await assemblies.approve(owner, series.id, episode.id, assembly.id); assembly = await assemblies.setPreferred(owner, series.id, episode.id, assembly.id);
  const exports = new EpisodeExportService(repository); let exportJob = await exports.create(owner, series.id, episode.id, assembly.id, 'sidecar-srt'); exportJob = await exports.approve(owner, series.id, episode.id, exportJob.id); exportJob = await exports.start(owner, series.id, episode.id, exportJob.id); exportJob = await exports.refresh(owner, series.id, episode.id, exportJob.id); exportJob = await exports.refresh(owner, series.id, episode.id, exportJob.id);
  return { repository, production, series, character, episode, scene, shot, video, audio, caption, assembly, exports, exportJob };
}

describe('production and episode launch readiness', () => {
  it('reports structured blockers and passes a complete deterministic episode/series', async () => {
    const context = await setupLaunchable(); const readiness = new ProductionReadinessService(context.repository, { allowMockUris: true, now: () => new Date('2026-01-02T00:00:00Z') });
    const episode = await readiness.episode(owner, context.series.id, context.episode.id); const series = await readiness.series(owner, context.series.id);
    expect(episode).toMatchObject({ ready: true, blockingCount: 0, scope: 'episode' }); expect(series.ready).toBe(true); expect(episode.checks.every((check) => check.id && check.remediation && check.checkedAt instanceof Date)).toBe(true);
    await context.repository.updateGeneratedAsset({ ...context.video, reviewStatus: 'rejected' }); const blocked = await readiness.episode(owner, context.series.id, context.episode.id); expect(blocked.ready).toBe(false); expect(blocked.checks.some((check) => check.id.endsWith('assembly.rejected-assets') && check.status === 'fail')).toBe(true);
  });

  it('enforces the voice rights and consent launch gate', async () => {
    const context = await setupLaunchable(); await context.production.updateCharacter(owner, context.series.id, context.character.id, { voiceProfile: { ...context.character.voiceProfile, rights: { sourceType: 'cloned', rightsConfirmed: false, consentConfirmed: false, approvalState: 'pending' } } });
    const report = await new ProductionReadinessService(context.repository, { allowMockUris: true }).episode(owner, context.series.id, context.episode.id);
    expect(report.ready).toBe(false); expect(report.checks.find((check) => check.id.includes(`rights.${context.character.id}`))).toMatchObject({ status: 'fail', blocking: true, metadata: { character: 'Mara', sourceType: 'cloned', rightsConfirmed: false, consentConfirmed: false, reviewState: 'pending' } });
  });

  it('keeps a newer unresolved export failure blocking until remediated', async () => {
    const context = await setupLaunchable(); let failed = await context.exports.create(owner, context.series.id, context.episode.id, context.assembly.id, 'burn-in'); failed = await context.exports.approve(owner, context.series.id, context.episode.id, failed.id); await context.repository.updateEpisodeExportJob({ ...failed, status: 'failed', retryable: true, errorCode: 'processing_failed', errorMessage: 'Normalized test failure', failedAt: new Date('2026-01-02T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z') });
    const report = await new ProductionReadinessService(context.repository, { allowMockUris: true }).episode(owner, context.series.id, context.episode.id);
    expect(report.ready).toBe(false); expect(report.checks.find((check) => check.id.endsWith('export.failed-jobs'))).toMatchObject({ status: 'fail', blocking: true });
  });
});

describe('delivery manifest and launch package governance', () => {
  it('prepares, validates, approves, and prefers an immutable typed launch package', async () => {
    const context = await setupLaunchable(); const readiness = new ProductionReadinessService(context.repository, { allowMockUris: true }); const service = new EpisodeLaunchPackageService(context.repository, { readiness, allowMockUris: true });
    const prepared = await service.prepare(owner, context.series.id, context.episode.id); expect(prepared).toMatchObject({ version: 1, status: 'awaiting_approval', readinessSnapshot: { ready: true }, manifest: { manifestVersion: '1.0', exportJobId: context.exportJob.id, outputFormat: 'mp4', width: 1080, height: 1920, fileSize: expect.any(Number), checksum: expect.any(String), approvalState: 'approved' } });
    expect((await service.prepare(owner, context.series.id, context.episode.id)).id).toBe(prepared.id);
    const approved = await service.approve(owner, context.series.id, context.episode.id, prepared.id, 'Final launch handoff approved.'); expect(approved).toMatchObject({ status: 'launch_ready', approvalSummary: { launchApprovedBy: owner.id } }); expect(approved.approvalHistory).toHaveLength(1);
    const preferred = await service.setPreferred(owner, context.series.id, context.episode.id, approved.id); expect(preferred.preferred).toBe(true); expect(preferred.manifest.safeOutputUri).toMatch(/^mock:\/\/exports\//);
  });

  it('preserves rejected history and creates a new version after a new final export', async () => {
    const context = await setupLaunchable(); const readiness = new ProductionReadinessService(context.repository, { allowMockUris: true }); const service = new EpisodeLaunchPackageService(context.repository, { readiness, allowMockUris: true }); const first = await service.prepare(owner, context.series.id, context.episode.id); await service.reject(owner, context.series.id, context.episode.id, first.id, 'Replace delivery.');
    let nextExport = await context.exports.create(owner, context.series.id, context.episode.id, context.assembly.id, 'burn-in'); nextExport = await context.exports.approve(owner, context.series.id, context.episode.id, nextExport.id); nextExport = await context.exports.start(owner, context.series.id, context.episode.id, nextExport.id); nextExport = await context.exports.refresh(owner, context.series.id, context.episode.id, nextExport.id); await context.exports.refresh(owner, context.series.id, context.episode.id, nextExport.id);
    const second = await service.prepare(owner, context.series.id, context.episode.id); expect(second).toMatchObject({ version: 2, status: 'awaiting_approval', manifest: { exportVersion: 2, captionMode: 'burn-in' } }); const history = await service.list(owner, context.series.id, context.episode.id); expect(history[0]).toMatchObject({ status: 'rejected', version: 1 });
  });
});

describe('operations, configuration, health, and request hardening', () => {
  it('classifies stale and retryable jobs without mutating them', async () => {
    const context = await setupLaunchable(); const old = new Date('2026-01-01T00:00:00Z'); const failed: GenerationJob = { id: 'failed-job', seriesId: context.series.id, episodeId: context.episode.id, sceneId: context.scene.id, shotId: context.shot.id, provider: 'mock', generationType: 'video', status: 'failed', promptVersion: '1', inputHash: 'hash', promptSnapshot: 'safe snapshot', durationSeconds: 4, aspectRatio: '9:16', estimatedCost: 0, actualCost: 0, retryCount: 1, outputAssetIds: [], retryable: true, createdAt: old, updatedAt: old };
    const queued: GenerationJob = { ...failed, id: 'queued-job', status: 'queued', retryable: undefined, retryCount: 0 };
    await context.repository.createGenerationJob(failed); await context.repository.createGenerationJob(queued); const operations = await new OperationsService(context.repository, () => new Date('2026-01-03T00:00:00Z')).list(owner, context.series.id); expect(operations.jobs.find((job) => job.id === failed.id)?.classifications).toEqual(expect.arrayContaining(['failed', 'retryable'])); expect(operations.jobs.find((job) => job.id === queued.id)).toMatchObject({ stale: true, staleReason: 'queue-timeout', classifications: expect.arrayContaining(['queued', 'stale']) });
  });

  it('validates the production environment without returning secret values', async () => {
    const complete = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://secret', AUTH_MODE: 'authjs', AUTH_SECRET: 'auth-secret', AUTH_TRUST_HOST: 'true', AUTH_GOOGLE_ID: 'client', AUTH_GOOGLE_SECRET: 'oauth-secret', APP_BASE_URL: 'https://sceneforge.example', AUTH_URL: 'https://sceneforge.example', IMAGE_PROVIDER: 'gemini-image', VIDEO_PROVIDER: 'vertex-video', AUDIO_PROVIDER: 'elevenlabs-voice', GEMINI_API_KEY: 'gemini-secret', GEMINI_IMAGE_MODEL: 'image-model', GOOGLE_CLOUD_PROJECT: 'project', GOOGLE_CLOUD_LOCATION: 'us-central1', VERTEX_VIDEO_MODEL: 'video-model', VERTEX_OUTPUT_STORAGE_URI: 'gs://bucket/path', ELEVENLABS_API_KEY: 'voice-secret', ELEVENLABS_MODEL_ID: 'voice-model', EXPORT_ENGINE: 'ffmpeg-local', FFMPEG_PATH: 'ffmpeg', EXPORT_MEDIA_ROOT: path.resolve('test-fixtures', 'media'), EXPORT_OUTPUT_ROOT: path.resolve('test-fixtures', 'output') };
    const report = assessProductionConfiguration(complete, { now: new Date('2026-01-01T00:00:00Z'), pathExists: () => true }); expect(report.ready).toBe(true); expect(JSON.stringify(report)).not.toMatch(/gemini-secret|oauth-secret|postgresql:\/\/secret|voice-secret/);
    const missing = assessProductionConfiguration({ NODE_ENV: 'production' }); expect(missing.ready).toBe(false); expect(missing.checks.some((check) => check.affectedResource?.id === 'DATABASE_URL')).toBe(true);
    const health = await new HealthService(async () => true).ready(complete, report); expect(health.status).toBe('ok');
  });

  it('enforces deterministic rate, body-size, origin, and correlated API errors', async () => {
    const limiter = new InMemoryRateLimiter(); expect((await limiter.consume('export:user:series', { limit: 1, windowMs: 1000 }, new Date(0))).allowed).toBe(true); const denied = await limiter.consume('export:user:series', { limit: 1, windowMs: 1000 }, new Date(1)); expect(denied).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(validateRequestSafety({ method: 'POST', origin: 'https://evil.example', host: 'app.example' })).toMatchObject({ allowed: false, status: 403 }); expect(validateRequestSafety({ method: 'POST', host: 'app.example', contentLength: '2000000' })).toMatchObject({ allowed: false, status: 413 });
    const response = await apiError(new RateLimitError(9), 'FAILED', 'Failed', new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_safe_123' } })); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('9'); expect(await response.json()).toMatchObject({ error: { requestId: 'request_safe_123', code: 'RATE_LIMITED' } });
  });

  it('keeps delivery references declarative and security headers media-compatible', async () => {
    const reference = await new DeclaredHttpsStorageInspector(() => new Date('2026-01-01T00:00:00Z')).inspect('https://media.example/final.mp4', { id: 'final', mimeType: 'video/mp4', visibility: 'public' });
    expect(reference).toMatchObject({ exists: true, uri: 'https://media.example/final.mp4', mimeType: 'video/mp4' });
    const production = Object.fromEntries(launchSecurityHeaders('production').map((header) => [header.key, header.value])); const development = Object.fromEntries(launchSecurityHeaders('development').map((header) => [header.key, header.value]));
    const formAction = production['Content-Security-Policy']?.split('; ').find((directive) => directive.startsWith('form-action '));
    expect(formAction).toBe("form-action 'self' https://accounts.google.com");
    expect(production['Content-Security-Policy']).toContain("media-src 'self' data: blob: https:"); expect(production['Strict-Transport-Security']).toContain('max-age=31536000'); expect(development['Strict-Transport-Security']).toBeUndefined();
  });
});
