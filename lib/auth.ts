import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimitPair, resetRateLimit } from '@/lib/rate-limit'
import { authConfig } from './auth.config'

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

        const email = credentials.email as string
        const password = credentials.password as string

        // Composite rate limit: IP+email
        const ip = (req as any)?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
          ?? (req as any)?.headers?.['x-real-ip']
          ?? 'unknown'
        const rateCheck = checkRateLimitPair(`login:ip:${ip}`, `login:account:${email}`)
        if (!rateCheck.success) {
          throw new Error(
            `Too many attempts. Try again in ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)} minute(s).`
          )
        }

        // Look up user in DB
        const user = await prisma.user.findUnique({
          where: { email },
          include: { warehouse: true },
        })

        if (!user) {
          throw new Error('Invalid email or password.')
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          throw new Error('Invalid email or password.')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          warehouseId: user.warehouseId,
          warehouseName: user.warehouse?.name ?? null,
          emailVerifiedAt: user.emailVerified,
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
      // On initial sign-in, resolve the DB user by email.
      // Handles both credentials (authorize returns DB user with id)
      // and OAuth (profile id may be undefined or not match our DB).
      if (user && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { warehouse: true },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.warehouseId = dbUser.warehouseId
          token.warehouseName = dbUser.warehouse?.name ?? null
          token.emailVerifiedAt = dbUser.emailVerified?.toISOString() ?? null
        }
      } else if (user) {
        token.id = user.id ?? (user as any).id
        token.role = (user as any).role
        token.warehouseId = (user as any).warehouseId ?? null
        token.warehouseName = (user as any).warehouseName ?? null
        token.emailVerifiedAt = (user as any).emailVerifiedAt?.toString?.() ?? null
      }
      // On token refresh, re-fetch current role from DB
      if (trigger === 'update' && token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { warehouse: true },
        })
        if (freshUser) {
          token.role = freshUser.role
          token.warehouseId = freshUser.warehouseId
          token.warehouseName = freshUser.warehouse?.name ?? null
          token.emailVerifiedAt = freshUser.emailVerified?.toISOString() ?? null
        }
      }
      return token
    },
    async signIn({ user, account }) {
      if (user.email) resetRateLimit(`login:account:${user.email}`)

      // Auto-link OAuth accounts: create user if not exists — no warehouse assigned yet
      if (account?.provider !== 'credentials' && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await prisma.user.create({
            data: {
              name: user.name ?? '',
              email: user.email,
              passwordHash: '',
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
