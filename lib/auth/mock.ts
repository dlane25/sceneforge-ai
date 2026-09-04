import type { AuthAdapter, Session } from './types';

const demoSession: Session = {
  user: {
    id: process.env.DEV_USER_ID || 'demo-user',
    email: process.env.DEV_USER_EMAIL || 'demo@sceneforge.local',
    displayName: 'Demo Producer',
  },
};

export class MockAuthAdapter implements AuthAdapter {
  constructor(private readonly session: Session | null = demoSession) {}
  async getSession(): Promise<Session | null> { return this.session; }
}

export const mockAuth = new MockAuthAdapter();
