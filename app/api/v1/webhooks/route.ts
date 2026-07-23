import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { createWebhookSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult
    if (!hasScope(user, 'webhooks:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const webhooks = await prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ webhooks })
  } catch (error) {
    console.error('[WEBHOOKS_GET_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult
    if (!hasScope(user, 'webhooks:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = createWebhookSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const webhook = await prisma.webhookSubscription.create({
      data: result.data,
    })
    await auditLog(user.id, 'Webhook', webhook.id, 'CREATE', { after: webhook })

    return NextResponse.json({ webhook }, { status: 201 })
  } catch (error) {
    console.error('[WEBHOOKS_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
