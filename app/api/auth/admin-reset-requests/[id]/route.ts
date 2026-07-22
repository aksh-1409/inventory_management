import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 })
  }

  const { id } = await params
  const now = new Date()

  try {
    const status = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM password_reset_requests WHERE id = ${id}::uuid FOR UPDATE`
      const request = await tx.passwordResetRequest.findUnique({
        where: { id },
        include: { user: { select: { role: true } } },
      })
      if (!request || request.user.role !== 'OPERATOR' || request.status !== 'PENDING' || request.expiresAt <= now) {
        throw new Error('REQUEST_UNAVAILABLE')
      }

      const status = body.action === 'approve' ? 'APPROVED' : 'REJECTED'
      await tx.passwordResetRequest.update({
        where: { id },
        data: { status, reviewedAt: now, reviewedById: session.user.id },
      })
      return status
    })
    return NextResponse.json({ status })
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_UNAVAILABLE') {
      return NextResponse.json({ error: 'This request is no longer pending.' }, { status: 409 })
    }
    console.error('[ADMIN_RESET_REQUEST_ERROR]', error)
    return NextResponse.json({ error: 'Unable to review this request.' }, { status: 500 })
  }
}
