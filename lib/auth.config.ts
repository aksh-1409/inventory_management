import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // refresh session every 24h
  },
  callbacks: {
    // Edge-safe jwt: just copy user fields into token. No DB calls.
    // lib/auth.ts overrides this with full Prisma enrichment.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.warehouseId = user.warehouseId ?? null;
        token.warehouseName = user.warehouseName ?? null;
        token.emailVerifiedAt =
          (user as { emailVerifiedAt?: string | null }).emailVerifiedAt?.toString?.() ?? null;
        token.passwordSetAt = user.passwordSetAt?.toString?.() ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'OPERATOR';
        session.user.warehouseId = (token.warehouseId as string | null) ?? null;
        session.user.warehouseName = (token.warehouseName as string | null) ?? null;
        session.user.emailVerifiedAt = (token.emailVerifiedAt as string | null) ?? null;
        session.user.passwordSetAt = (token.passwordSetAt as string | null) ?? null;
      }
      return session;
    },
    // Protect routes — redirect unauthenticated users to login
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuth = nextUrl.pathname.startsWith('/auth');
      const isSetup = nextUrl.pathname === '/auth/setup';
      const isResetFlow = nextUrl.pathname === '/auth/password-reset';

      if (isSetup || isResetFlow) {
        return true;
      }

      if (isOnAuth) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [], // Empty array for Edge compatibility; populated in auth.ts
} satisfies NextAuthConfig;
