import { runtimeRepository } from '@/lib/repositories';
import type { MembershipRepository, PersistedUser, PersistenceRepository } from '@/lib/repositories';
import { AuthorizationError, AuthenticationError } from './types';
import type { AuthAdapter, AuthContext, AuthenticatedUser, Session } from './types';
import { mockAuth } from './mock';

export * from './types';
export { MockAuthAdapter } from './mock';

let authAdapter: AuthAdapter = mockAuth;
type AuthDataRepository = MembershipRepository & Pick<PersistenceRepository, 'upsertUserIdentity'>;
let membershipRepository: AuthDataRepository = runtimeRepository;

export function setAuthAdapter(adapter: AuthAdapter): void { authAdapter = adapter; }
export function getAuthAdapter(): AuthAdapter { return authAdapter; }
export function setMembershipRepository(repository: AuthDataRepository): void { membershipRepository = repository; }

export async function optionalUser(): Promise<AuthenticatedUser | null> {
  if (process.env.NODE_ENV === 'production' && process.env.AUTH_MODE !== 'authjs') return null;
  const session = await getActiveAdapter().getSession();
  if (!session?.user) return null;
  const persisted = await membershipRepository.upsertUserIdentity({ email: session.user.email, displayName: session.user.displayName, provider: session.user.provider, providerSubject: session.user.subject });
  return { ...session.user, id: persisted.id };
}

export async function requireUser(): Promise<AuthContext> {
  if (process.env.NODE_ENV === 'production' && process.env.AUTH_MODE !== 'authjs') throw new AuthenticationError('Production authentication is not configured');
  const session: Session | null = await getActiveAdapter().getSession();
  if (!session) throw new AuthenticationError('Authentication is required');
  const user = await optionalUser();
  if (!user) throw new AuthenticationError('Authentication is required');
  return { user, session: { ...session, user } };
}

export async function ensureDemoMembership(seriesId: string): Promise<void> {
  const user = await optionalUser();
  if (!user || seriesId !== 'series_empire_of_lies') return;
  const persistedUser: Omit<PersistedUser, 'id'> = { email: user.email, displayName: user.displayName, provider: user.provider, providerSubject: user.subject };
  await membershipRepository.upsertUserIdentity(persistedUser);
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

function getActiveAdapter(): AuthAdapter {
  if (process.env.AUTH_MODE === 'authjs') {
    return { getSession: async () => (await import('./authjs')).authJsAdapter.getSession() };
  }
  return authAdapter;
}
