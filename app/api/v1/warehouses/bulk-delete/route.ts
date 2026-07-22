import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { user } = authResult
    if (!hasScope(user, 'admin') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    const result = await prisma.warehouse.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    for (const id of ids) {
      await auditLog(user.id, 'Warehouse', id, 'DELETE')
    }

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('[WAREHOUSE_BULK_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
