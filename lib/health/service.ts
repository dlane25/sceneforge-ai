import 'server-only';

import type { ProductionReadinessReport } from '@/types';
import { assessProductionConfiguration } from '@/lib/launch/config';

export interface HealthResult { status: 'ok' | 'degraded' | 'unready'; checkedAt: Date; checks: Array<{ id: string; status: 'pass' | 'fail'; blocking: boolean }> }

export class HealthService {
  constructor(private readonly databaseCheck: () => Promise<boolean> = async () => true, private readonly now: () => Date = () => new Date()) {}
  live(): HealthResult { return { status: 'ok', checkedAt: this.now(), checks: [{ id: 'runtime', status: 'pass', blocking: true }] }; }
  async ready(env: Record<string, string | undefined> = process.env, configuration?: ProductionReadinessReport): Promise<HealthResult> {
    const config = configuration || assessProductionConfiguration(env, { now: this.now() }); let database = false;
    if (env.NODE_ENV !== 'production' && !env.DATABASE_URL) database = true;
    else { try { database = await Promise.race([this.databaseCheck(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))]); } catch { database = false; } }
    const checks = [...config.checks.filter((check) => check.blocking).map((check) => ({ id: check.id, status: check.status === 'pass' ? 'pass' as const : 'fail' as const, blocking: true })), { id: 'database.connectivity', status: database ? 'pass' as const : 'fail' as const, blocking: true }];
    return { status: checks.some((check) => check.status === 'fail') ? 'unready' : 'ok', checkedAt: this.now(), checks };
  }
}
