import { runtimeRepository } from '@/lib/repositories';
import type { MembershipRepository, PersistedUser, PersistenceRepository } from '@/lib/repositories';
import { AuthorizationError, AuthenticationError } from './types';
import type { AuthAdapter, AuthContext, AuthenticatedUser, Session } from './types';
import { mockAuth } from './mock';

export * from './types';
export { MockAuthAdapter } from './mock';

let authAdapter: AuthAdapter = mockAuth;
type AuthDataRepository = MembershipRepository & Partial<Pick<PersistenceRepository, 'upsertUser'>>;
let membershipRepository: AuthDataRepository = runtimeRepository;

export function setAuthAdapter(adapter: AuthAdapter): void { authAdapter = adapter; }
export function getAuthAdapter(): AuthAdapter { return authAdapter; }
export function setMembershipRepository(repository: AuthDataRepository): void { membershipRepository = repository; }

export async function optionalUser(): Promise<AuthenticatedUser | null> {
  const session = await authAdapter.getSession();
  return session?.user || null;
}

export async function requireUser(): Promise<AuthContext> {
  const session: Session | null = await authAdapter.getSession();
  if (!session) throw new AuthenticationError('Authentication is required');
  return { user: session.user, session };
}

export async function ensureDemoMembership(seriesId: string): Promise<void> {
  const user = await optionalUser();
  if (!user || seriesId !== 'series_empire_of_lies') return;
  if (membershipRepository.upsertUser) {
    const persistedUser: PersistedUser = user;
    await membershipRepository.upsertUser(persistedUser);
  }
  const current = await membershipRepository.getMembership(user.id, seriesId);
  if (!current) await membershipRepository.upsertMembership({ id: `membership_${user.id}_${seriesId}`, userId: user.id, seriesId, role: 'OWNER' });
}

export async function requireSeriesAccess(seriesId: string, role: 'OWNER' | 'EDITOR' | 'VIEWER' = 'VIEWER'): Promise<AuthContext> {
  const context = await requireUser();
  await ensureDemoMembership(seriesId);
  const membership = await membershipRepository.getMembership(context.user.id, seriesId);
  if (!membership) throw new AuthorizationError('You do not have access to this production');
  const allowed = role === 'VIEWER' || membership.role === 'OWNER' || (role === 'EDITOR' && membership.role === 'EDITOR');
  if (!allowed) throw new AuthorizationError('Your production role does not permit this action');
  return context;
}

export async function canReadSeries(userId: string, seriesId: string): Promise<boolean> { const membership = await membershipRepository.getMembership(userId, seriesId); return Boolean(membership); }
export async function canEditSeries(userId: string, seriesId: string): Promise<boolean> { const membership = await membershipRepository.getMembership(userId, seriesId); return membership?.role === 'OWNER' || membership?.role === 'EDITOR'; }
export async function canApprovePipeline(userId: string, seriesId: string): Promise<boolean> { const membership = await membershipRepository.getMembership(userId, seriesId); return membership?.role === 'OWNER'; }
