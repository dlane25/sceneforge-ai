import { prisma } from '@/lib/db';
import { PrismaPersistenceRepository } from './prisma';
import { memoryRepository } from './in-memory';
import type { PersistenceRepository } from './contracts';

export const runtimeRepository: PersistenceRepository = process.env.DATABASE_URL
  ? new PrismaPersistenceRepository(prisma)
  : memoryRepository;
