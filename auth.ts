import 'server-only';

import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

const providers = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }));
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try { return new URL(url).origin === new URL(baseUrl).origin ? url : baseUrl; } catch { return baseUrl; }
    },
    jwt({ token, profile, account }) {
      if (account?.provider) token.provider = account.provider;
      if (profile?.sub) token.providerSubject = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.provider = typeof token.provider === 'string' ? token.provider : 'authjs';
        session.user.providerSubject = typeof token.providerSubject === 'string' ? token.providerSubject : token.sub;
      }
      return session;
    },
  },
});
