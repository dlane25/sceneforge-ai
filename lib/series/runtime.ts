import { runtimeRepository } from '@/lib/repositories';
import { ProductionService } from './service';

export const productionService = new ProductionService(runtimeRepository);
