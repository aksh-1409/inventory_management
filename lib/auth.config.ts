import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    // Expose role and id on the JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.warehouseId = (user as any).warehouseId ?? null
        token.warehouseName = (user as any).warehouseName ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'ADMIN' | 'OPERATOR'
        session.user.warehouseId = (token.warehouseId as string | null) ?? null
        session.user.warehouseName = (token.warehouseName as string | null) ?? null
      }
      return session
    },
    // Protect routes — redirect unauthenticated users to login
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAuth = nextUrl.pathname.startsWith('/auth')

      if (isOnAuth) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl))
        return true
      }

      if (!isLoggedIn) return false
      return true
    },
  },
  providers: [], // Empty array for Edge compatibility; populated in auth.ts
} satisfies NextAuthConfig
