import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/email'
import { hashResetSecret, parseResetCookie, RESET_REQUEST_COOKIE } from '@/lib/password-reset'
import { resetRateLimit } from '@/lib/rate-limit'

const schema = z.object({ password: z.string().min(8, 'Password must be at least 8 characters') })

export async function POST(req: NextRequest) {
  const credential = parseResetCookie(req.cookies.get(RESET_REQUEST_COOKIE)?.value)
  if (!credential) return NextResponse.json({ error: 'This reset request is no longer available.' }, { status: 400 })

  const result = schema.safeParse(await req.json())
  if (!result.success) return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })

  const passwordHash = await bcrypt.hash(result.data.password, 12)
  const now = new Date()

  try {
    const email = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM password_reset_requests WHERE id = ${credential.requestId}::uuid FOR UPDATE`
      const request = await tx.passwordResetRequest.findUnique({
        where: { id: credential.requestId },
        include: { user: { select: { id: true, email: true, role: true } } },
      })

      if (!request || request.requestSecretHash !== hashResetSecret(credential.secret) || request.status !== 'APPROVED' || request.expiresAt <= now || request.user.role !== 'OPERATOR') {
        throw new Error('INVALID_RESET_REQUEST')
      }

      await tx.user.update({
        where: { id: request.user.id },
        data: { passwordHash, passwordSetAt: now, passwordChangedAt: now },
      })
      await tx.passwordResetRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED', completedAt: now },
      })
      await tx.passwordResetRequest.updateMany({
        where: { userId: request.user.id, id: { not: request.id }, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'CANCELLED' },
      })
      await tx.passwordResetToken.updateMany({
        where: { userId: request.user.id, usedAt: null },
        data: { usedAt: now },
      })
      return request.user.email
    })

    resetRateLimit(`login:account:${normalizeEmail(email)}`)
    const response = NextResponse.json({ message: 'Password reset successfully.' })
    response.cookies.set(RESET_REQUEST_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_RESET_REQUEST') {
      return NextResponse.json({ error: 'This reset request is not approved or has expired.' }, { status: 400 })
    }
    console.error('[PASSWORD_RESET_COMPLETE_ERROR]', error)
    return NextResponse.json({ error: 'Authentication service is temporarily unavailable.' }, { status: 503 })
  }
}
