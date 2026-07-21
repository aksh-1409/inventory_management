import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const resetSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateCheck = checkRateLimit(`reset-password:${ip}`)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)} minute(s).` },
        { status: 429 }
      )
    }

    const body = await req.json()
    const result = resetSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { token, email, password } = result.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    let matchedToken = null
    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash)
      if (isValid) {
        matchedToken = t
        break
      }
    }

    if (!matchedToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: matchedToken.id }, data: { usedAt: new Date() } }),
    ])

    return NextResponse.json({ message: 'Password has been reset successfully. You can now log in.' })
  } catch (error) {
    console.error('[RESET_PASSWORD_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
