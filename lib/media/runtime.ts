import { runtimeRepository } from '@/lib/repositories';
import { GenerationService } from './generation-service';
export const generationService = new GenerationService(runtimeRepository);
