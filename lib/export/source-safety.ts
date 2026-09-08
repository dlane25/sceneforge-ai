import 'server-only';

import path from 'node:path';
import { isIP } from 'node:net';
import { exportError } from './errors';

export type MediaSourceKind = 'managed' | 'https' | 'mock';

export function validateMediaSource(uri: string, allowMock: boolean): MediaSourceKind {
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw exportError('unsafe_source', 'Media source must use an approved URI scheme'); }
  if (parsed.username || parsed.password) throw exportError('unsafe_source', 'Credential-bearing media sources are not permitted');
  if (parsed.protocol === 'https:') {
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ''); const ip = isIP(host);
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (ip === 4 && /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) || (ip === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')))) throw exportError('unsafe_source', 'Private or local HTTPS media sources are not permitted');
    return 'https';
  }
  if (parsed.protocol === 'mock:' && allowMock && parsed.hostname === 'output') return 'mock';
  if (parsed.protocol === 'managed:' && parsed.hostname === 'media') {
    if (parsed.search || parsed.hash) throw exportError('unsafe_source', 'Managed media sources cannot contain query strings or fragments');
    let decoded: string;
    try { decoded = decodeURIComponent(parsed.pathname); } catch { throw exportError('unsafe_source', 'Managed media source path is invalid'); }
    if (!decoded || decoded.includes('\0') || decoded.split('/').includes('..')) throw exportError('unsafe_source', 'Managed media source path is invalid');
    return 'managed';
  }
  throw exportError('unsafe_source', 'Media source scheme is not permitted');
}

export function resolveManagedMediaSource(uri: string, mediaRoot: string): string {
  if (validateMediaSource(uri, false) === 'https') return uri;
  const parsed = new URL(uri);
  const root = path.resolve(mediaRoot);
  let decoded: string;
  try { decoded = decodeURIComponent(parsed.pathname); } catch { throw exportError('unsafe_source', 'Managed media source path is invalid'); }
  const resolved = path.resolve(root, decoded.replace(/^[/\\]+/, ''));
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw exportError('unsafe_source', 'Managed media source escapes the configured root');
  return resolved;
}

export function safeArtifactName(id: string, extension: string): string {
  if (!/^[A-Za-z0-9_-]{1,300}$/.test(id) || !/^[a-z0-9]{2,5}$/.test(extension)) throw exportError('invalid_request', 'Export artifact identifier is invalid');
  return `${id}.${extension}`;
}
