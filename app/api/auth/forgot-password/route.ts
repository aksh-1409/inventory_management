import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/email'

const COOKIE_NAME = 'stockpilot-reset-request'
const REQUEST_TTL_MS = 30 * 60 * 1000

function hashSecret(secret: string) {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    const rateCheck = checkRateLimit(`forgot-password:${ip ?? 'local'}`)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)} minute(s).` },
        { status: 429 }
      )
    }

    const body = await req.json()
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    const secret = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS)
    let requestId: string = crypto.randomUUID()

    if (user?.role === 'OPERATOR') {
      const request = await prisma.$transaction(async tx => {
        await tx.passwordResetRequest.updateMany({
          where: { userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: 'CANCELLED' },
        })
        return tx.passwordResetRequest.create({
          data: {
            userId: user.id,
            requestSecretHash: hashSecret(secret),
            expiresAt,
            requestIp: ip,
            userAgent: req.headers.get('user-agent'),
          },
        })
      })
      requestId = request.id
    }

    const response = NextResponse.json({
      message: 'Your request has been submitted for administrator review.',
      statusUrl: '/auth/password-reset',
    })
    response.cookies.set(COOKIE_NAME, `${requestId}.${secret}`, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REQUEST_TTL_MS / 1000,
    })
    return response
  } catch (error) {
    console.error('[FORGOT_PASSWORD_ERROR]', error)
    return NextResponse.json({ error: 'Authentication service is temporarily unavailable.' }, { status: 503 })
  }
}
