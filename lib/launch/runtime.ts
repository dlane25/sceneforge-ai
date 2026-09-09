import 'server-only';

import { runtimeRepository } from '@/lib/repositories';
import { EpisodeLaunchPackageService } from './package-service';
import { loadStaleThresholds, OperationsService } from './operations-service';
import { ProductionReadinessService } from './readiness-service';

export const productionReadinessService = new ProductionReadinessService(runtimeRepository);
export const episodeLaunchPackageService = new EpisodeLaunchPackageService(runtimeRepository, { readiness: productionReadinessService });
export const operationsService = new OperationsService(runtimeRepository, () => new Date(), loadStaleThresholds());
