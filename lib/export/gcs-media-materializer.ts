import 'server-only';

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PrivateMediaObjectStore } from '@/lib/storage/google-cloud-media-storage';
import { parseGcsUri } from '@/lib/storage/gcs';
import type { ExportRenderRequest } from './engine-types';
import { exportError } from './errors';

export interface MaterializedExportRequest {
  request: ExportRenderRequest;
  cleanup(): Promise<void>;
}

export interface ExportMediaMaterializer {
  materialize(request: ExportRenderRequest): Promise<MaterializedExportRequest>;
}

export interface MaterializerFileSystem {
  mkdir(directory: string): Promise<void>;
  mkdtemp(prefix: string): Promise<string>;
  writeFile(file: string, bytes: Uint8Array): Promise<void>;
  remove(directory: string): Promise<void>;
}

const nodeFileSystem: MaterializerFileSystem = {
  async mkdir(directory) { await mkdir(directory, { recursive: true }); },
  mkdtemp,
  async writeFile(file, bytes) { await writeFile(file, bytes, { flag: 'wx' }); },
  async remove(directory) { await rm(directory, { recursive: true, force: true }); },
};

function extensionFor(uri: string): 'mp3' | 'mp4' {
  const object = parseGcsUri(uri).object.toLowerCase();
  if (object.endsWith('.mp3')) return 'mp3';
  if (object.endsWith('.mp4')) return 'mp4';
  throw exportError('unsafe_source', 'Cloud media object type is not permitted for export');
}

export class GcsExportMediaMaterializer implements ExportMediaMaterializer {
  constructor(
    private readonly mediaRoot: string,
    private readonly objectStore: PrivateMediaObjectStore,
    private readonly fileSystem: MaterializerFileSystem = nodeFileSystem,
  ) {
    if (!path.isAbsolute(mediaRoot)) throw exportError('configuration', 'Export media root must be an absolute managed path');
  }

  async materialize(request: ExportRenderRequest): Promise<MaterializedExportRequest> {
    const sources = request.clips.flatMap((clip) => [clip.videoUri, clip.audioUri].filter((value): value is string => Boolean(value)));
    if (!sources.some((uri) => uri.startsWith('gs://'))) return { request, cleanup: async () => undefined };
    await this.fileSystem.mkdir(this.mediaRoot);
    const directory = await this.fileSystem.mkdtemp(path.join(this.mediaRoot, '.sceneforge-export-'));
    const relativeDirectory = path.relative(path.resolve(this.mediaRoot), path.resolve(directory));
    if (!relativeDirectory || relativeDirectory.startsWith('..') || path.isAbsolute(relativeDirectory)) {
      await this.fileSystem.remove(directory);
      throw exportError('unsafe_source', 'Materialized export directory escaped the configured media root');
    }
    const cached = new Map<string, string>();
    try {
      const materializeUri = async (uri: string): Promise<string> => {
        if (!uri.startsWith('gs://')) return uri;
        const existing = cached.get(uri);
        if (existing) return existing;
        const extension = extensionFor(uri);
        const bytes = await this.objectStore.downloadAuthorized(uri);
        if (!bytes.byteLength) throw exportError('source_missing', 'Cloud media object is empty');
        const name = `${cached.size + 1}-${createHash('sha256').update(uri).digest('hex').slice(0, 24)}.${extension}`;
        const file = path.join(directory, name);
        await this.fileSystem.writeFile(file, bytes);
        const relative = path.relative(path.resolve(this.mediaRoot), path.resolve(file)).split(path.sep).join('/');
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw exportError('unsafe_source', 'Materialized media path escaped the configured root');
        const managed = `managed://media/${relative.split('/').map(encodeURIComponent).join('/')}`;
        cached.set(uri, managed);
        return managed;
      };
      const clips = [];
      for (const clip of request.clips) clips.push({ ...clip, videoUri: await materializeUri(clip.videoUri), audioUri: clip.audioUri ? await materializeUri(clip.audioUri) : undefined });
      return { request: { ...request, clips }, cleanup: () => this.fileSystem.remove(directory) };
    } catch (error) {
      await this.fileSystem.remove(directory);
      throw error;
    }
  }
}
