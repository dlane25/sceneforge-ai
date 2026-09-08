import 'server-only';

import type { ExportEngine } from './engine-types';
import type { ExportConfig } from './config';
import { FfmpegExportEngine, LocalExportWorkspace, SpawnProcessExecutor } from './ffmpeg-engine';
import { MockExportEngine } from './mock-engine';

export class ExportEngineRegistry {
  private readonly instances = new Map<string, ExportEngine>();
  constructor(private readonly factories: Partial<Record<'mock' | 'ffmpeg-local', (config: ExportConfig) => ExportEngine>> = {}) {}
  resolve(config: ExportConfig): ExportEngine {
    const existing = this.instances.get(config.engine); if (existing) return existing;
    const factory = this.factories[config.engine];
    const engine = factory ? factory(config) : config.engine === 'mock' ? new MockExportEngine() : new FfmpegExportEngine(config.mediaRoot!, new SpawnProcessExecutor(), new LocalExportWorkspace(config.outputRoot!), config.ffmpegPath);
    this.instances.set(config.engine, engine); return engine;
  }
}
