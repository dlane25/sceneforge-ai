import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FFMPEG_PROBE_TIMEOUT_MS, probeFfmpeg, runStartupCheck } from '@/scripts/startup-check-lib.mjs';

const ffmpegPath = path.resolve('test-fixtures', 'bin', 'ffmpeg');

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://private-database',
    AUTH_MODE: 'authjs',
    AUTH_SECRET: 'private-auth-secret',
    AUTH_TRUST_HOST: 'true',
    AUTH_GOOGLE_ID: 'google-client',
    AUTH_GOOGLE_SECRET: 'private-google-secret',
    APP_BASE_URL: 'https://sceneforge.example',
    AUTH_URL: 'https://sceneforge.example',
    IMAGE_PROVIDER: 'gemini-image',
    VIDEO_PROVIDER: 'vertex-video',
    AUDIO_PROVIDER: 'elevenlabs-voice',
    GEMINI_API_KEY: 'private-gemini-key',
    GEMINI_IMAGE_MODEL: 'image-model',
    GOOGLE_CLOUD_PROJECT: 'project',
    GOOGLE_CLOUD_LOCATION: 'us-central1',
    VERTEX_VIDEO_MODEL: 'video-model',
    VERTEX_OUTPUT_STORAGE_URI: 'gs://private-bucket/path',
    ELEVENLABS_API_KEY: 'private-elevenlabs-key',
    ELEVENLABS_MODEL_ID: 'voice-model',
    EXPORT_ENGINE: 'ffmpeg-local',
    FFMPEG_PATH: ffmpegPath,
    EXPORT_MEDIA_ROOT: path.resolve('test-fixtures', 'media'),
    EXPORT_OUTPUT_ROOT: path.resolve('test-fixtures', 'output'),
  };
}

describe('production startup FFmpeg probe', () => {
  it('accepts a successful executable probe with a Cloud Run-safe timeout', () => {
    const spawn = vi.fn(() => ({ status: 0 }));

    expect(probeFfmpeg(ffmpegPath, { pathExists: () => true, spawn })).toBeNull();
    expect(FFMPEG_PROBE_TIMEOUT_MS).toBe(12_000);
    expect(spawn).toHaveBeenCalledWith(ffmpegPath, ['-version'], {
      stdio: 'ignore',
      shell: false,
      timeout: 12_000,
    });
  });

  it.each([
    [{ status: null, error: { code: 'ETIMEDOUT', message: 'sensitive timeout details' } }, 'FFMPEG_PATH: executable health probe timed out'],
    [{ status: null, error: { code: 'ENOENT', message: 'sensitive spawn details' } }, 'FFMPEG_PATH: executable health probe could not start'],
    [{ status: 1 }, 'FFMPEG_PATH: executable health probe returned a non-zero exit status'],
    [{ status: null, signal: 'SIGTERM' }, 'FFMPEG_PATH: executable health probe terminated before completing'],
  ])('reports a sanitized probe failure for %j', (result, expected) => {
    expect(probeFfmpeg(ffmpegPath, { pathExists: () => true, spawn: () => result })).toBe(expected);
  });

  it('rejects a missing absolute executable without attempting to spawn it', () => {
    const spawn = vi.fn();

    expect(probeFfmpeg(ffmpegPath, { pathExists: () => false, spawn })).toBe('FFMPEG_PATH: configured executable does not exist');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('logs only stable sanitized diagnostics when the probe cannot start', () => {
    const output: string[] = [];
    const environment = productionEnvironment();
    const logger = { log: (message: string) => output.push(message), error: (message: string) => output.push(message) };
    const spawn = () => ({ status: null, error: { code: 'ENOENT', message: `failed at ${ffmpegPath} using ${environment.DATABASE_URL}` } });

    expect(runStartupCheck(environment, { pathExists: () => true, spawn, logger })).toBe(false);
    expect(output).toEqual([
      'SceneForge startup self-check failed:',
      '- FFMPEG_PATH: executable health probe could not start',
    ]);
    expect(output.join('\n')).not.toContain(ffmpegPath);
    expect(output.join('\n')).not.toContain(environment.DATABASE_URL);
    expect(output.join('\n')).not.toContain(environment.AUTH_SECRET);
  });
});
