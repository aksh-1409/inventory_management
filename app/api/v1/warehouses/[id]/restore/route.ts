import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit'

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
    if (!hasScope(user, 'warehouses:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }
    if (!existing.deletedAt) {
      return NextResponse.json({ error: 'Warehouse is not deleted' }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { deletedAt: null },
    })
    await auditLog(user.id, 'Warehouse', id, 'RESTORE')

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('[WAREHOUSE_RESTORE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
