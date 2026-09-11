import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const FFMPEG_PROBE_TIMEOUT_MS = 12_000;

const ffmpegFailures = {
  missing: 'FFMPEG_PATH: configured executable does not exist',
  timeout: 'FFMPEG_PATH: executable health probe timed out',
  spawn: 'FFMPEG_PATH: executable health probe could not start',
  terminated: 'FFMPEG_PATH: executable health probe terminated before completing',
  exit: 'FFMPEG_PATH: executable health probe returned a non-zero exit status',
};

export function probeFfmpeg(executable, options = {}) {
  const pathExists = options.pathExists || existsSync;
  const spawn = options.spawn || spawnSync;
  const timeout = options.timeout ?? FFMPEG_PROBE_TIMEOUT_MS;

  if (path.isAbsolute(executable) && !pathExists(executable)) return ffmpegFailures.missing;

  let probe;
  try {
    probe = spawn(executable, ['-version'], { stdio: 'ignore', shell: false, timeout });
  } catch {
    return ffmpegFailures.spawn;
  }

  if (probe.error) return probe.error.code === 'ETIMEDOUT' ? ffmpegFailures.timeout : ffmpegFailures.spawn;
  if (probe.status === null) return ffmpegFailures.terminated;
  if (probe.status !== 0) return ffmpegFailures.exit;
  return null;
}

export function startupFailures(environment = process.env, options = {}) {
  const failures = [];
  const pathExists = options.pathExists || existsSync;
  const need = (key) => { if (!environment[key]?.trim()) failures.push(`${key}: missing`); };

  if (environment.NODE_ENV !== 'production') failures.push('NODE_ENV: must be production');
  for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'APP_BASE_URL', 'AUTH_URL', 'GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION', 'VERTEX_VIDEO_MODEL', 'VERTEX_OUTPUT_STORAGE_URI', 'ELEVENLABS_API_KEY', 'ELEVENLABS_MODEL_ID', 'FFMPEG_PATH', 'EXPORT_MEDIA_ROOT', 'EXPORT_OUTPUT_ROOT']) need(key);
  if (environment.AUTH_MODE !== 'authjs') failures.push('AUTH_MODE: must be authjs');
  if (environment.AUTH_TRUST_HOST !== 'true') failures.push('AUTH_TRUST_HOST: must be explicitly true behind the trusted proxy');
  if (!((environment.AUTH_GOOGLE_ID && environment.AUTH_GOOGLE_SECRET) || (environment.AUTH_GITHUB_ID && environment.AUTH_GITHUB_SECRET))) failures.push('AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET or AUTH_GITHUB_ID/AUTH_GITHUB_SECRET: complete provider pair required');
  if (environment.IMAGE_PROVIDER !== 'gemini-image') failures.push('IMAGE_PROVIDER: must be gemini-image');
  if (environment.VIDEO_PROVIDER !== 'vertex-video') failures.push('VIDEO_PROVIDER: must be vertex-video');
  if (environment.AUDIO_PROVIDER !== 'elevenlabs-voice') failures.push('AUDIO_PROVIDER: must be elevenlabs-voice');
  if (environment.EXPORT_ENGINE !== 'ffmpeg-local') failures.push('EXPORT_ENGINE: must be ffmpeg-local');
  try { if (new URL(environment.APP_BASE_URL || '').protocol !== 'https:') failures.push('APP_BASE_URL: must be HTTPS'); } catch { failures.push('APP_BASE_URL: must be a valid HTTPS URL'); }
  try { if (new URL(environment.AUTH_URL || '').protocol !== 'https:') failures.push('AUTH_URL: must be HTTPS'); } catch { failures.push('AUTH_URL: must be a valid HTTPS URL'); }
  for (const key of ['EXPORT_MEDIA_ROOT', 'EXPORT_OUTPUT_ROOT']) if (environment[key]) { if (!path.isAbsolute(environment[key])) failures.push(`${key}: must be absolute`); else if (!pathExists(environment[key])) failures.push(`${key}: configured directory does not exist`); }
  if (environment.FFMPEG_PATH) {
    const failure = probeFfmpeg(environment.FFMPEG_PATH, { pathExists, spawn: options.spawn, timeout: options.ffmpegProbeTimeoutMs });
    if (failure) failures.push(failure);
  }
  return failures;
}

export function runStartupCheck(environment = process.env, options = {}) {
  const failures = startupFailures(environment, options);
  const logger = options.logger || console;
  if (failures.length) {
    logger.error('SceneForge startup self-check failed:');
    failures.forEach((failure) => logger.error(`- ${failure}`));
    return false;
  }
  logger.log('SceneForge startup self-check passed without live provider calls.');
  return true;
}
