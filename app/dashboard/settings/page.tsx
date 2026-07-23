import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parsePagination, parseSearch } from '@/lib/pagination'
import WebhooksClient from './webhooks/WebhooksClient'

export default async function SettingsPage(props: { searchParams?: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const searchParams = new URLSearchParams()
  const sp = await props.searchParams
  if (sp?.q) searchParams.set('q', sp.q)
  if (sp?.page) searchParams.set('page', sp.page)
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize)

  const q = parseSearch(searchParams)
  const { page, pageSize, skip, take } = parsePagination(searchParams)

  const where = q ? {
    OR: [
      { eventType: { contains: q, mode: 'insensitive' as const } },
      { targetUrl: { contains: q, mode: 'insensitive' as const } },
    ],
  } : {}

  const [rawWebhooks, total] = await Promise.all([
    prisma.webhookSubscription.findMany({ skip, take, where, orderBy: { createdAt: 'desc' } }),
    prisma.webhookSubscription.count({ where }),
  ])

  const webhooks = rawWebhooks.map((w) => ({
    id: w.id, eventType: w.eventType, targetUrl: w.targetUrl,
    isActive: w.isActive, retryCount: w.retryCount,
    lastTriggeredAt: w.lastTriggeredAt?.toISOString() || null,
    createdAt: w.createdAt.toISOString(),
  }))

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 24 }}>Settings</h1>
      <WebhooksClient initialWebhooks={webhooks} total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
