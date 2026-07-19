import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import WebhooksClient from './webhooks/WebhooksClient'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const webhooks = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const data = webhooks.map((w) => ({
    id: w.id,
    eventType: w.eventType,
    targetUrl: w.targetUrl,
    isActive: w.isActive,
    retryCount: w.retryCount,
    lastTriggeredAt: w.lastTriggeredAt?.toISOString() || null,
    createdAt: w.createdAt.toISOString(),
  }))

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 24 }}>Settings</h1>
      <WebhooksClient initialWebhooks={data} />
    </div>
  )
}
