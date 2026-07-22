import { prisma } from '@/lib/prisma'

type EntityType = string
type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'

export async function auditLog(
  userId: string,
  entityType: EntityType,
  entityId: string,
  action: Action,
  changes?: { before?: unknown; after?: unknown }
) {
  try {
    await prisma.auditLog.create({
      data: { userId, entityType, entityId, action, changes: (changes ?? undefined) as any },
    })
  } catch (error) {
    console.error(`[AUDIT_LOG_ERROR] ${entityType} ${action} ${entityId}:`, error)
  }
}
