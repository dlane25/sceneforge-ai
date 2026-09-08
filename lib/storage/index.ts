import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { StorageReference } from '@/types';
import { isSafeDeliveryUri } from '@/lib/launch/uri-safety';

export interface StorageInspector { inspect(uri: string, metadata: { id: string; mimeType: string; visibility: 'private' | 'public' }): Promise<StorageReference> }

export class LocalManagedStorageInspector implements StorageInspector {
  constructor(private readonly root: string, private readonly now: () => Date = () => new Date()) { if (!path.isAbsolute(root)) throw new Error('Managed storage root must be absolute'); }
  async inspect(uri: string, metadata: { id: string; mimeType: string; visibility: 'private' | 'public' }): Promise<StorageReference> {
    let parsed: URL; try { parsed = new URL(uri); } catch { throw new Error('Storage URI is invalid'); } if (parsed.protocol !== 'managed:' || parsed.hostname !== 'exports') throw new Error('Storage URI is not a managed export reference');
    const target = path.resolve(this.root, decodeURIComponent(parsed.pathname).replace(/^[/\\]+/, '')); const relative = path.relative(this.root, target); if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Storage URI escapes the managed root');
    try { const [details, bytes] = await Promise.all([stat(target), readFile(target)]); return { ...metadata, uri, size: details.size, checksum: createHash('sha256').update(bytes).digest('hex'), exists: true, checkedAt: this.now() }; } catch { return { ...metadata, uri, exists: false, checkedAt: this.now() }; }
  }
}

export class DeclaredHttpsStorageInspector implements StorageInspector {
  constructor(private readonly now: () => Date = () => new Date()) {}
  async inspect(uri: string, metadata: { id: string; mimeType: string; visibility: 'private' | 'public' }): Promise<StorageReference> { if (!isSafeDeliveryUri(uri, false) || !uri.startsWith('https://')) throw new Error('Public storage reference must use approved HTTPS'); return { ...metadata, uri, exists: true, checkedAt: this.now() }; }
}
