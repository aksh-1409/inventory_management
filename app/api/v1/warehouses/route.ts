import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { warehouseSchema } from '@/lib/schemas'
import { parsePagination, parseSearch } from '@/lib/pagination'
import { auditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const { page, pageSize, skip, take } = parsePagination(searchParams)

    const where = {
      deletedAt: null,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { location: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        skip, take, where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { inventoryItems: true } } },
      }),
      prisma.warehouse.count({ where }),
    ])

    return NextResponse.json({ warehouses, total, page, pageSize })
  } catch (error) {
    console.error('[WAREHOUSES_GET_ERROR]', error)
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
    if (!hasScope(user, 'warehouses:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = warehouseSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.create({ data: result.data })
    await auditLog(user.id, 'Warehouse', warehouse.id, 'CREATE', { after: warehouse })

    return NextResponse.json({ warehouse }, { status: 201 })
  } catch (error) {
    console.error('[WAREHOUSES_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
