export interface RateLimitPolicy { limit: number; windowMs: number }
export interface RateLimitDecision { allowed: boolean; limit: number; remaining: number; resetAt: Date; retryAfterSeconds: number }
export interface RateLimiter { consume(key: string, policy: RateLimitPolicy, now?: Date): Promise<RateLimitDecision> }

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMITED';
  constructor(readonly retryAfterSeconds: number) { super('Too many requests. Retry later.'); this.name = 'RateLimitError'; }
}

interface WindowState { count: number; resetAtMs: number }

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowState>();
  async consume(key: string, policy: RateLimitPolicy, now = new Date()): Promise<RateLimitDecision> {
    if (!/^[A-Za-z0-9:_-]{1,500}$/.test(key) || policy.limit < 1 || policy.windowMs < 1) throw new Error('Rate limit configuration is invalid');
    const timestamp = now.getTime(); const current = this.windows.get(key);
    const state = !current || current.resetAtMs <= timestamp ? { count: 0, resetAtMs: timestamp + policy.windowMs } : current;
    state.count += 1; this.windows.set(key, state);
    const allowed = state.count <= policy.limit; const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((state.resetAtMs - timestamp) / 1000));
    return { allowed, limit: policy.limit, remaining: Math.max(0, policy.limit - state.count), resetAt: new Date(state.resetAtMs), retryAfterSeconds };
  }
  reset(): void { this.windows.clear(); }
}

export const COSTLY_ACTION_POLICIES = {
  orchestration: { limit: 10, windowMs: 60_000 },
  generation: { limit: 20, windowMs: 60_000 },
  audio: { limit: 30, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60_000 },
  retry: { limit: 10, windowMs: 60_000 },
} as const;

export type CostlyAction = keyof typeof COSTLY_ACTION_POLICIES;
export const runtimeRateLimiter = new InMemoryRateLimiter();

export async function enforceCostlyAction(userId: string, seriesId: string, action: CostlyAction, limiter: RateLimiter = runtimeRateLimiter): Promise<RateLimitDecision> {
  const decision = await limiter.consume(`${action}:${userId}:${seriesId}`, COSTLY_ACTION_POLICIES[action]);
  if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
  return decision;
}
