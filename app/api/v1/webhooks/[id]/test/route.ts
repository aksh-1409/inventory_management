import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params

    const webhook = await prisma.webhookSubscription.findUnique({ where: { id } })
    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    const payload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook event from StockPilot' },
    }

    try {
      await fetch(webhook.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })

      await prisma.webhookSubscription.update({
        where: { id },
        data: { lastTriggeredAt: new Date() },
      })
    } catch {
      // Test fire-and-forget — don't fail the endpoint if delivery fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WEBHOOK_TEST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
