import 'server-only';

import path from 'node:path';
import type { ExportEngineId } from './engine-types';
import { exportError } from './errors';

export interface ExportConfig { engine: ExportEngineId; ffmpegPath: string; mediaRoot?: string; outputRoot?: string }
type Environment = Record<string, string | undefined>;

export function loadExportConfig(env: Environment = process.env): ExportConfig {
  const selected = env.EXPORT_ENGINE || (env.NODE_ENV === 'test' ? 'mock' : undefined);
  if (selected !== 'mock' && selected !== 'ffmpeg-local') throw exportError('configuration', 'EXPORT_ENGINE must be mock or ffmpeg-local');
  if (env.NODE_ENV === 'production' && selected === 'mock') throw exportError('configuration', 'Mock export engine is not allowed in production');
  const config: ExportConfig = { engine: selected, ffmpegPath: env.FFMPEG_PATH || 'ffmpeg', mediaRoot: env.EXPORT_MEDIA_ROOT, outputRoot: env.EXPORT_OUTPUT_ROOT };
  if (selected === 'ffmpeg-local') {
    if (!config.mediaRoot || !path.isAbsolute(config.mediaRoot)) throw exportError('configuration', 'EXPORT_MEDIA_ROOT must be an absolute managed path for ffmpeg-local');
    if (!config.outputRoot || !path.isAbsolute(config.outputRoot)) throw exportError('configuration', 'EXPORT_OUTPUT_ROOT must be an absolute managed path for ffmpeg-local');
    if (!config.ffmpegPath.trim()) throw exportError('configuration', 'FFMPEG_PATH is required for ffmpeg-local');
  }
  return config;
}
