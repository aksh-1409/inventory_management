import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ApiKeysClient from './ApiKeysClient'

export default async function ApiKeysPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const keys = apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: `sp_live_${k.keyHash.substring(0, 8)}`,
    scopes: k.scopes,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt?.toISOString() || null,
    expiresAt: k.expiresAt?.toISOString() || null,
    createdAt: k.createdAt.toISOString(),
  }))

  return <ApiKeysClient initialKeys={keys} />
}
