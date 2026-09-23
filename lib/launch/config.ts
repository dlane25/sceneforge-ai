import 'server-only';

import path from 'node:path';
import { existsSync } from 'node:fs';
import type { ProductionReadinessReport, ReadinessCheck, ReadinessCategory } from '@/types';
import { assertWithinGcsRoot, parseGcsUri } from '@/lib/storage/gcs';

type Environment = Record<string, string | undefined>;
export interface ConfigurationAssessmentOptions { now?: Date; pathExists?: (value: string) => boolean }
function filesystemEntryExists(value: string): boolean { return existsSync(/* turbopackIgnore: true */ value); }

export class ProductionConfigurationError extends Error {
  readonly code = 'CONFIGURATION_INVALID';
  constructor(readonly missingKeys: string[]) { super('Production configuration is incomplete'); this.name = 'ProductionConfigurationError'; }
}

function report(checks: ReadinessCheck[], now: Date): ProductionReadinessReport {
  const blockingCount = checks.filter((check) => check.blocking && check.status === 'fail').length;
  return { id: `readiness_application_${now.toISOString()}`, scope: 'application', checks, blockingCount, warningCount: checks.filter((check) => check.status === 'warning').length, passedCount: checks.filter((check) => check.status === 'pass').length, ready: blockingCount === 0, checkedAt: now };
}

export function assessProductionConfiguration(env: Environment = process.env, options: ConfigurationAssessmentOptions = {}): ProductionReadinessReport {
  const pathExists = options.pathExists || filesystemEntryExists;
  const now = options.now || new Date(); const checks: ReadinessCheck[] = [];
  const add = (id: string, category: ReadinessCategory, ok: boolean, explanation: string, remediation: string, affectedKey?: string, warning = false) => checks.push({ id, category, severity: ok ? 'info' : warning ? 'warning' : 'error', status: ok ? 'pass' : warning ? 'warning' : 'fail', explanation, remediation, affectedResource: affectedKey ? { type: 'configuration-key', id: affectedKey } : undefined, checkedAt: now, blocking: !ok && !warning });
  const present = (key: string) => Boolean(env[key]?.trim());
  const requireKey = (key: string, category: ReadinessCategory, reason: string) => add(`config.${key.toLowerCase()}`, category, present(key), present(key) ? `${key} is configured.` : `${key} is missing.`, reason, key);

  add('config.environment.production', 'application', env.NODE_ENV === 'production', env.NODE_ENV === 'production' ? 'Runtime is explicitly in production mode.' : 'Runtime is not in production mode.', 'Set NODE_ENV=production for a launch runtime.', 'NODE_ENV');
  requireKey('DATABASE_URL', 'storage', 'Configure the production PostgreSQL connection outside source control.');
  add('config.auth.mode', 'security-governance', env.AUTH_MODE === 'authjs', env.AUTH_MODE === 'authjs' ? 'Auth.js production mode is selected.' : 'Production Auth.js mode is not selected.', 'Set AUTH_MODE=authjs.', 'AUTH_MODE');
  requireKey('AUTH_SECRET', 'security-governance', 'Set a high-entropy Auth.js secret in the deployment secret store.');
  add('config.auth.trust-host', 'security-governance', env.AUTH_TRUST_HOST === 'true', env.AUTH_TRUST_HOST === 'true' ? 'Trusted-host handling is explicitly enabled.' : 'Trusted-host handling is not explicitly enabled.', 'Set AUTH_TRUST_HOST=true only behind a trusted production proxy.', 'AUTH_TRUST_HOST');
  add('config.google.adc', 'security-governance', !present('GOOGLE_APPLICATION_CREDENTIALS'), !present('GOOGLE_APPLICATION_CREDENTIALS') ? 'Google runtime authentication uses Application Default Credentials.' : 'A service-account key file override is configured.', 'Remove GOOGLE_APPLICATION_CREDENTIALS and use the runtime service account through Application Default Credentials.', 'GOOGLE_APPLICATION_CREDENTIALS');
  const oauth = (present('AUTH_GOOGLE_ID') && present('AUTH_GOOGLE_SECRET')) || (present('AUTH_GITHUB_ID') && present('AUTH_GITHUB_SECRET'));
  add('config.auth.provider', 'security-governance', oauth, oauth ? 'At least one complete OAuth provider pair is configured.' : 'No complete OAuth provider credential pair is configured.', 'Configure Google or GitHub OAuth client ID and secret.', 'AUTH_GOOGLE_ID|AUTH_GOOGLE_SECRET|AUTH_GITHUB_ID|AUTH_GITHUB_SECRET');
  let baseUrlValid = false; try { const url = new URL(env.APP_BASE_URL || ''); baseUrlValid = url.protocol === 'https:' && !url.username && !url.password; } catch { baseUrlValid = false; }
  add('config.app-base-url', 'application', baseUrlValid, baseUrlValid ? 'The public application base URL is valid HTTPS.' : 'The public application base URL is missing or not HTTPS.', 'Set APP_BASE_URL to the canonical HTTPS origin.', 'APP_BASE_URL');
  let authUrlValid = false; try { const url = new URL(env.AUTH_URL || ''); authUrlValid = url.protocol === 'https:' && !url.username && !url.password; } catch { authUrlValid = false; }
  add('config.auth-url', 'security-governance', authUrlValid, authUrlValid ? 'The Auth.js canonical URL is valid HTTPS.' : 'The Auth.js canonical URL is missing or not HTTPS.', 'Set AUTH_URL to the canonical HTTPS application origin.', 'AUTH_URL');

  const image = env.IMAGE_PROVIDER; const video = env.VIDEO_PROVIDER; const audio = env.AUDIO_PROVIDER;
  add('config.provider.image', 'provider-config', image === 'gemini-image', image === 'gemini-image' ? 'Gemini image is selected.' : 'A production image provider is not selected.', 'Set IMAGE_PROVIDER=gemini-image; mock is never allowed for launch.', 'IMAGE_PROVIDER');
  add('config.provider.video', 'provider-config', video === 'vertex-video', video === 'vertex-video' ? 'Vertex video is selected.' : 'A production video provider is not selected.', 'Set VIDEO_PROVIDER=vertex-video; mock is never allowed for launch.', 'VIDEO_PROVIDER');
  const supportedAudio = audio === 'google-cloud-tts' || audio === 'elevenlabs-voice';
  add('config.provider.audio', 'provider-config', supportedAudio, supportedAudio ? `${audio === 'google-cloud-tts' ? 'Google Cloud TTS' : 'ElevenLabs voice'} is selected.` : 'A production audio provider is not selected.', 'Set AUDIO_PROVIDER=google-cloud-tts or elevenlabs-voice; mock is never allowed for launch.', 'AUDIO_PROVIDER');
  if (image === 'gemini-image') { requireKey('GEMINI_API_KEY', 'provider-config', 'Add the Gemini API key to the server secret store.'); requireKey('GEMINI_IMAGE_MODEL', 'provider-config', 'Configure the approved Gemini image model.'); }
  if (video === 'vertex-video') { requireKey('GOOGLE_CLOUD_PROJECT', 'provider-config', 'Configure the Google Cloud project.'); requireKey('GOOGLE_CLOUD_LOCATION', 'provider-config', 'Configure the Vertex location.'); requireKey('VERTEX_VIDEO_MODEL', 'provider-config', 'Configure the approved Vertex video model.'); requireKey('VERTEX_OUTPUT_STORAGE_URI', 'storage', 'Configure the managed Vertex output bucket URI.'); }
  if (audio === 'elevenlabs-voice') { requireKey('ELEVENLABS_API_KEY', 'provider-config', 'Add the ElevenLabs key to the server secret store.'); requireKey('ELEVENLABS_MODEL_ID', 'provider-config', 'Configure the approved ElevenLabs model.'); }
  if (audio === 'google-cloud-tts') {
    requireKey('GOOGLE_CLOUD_PROJECT', 'provider-config', 'Configure the Google Cloud project used by the runtime service account.');
    requireKey('MEDIA_STORAGE_URI', 'storage', 'Configure the authorized private Cloud Storage media root.');
    add('config.google-tts.model', 'provider-config', env.GOOGLE_TTS_MODEL === 'chirp-3-hd', env.GOOGLE_TTS_MODEL === 'chirp-3-hd' ? 'The approved Chirp 3 HD model is configured.' : 'The Google TTS model is missing or unsupported.', 'Set GOOGLE_TTS_MODEL=chirp-3-hd.', 'GOOGLE_TTS_MODEL');
    add('config.google-tts.output', 'provider-config', env.GOOGLE_TTS_OUTPUT_FORMAT === 'MP3', env.GOOGLE_TTS_OUTPUT_FORMAT === 'MP3' ? 'Google TTS output is restricted to MP3.' : 'Google TTS output is missing or not MP3.', 'Set GOOGLE_TTS_OUTPUT_FORMAT=MP3.', 'GOOGLE_TTS_OUTPUT_FORMAT');
    const price = Number(env.GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS);
    add('config.google-tts.price', 'provider-config', present('GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS') && Number.isFinite(price) && price >= 0, 'Google TTS configured-rate cost accounting was evaluated.', 'Set GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS to the approved non-negative rate.', 'GOOGLE_TTS_PRICE_PER_MILLION_CHARACTERS');
    requireKey('GOOGLE_TTS_PRICING_VERSION', 'provider-config', 'Set a version label for the approved Google TTS pricing configuration.');
  }
  if (present('MEDIA_STORAGE_URI')) {
    let validRoot = false;
    try { parseGcsUri(env.MEDIA_STORAGE_URI!.replace(/\/+$/, '')); validRoot = true; } catch { validRoot = false; }
    add('config.media-storage-root', 'storage', validRoot, validRoot ? 'The authorized media storage root is a valid GCS prefix.' : 'The authorized media storage root is invalid.', 'Set MEDIA_STORAGE_URI to a private gs:// bucket/prefix.', 'MEDIA_STORAGE_URI');
    if (validRoot && present('VERTEX_OUTPUT_STORAGE_URI')) {
      let contained = false;
      try { assertWithinGcsRoot(parseGcsUri(env.VERTEX_OUTPUT_STORAGE_URI!.replace(/\/+$/, '')), parseGcsUri(env.MEDIA_STORAGE_URI!.replace(/\/+$/, ''))); contained = true; } catch { contained = false; }
      add('config.vertex-output.authorized-root', 'storage', contained, contained ? 'Vertex output is contained by the authorized media root.' : 'Vertex output is outside the authorized media root.', 'Place VERTEX_OUTPUT_STORAGE_URI beneath MEDIA_STORAGE_URI.', 'VERTEX_OUTPUT_STORAGE_URI|MEDIA_STORAGE_URI');
    }
  }

  add('config.export.engine', 'export', env.EXPORT_ENGINE === 'ffmpeg-local', env.EXPORT_ENGINE === 'ffmpeg-local' ? 'Local FFmpeg export is selected.' : 'A production export engine is not selected.', 'Set EXPORT_ENGINE=ffmpeg-local; mock is never allowed for launch.', 'EXPORT_ENGINE');
  if (env.EXPORT_ENGINE === 'ffmpeg-local') {
    requireKey('FFMPEG_PATH', 'export', 'Set the FFmpeg executable name or absolute managed executable path.');
    for (const key of ['EXPORT_MEDIA_ROOT', 'EXPORT_OUTPUT_ROOT'] as const) {
      const value = env[key] || ''; const absolute = Boolean(value && path.isAbsolute(value));
      add(`config.${key.toLowerCase()}.absolute`, key === 'EXPORT_MEDIA_ROOT' ? 'storage' : 'export', absolute, absolute ? `${key} is an absolute managed path.` : `${key} must be an absolute path.`, `Set ${key} to an absolute server-managed directory.`, key);
      if (absolute) add(`config.${key.toLowerCase()}.exists`, key === 'EXPORT_MEDIA_ROOT' ? 'storage' : 'export', pathExists(value), pathExists(value) ? `${key} exists.` : `${key} does not exist.`, `Provision ${key} and grant the runtime least-privilege access.`, key);
    }
    const executable = env.FFMPEG_PATH || '';
    if (path.isAbsolute(executable)) add('config.ffmpeg.executable', 'export', pathExists(executable), pathExists(executable) ? 'The configured FFmpeg executable exists.' : 'The configured FFmpeg executable does not exist.', 'Install FFmpeg or correct FFMPEG_PATH.', 'FFMPEG_PATH');
  }
  return report(checks, now);
}

export function assertProductionConfiguration(env: Environment = process.env, options: ConfigurationAssessmentOptions = {}): ProductionReadinessReport {
  const value = assessProductionConfiguration(env, options);
  if (!value.ready) throw new ProductionConfigurationError(value.checks.filter((check) => check.blocking && check.status === 'fail' && check.affectedResource?.type === 'configuration-key').map((check) => check.affectedResource!.id));
  return value;
}
