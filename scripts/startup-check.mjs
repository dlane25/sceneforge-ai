import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const env = process.env; const failures = [];
const need = (key) => { if (!env[key]?.trim()) failures.push(`${key}: missing`); };
if (env.NODE_ENV !== 'production') failures.push('NODE_ENV: must be production');
for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'APP_BASE_URL', 'AUTH_URL', 'GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION', 'VERTEX_VIDEO_MODEL', 'VERTEX_OUTPUT_STORAGE_URI', 'ELEVENLABS_API_KEY', 'ELEVENLABS_MODEL_ID', 'FFMPEG_PATH', 'EXPORT_MEDIA_ROOT', 'EXPORT_OUTPUT_ROOT']) need(key);
if (env.AUTH_MODE !== 'authjs') failures.push('AUTH_MODE: must be authjs');
if (env.AUTH_TRUST_HOST !== 'true') failures.push('AUTH_TRUST_HOST: must be explicitly true behind the trusted proxy');
if (!((env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) || (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET))) failures.push('AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET or AUTH_GITHUB_ID/AUTH_GITHUB_SECRET: complete provider pair required');
if (env.IMAGE_PROVIDER !== 'gemini-image') failures.push('IMAGE_PROVIDER: must be gemini-image');
if (env.VIDEO_PROVIDER !== 'vertex-video') failures.push('VIDEO_PROVIDER: must be vertex-video');
if (env.AUDIO_PROVIDER !== 'elevenlabs-voice') failures.push('AUDIO_PROVIDER: must be elevenlabs-voice');
if (env.EXPORT_ENGINE !== 'ffmpeg-local') failures.push('EXPORT_ENGINE: must be ffmpeg-local');
try { if (new URL(env.APP_BASE_URL || '').protocol !== 'https:') failures.push('APP_BASE_URL: must be HTTPS'); } catch { failures.push('APP_BASE_URL: must be a valid HTTPS URL'); }
try { if (new URL(env.AUTH_URL || '').protocol !== 'https:') failures.push('AUTH_URL: must be HTTPS'); } catch { failures.push('AUTH_URL: must be a valid HTTPS URL'); }
for (const key of ['EXPORT_MEDIA_ROOT', 'EXPORT_OUTPUT_ROOT']) if (env[key]) { if (!path.isAbsolute(env[key])) failures.push(`${key}: must be absolute`); else if (!existsSync(env[key])) failures.push(`${key}: configured directory does not exist`); }
if (env.FFMPEG_PATH) { if (path.isAbsolute(env.FFMPEG_PATH) && !existsSync(env.FFMPEG_PATH)) failures.push('FFMPEG_PATH: configured executable does not exist'); else { const probe = spawnSync(env.FFMPEG_PATH, ['-version'], { stdio: 'ignore', shell: false, timeout: 3000 }); if (probe.status !== 0) failures.push('FFMPEG_PATH: executable health probe failed'); } }
if (failures.length) { console.error('SceneForge startup self-check failed:'); failures.forEach((value) => console.error(`- ${value}`)); process.exit(1); }
console.log('SceneForge startup self-check passed without live provider calls.');
