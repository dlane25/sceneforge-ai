import 'server-only';

import { runtimeRepository } from '@/lib/repositories';
import { OrchestrationService } from './service';

export const orchestrationService = new OrchestrationService(runtimeRepository);
