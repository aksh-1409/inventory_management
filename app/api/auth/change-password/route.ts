import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resetRateLimit } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/email'
import { changePasswordSchema } from '@/lib/schemas'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

export async function PUT(req: Request) {
  const session = await auth()
  const userId = (session as any)?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const result = changePasswordSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { currentPassword, newPassword } = result.data

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: 'Cannot change password for OAuth accounts' }, { status: 400 })
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  if (user.passwordChangedAt) {
    const elapsed = Date.now() - user.passwordChangedAt.getTime()
    if (elapsed < COOLDOWN_MS) {
      const remainingHours = Math.ceil((COOLDOWN_MS - elapsed) / (60 * 60 * 1000))
      return NextResponse.json(
        { error: `Please wait ${remainingHours}h before changing your password again.` },
        { status: 429 }
      )
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordSetAt: new Date(), passwordChangedAt: new Date() },
  })
  resetRateLimit(`login:account:${normalizeEmail(user.email)}`)

  return NextResponse.json({ message: 'Password changed successfully.' })
}
