export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export interface Session {
  user: AuthenticatedUser;
  expiresAt?: Date;
}

export interface AuthContext {
  user: AuthenticatedUser;
  session: Session;
}

export interface AuthAdapter {
  getSession(): Promise<Session | null>;
}

export class AuthenticationError extends Error {
  readonly code = 'UNAUTHENTICATED';
  readonly status = 401;
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN';
  readonly status = 403;
}
