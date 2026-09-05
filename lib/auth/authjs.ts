import { auth } from '@/auth';
import type { AuthAdapter, Session } from './types';

export class AuthJsAdapter implements AuthAdapter {
  constructor(private readonly sessionLoader: () => Promise<{ user?: { id?: string; email?: string | null; name?: string | null; provider?: string; providerSubject?: string } } | null> = auth) {}

  async getSession(): Promise<Session | null> {
    const session = await this.sessionLoader();
    if (!session?.user?.id || !session.user.email) return null;
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.name || session.user.email,
        provider: session.user.provider || 'authjs',
        subject: session.user.providerSubject || session.user.id,
      },
    };
  }
}

export const authJsAdapter = new AuthJsAdapter();
