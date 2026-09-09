import 'server-only';

import { runtimeRepository } from '@/lib/repositories';
import { EpisodeAssemblyService } from './service';
import { EpisodeExportService } from '@/lib/export/service';

export const episodeAssemblyService = new EpisodeAssemblyService(runtimeRepository);
export const episodeExportService = new EpisodeExportService(runtimeRepository);
