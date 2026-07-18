import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/rate-limit'
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        // Rate limit check (per email)
        const rateCheck = checkRateLimit(email)
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
        }
      },
    }),
  ],
})
