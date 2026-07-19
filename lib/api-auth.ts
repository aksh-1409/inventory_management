import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export interface AuthUser {
  id: string
  role: string
  warehouseId: string | null
  scopes?: string[]
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function apiAuth(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer sp_live_')) {
    const rawKey = authHeader.slice(7)
    const keyHash = hashKey(rawKey)

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    })

    if (!apiKey || !apiKey.isActive) return null
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {})

    return {
      id: apiKey.userId,
      role: apiKey.user.role,
      warehouseId: apiKey.user.warehouseId,
      scopes: apiKey.scopes,
    }
  }

  return null
}

export async function requireAuth(req: NextRequest): Promise<{ user: AuthUser; source: 'session' | 'api-key' } | null> {
  const session = await auth()
  if (session?.user) {
    return {
      user: {
        id: session.user.id,
        role: session.user.role,
        warehouseId: session.user.warehouseId,
      },
      source: 'session',
    }
  }

  const apiKeyUser = await apiAuth(req)
  if (apiKeyUser) {
    return { user: apiKeyUser, source: 'api-key' }
  }

  return null
}

export function hasScope(user: AuthUser, scope: string): boolean {
  if (user.role === 'ADMIN') return true
  if (!user.scopes) return false
  return user.scopes.includes(scope)
}
