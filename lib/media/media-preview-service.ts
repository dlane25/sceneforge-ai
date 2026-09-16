import 'server-only';

import { createHash } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import type { AuthenticatedUser } from '@/lib/auth';
import type { PersistenceRepository } from '@/lib/repositories';
import { ProductionService } from '@/lib/series/service';

export const DEFAULT_MEDIA_PREVIEW_TTL_SECONDS = 300;
const MIN_MEDIA_PREVIEW_TTL_SECONDS = 60;
const MAX_MEDIA_PREVIEW_TTL_SECONDS = 900;
const GCS_BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
const GCS_OBJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/;

export interface GcsLocation {
  bucket: string;
  object: string;
}

export interface MediaPreviewConfig {
  root: GcsLocation;
  expiresInSeconds: number;
}

export interface SignedMediaPreview {
  url: string;
  expiresAt: Date;
}

export interface MediaObjectSigner {
  objectExists(location: GcsLocation): Promise<boolean>;
  createSignedGetUrl(location: GcsLocation, options: { expiresInSeconds: number; now: Date }): Promise<string>;
}

export interface GoogleSigningDependencies {
  getServiceAccountEmail(): Promise<string | undefined>;
  objectExists(location: GcsLocation): Promise<boolean>;
  sign(value: string): Promise<string>;
}

function safeEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodedObjectPath(location: GcsLocation): string {
  return `/${safeEncode(location.bucket)}/${location.object.split('/').map(safeEncode).join('/')}`;
}

function signingTimestamp(now: Date): string {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function defaultGoogleSigningDependencies(): GoogleSigningDependencies {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  return {
    async getServiceAccountEmail() {
      return (await auth.getCredentials()).client_email;
    },
    async objectExists(location) {
      const response = await auth.request({
        url: `https://storage.googleapis.com/storage/v1/b/${safeEncode(location.bucket)}/o/${safeEncode(location.object)}`,
        method: 'GET',
        params: { fields: 'name' },
        validateStatus: () => true,
      });
      if (response.status === 404) return false;
      if (response.status !== 200) throw new Error('Generated media availability could not be verified');
      return true;
    },
    sign(value) {
      return auth.sign(value);
    },
  };
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

export function loadMediaPreviewConfig(env: Record<string, string | undefined> = process.env): MediaPreviewConfig {
  const configuredRoot = env.VERTEX_OUTPUT_STORAGE_URI || env.GOOGLE_CLOUD_VIDEO_OUTPUT_URI;
  if (!configuredRoot) throw new Error('Generated media preview storage is not configured');
  const root = parseGcsUri(configuredRoot.replace(/\/+$/, ''));
  const rawTtl = env.MEDIA_PREVIEW_URL_TTL_SECONDS;
  const expiresInSeconds = rawTtl ? Number(rawTtl) : DEFAULT_MEDIA_PREVIEW_TTL_SECONDS;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < MIN_MEDIA_PREVIEW_TTL_SECONDS || expiresInSeconds > MAX_MEDIA_PREVIEW_TTL_SECONDS) throw new Error('Generated media preview expiration is invalid');
  return { root, expiresInSeconds };
}

export function assertWithinConfiguredRoot(location: GcsLocation, root: GcsLocation): void {
  if (location.bucket !== root.bucket || !location.object.startsWith(`${root.object}/`)) throw new Error('Generated media storage location is not authorized');
}

export class GoogleCloudMediaSigner implements MediaObjectSigner {
  private readonly dependencies: GoogleSigningDependencies;

  constructor(dependencies?: GoogleSigningDependencies) {
    this.dependencies = dependencies || defaultGoogleSigningDependencies();
  }

  objectExists(location: GcsLocation): Promise<boolean> {
    return this.dependencies.objectExists(location);
  }

  async createSignedGetUrl(location: GcsLocation, options: { expiresInSeconds: number; now: Date }): Promise<string> {
    const serviceAccountEmail = await this.dependencies.getServiceAccountEmail();
    if (!serviceAccountEmail) throw new Error('Generated media signing identity is unavailable');
    const timestamp = signingTimestamp(options.now);
    const date = timestamp.slice(0, 8);
    const credentialScope = `${date}/auto/storage/goog4_request`;
    const query = [
      ['X-Goog-Algorithm', 'GOOG4-RSA-SHA256'],
      ['X-Goog-Credential', `${serviceAccountEmail}/${credentialScope}`],
      ['X-Goog-Date', timestamp],
      ['X-Goog-Expires', String(options.expiresInSeconds)],
      ['X-Goog-SignedHeaders', 'host'],
    ].map(([key, value]) => `${safeEncode(key)}=${safeEncode(value)}`).sort().join('&');
    const canonicalRequest = ['GET', encodedObjectPath(location), query, 'host:storage.googleapis.com\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const stringToSign = ['GOOG4-RSA-SHA256', timestamp, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signature = Buffer.from(await this.dependencies.sign(stringToSign), 'base64').toString('hex');
    return `https://storage.googleapis.com${encodedObjectPath(location)}?${query}&X-Goog-Signature=${signature}`;
  }
}

interface MediaPreviewServiceOptions {
  signer?: MediaObjectSigner;
  loadConfig?: () => MediaPreviewConfig;
  now?: () => Date;
}

export class MediaPreviewService {
  private readonly production: ProductionService;
  private readonly signer: MediaObjectSigner;
  private readonly configLoader: () => MediaPreviewConfig;
  private readonly now: () => Date;

  constructor(private readonly repository: PersistenceRepository, options: MediaPreviewServiceOptions = {}) {
    this.production = new ProductionService(repository);
    this.signer = options.signer || new GoogleCloudMediaSigner();
    this.configLoader = options.loadConfig || (() => loadMediaPreviewConfig());
    this.now = options.now || (() => new Date());
  }

  async createPreview(user: AuthenticatedUser, ids: [string, string, string, string], assetId: string): Promise<SignedMediaPreview> {
    await this.production.getShotReadiness(user, ids[0], ids[1], ids[2], ids[3]);
    const asset = await this.repository.getGeneratedAsset(ids[0], ids[1], ids[2], ids[3], assetId);
    if (!asset) throw new Error('Generated media was not found');
    const location = parseGcsUri(asset.storageUri || asset.uri);
    const config = this.configLoader();
    assertWithinConfiguredRoot(location, config.root);
    let exists: boolean;
    try { exists = await this.signer.objectExists(location); }
    catch { throw new Error('Generated media availability could not be verified'); }
    if (!exists) throw new Error('Generated media was not found');
    const now = this.now();
    try {
      const url = await this.signer.createSignedGetUrl(location, { expiresInSeconds: config.expiresInSeconds, now });
      return { url, expiresAt: new Date(now.getTime() + config.expiresInSeconds * 1000) };
    } catch {
      throw new Error('Generated media access could not be created');
    }
  }
}
