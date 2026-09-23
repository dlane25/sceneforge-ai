import 'server-only';

const GCS_BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
const GCS_OBJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/;

export interface GcsLocation {
  bucket: string;
  object: string;
}

export function parseGcsUri(value: string): GcsLocation {
  if (!value.startsWith('gs://') || /[\\?#\u0000-\u001F\u007F]/.test(value)) throw new Error('Generated media storage URI is invalid');
  const separator = value.indexOf('/', 5);
  if (separator < 0) throw new Error('Generated media storage URI is missing an object');
  const bucket = value.slice(5, separator);
  const object = value.slice(separator + 1);
  if (!GCS_BUCKET_PATTERN.test(bucket) || bucket.includes('..') || bucket.includes('.-') || bucket.includes('-.') || /^\d+\.\d+\.\d+\.\d+$/.test(bucket)) throw new Error('Generated media storage bucket is invalid');
  if (!GCS_OBJECT_PATTERN.test(object) || object.split('/').some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('Generated media storage object is invalid');
  return { bucket, object };
}

export function assertWithinGcsRoot(location: GcsLocation, root: GcsLocation): void {
  if (location.bucket !== root.bucket || (location.object !== root.object && !location.object.startsWith(`${root.object}/`))) throw new Error('Generated media storage location is not authorized');
}

export function canonicalGcsUri(location: GcsLocation): string {
  return `gs://${location.bucket}/${location.object}`;
}

export function safeGcsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function loadAuthorizedMediaRoot(env: Record<string, string | undefined> = process.env): GcsLocation {
  const configured = env.MEDIA_STORAGE_URI || env.VERTEX_OUTPUT_STORAGE_URI || env.GOOGLE_CLOUD_VIDEO_OUTPUT_URI;
  if (!configured) throw new Error('Generated media storage is not configured');
  return parseGcsUri(configured.replace(/\/+$/, ''));
}
