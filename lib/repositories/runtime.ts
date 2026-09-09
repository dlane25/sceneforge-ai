import 'server-only';

import { prisma } from '@/lib/db';
import { PrismaPersistenceRepository } from './prisma';
import { memoryRepository } from './in-memory';
import type { PersistenceRepository } from './contracts';

function createRuntimeRepository(): PersistenceRepository {
  if (process.env.DATABASE_URL) return new PrismaPersistenceRepository(prisma);
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('DATABASE_URL is required; production cannot use in-memory persistence');
  return memoryRepository;
}

export const runtimeRepository: PersistenceRepository = createRuntimeRepository();
