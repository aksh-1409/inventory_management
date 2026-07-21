import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateCheck = checkRateLimit(`forgot-password:${ip}`)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)} minute(s).` },
        { status: 429 }
      )
    }

    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(rawToken, 12)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min TTL

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const resetUrl = `${req.nextUrl.origin}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`
    console.log(`[PASSWORD_RESET] ${resetUrl}`)

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.', devUrl: resetUrl })
  } catch (error) {
    console.error('[FORGOT_PASSWORD_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
