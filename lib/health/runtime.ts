import 'server-only';

import { prisma } from '@/lib/db';
import { HealthService } from './service';

export const healthService = new HealthService(async () => { if (!process.env.DATABASE_URL) return process.env.NODE_ENV !== 'production'; await prisma.$queryRaw`SELECT 1`; return true; });
