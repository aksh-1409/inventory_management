import NextAuth from 'next-auth'
import { CredentialsSignin } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getRateLimitStatus, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/email'
import { authConfig } from './auth.config'

class RateLimitedSignin extends CredentialsSignin {
  code = 'rate_limited'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = normalizeEmail(credentials.email as string)
        const password = credentials.password as string

        const forwardedFor = req.headers.get('x-forwarded-for')
        const ip = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
        const accountKey = `login:account:${email}`
        const ipKey = ip ? `login:ip:${ip}` : null
        const accountStatus = getRateLimitStatus(accountKey)
        const ipStatus = ipKey ? getRateLimitStatus(ipKey) : { success: true }
        if (!accountStatus.success || !ipStatus.success) {
          throw new RateLimitedSignin()
        }

        // Look up user in DB
        const user = await prisma.user.findUnique({
          where: { email },
          include: { warehouse: true },
        })

        if (!user) {
          recordFailedAttempt(accountKey)
          if (ipKey) recordFailedAttempt(ipKey)
          return null
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          recordFailedAttempt(accountKey)
          if (ipKey) recordFailedAttempt(ipKey)
          return null
        }

        resetRateLimit(accountKey)
        if (ipKey) resetRateLimit(ipKey)

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          warehouseId: user.warehouseId,
          warehouseName: user.warehouse?.name ?? null,
          emailVerifiedAt: user.emailVerified,
          passwordSetAt: user.passwordSetAt,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: { params: { prompt: 'consent' } },
      allowDangerousEmailAccountLinking: true,
    })] : []),
    ...(process.env.GITHUB_CLIENT_ID ? [GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: { params: { prompt: 'consent' } },
      allowDangerousEmailAccountLinking: true,
    })] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // On sign-in, resolve the DB user by email and copy all fields to token.
      // Handles credentials (authorize returns DB user) and OAuth (provider profile).
      if (user && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: normalizeEmail(user.email) },
          include: { warehouse: true },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.name = dbUser.name
          token.role = dbUser.role
          token.warehouseId = dbUser.warehouseId
          token.warehouseName = dbUser.warehouse?.name ?? null
          token.emailVerifiedAt = dbUser.emailVerified?.toISOString() ?? null
          token.passwordSetAt = dbUser.passwordSetAt?.toISOString() ?? null
        }
      }
      // On token refresh, re-fetch current role from DB
      if (trigger === 'update' && token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { warehouse: true },
        })
        if (freshUser) {
          token.name = freshUser.name
          token.role = freshUser.role
          token.warehouseId = freshUser.warehouseId
          token.warehouseName = freshUser.warehouse?.name ?? null
          token.emailVerifiedAt = freshUser.emailVerified?.toISOString() ?? null
          token.passwordSetAt = freshUser.passwordSetAt?.toISOString() ?? null
        }
      }
      return token
    },
    async signIn({ user, account }) {
      if (user.email) resetRateLimit(`login:account:${normalizeEmail(user.email)}`)

      // Handle OAuth sign-in (not credentials)
      if (account?.provider !== 'credentials' && user.email) {
        const email = normalizeEmail(user.email)
        const existing = await prisma.user.findUnique({ where: { email } })

        if (existing) {
          // Existing user — preserve warehouseId and passwordSetAt.
          // Update name from OAuth only if the user hasn't set one yet.
          if (!existing.name || existing.name === '') {
            await prisma.user.update({
              where: { id: existing.id },
              data: { name: user.name ?? existing.name },
            })
          }
          // Ensure email is verified for OAuth sign-ins
          if (!existing.emailVerified) {
            await prisma.user.update({
              where: { id: existing.id },
              data: { emailVerified: new Date() },
            })
          }
        } else {
          // New user — create with no password/warehouse, setup page will prompt
          await prisma.user.create({
            data: {
              name: user.name ?? '',
              email,
              passwordHash: '',
              passwordSetAt: null,
              role: 'OPERATOR',
              warehouseId: null,
              emailVerified: new Date(),
            },
          })
        }
      }
      return true
    },
  },
})
