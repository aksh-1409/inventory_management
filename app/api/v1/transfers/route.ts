import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { transferRequestSchema } from '@/lib/schemas'
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const cursorMode = searchParams.has('cursor')

    const baseWhere = (user.role === 'OPERATOR' && user.warehouseId)
      ? {
          OR: [
            { fromWarehouseId: user.warehouseId },
            { toWarehouseId: user.warehouseId },
            { status: 'REQUESTED' as const },
          ],
        }
      : {}

    const searchWhere = q
      ? {
          OR: [
            { product: { name: { contains: q, mode: 'insensitive' as const } } },
            { product: { sku: { contains: q, mode: 'insensitive' as const } } },
            { fromWarehouse: q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined },
            { toWarehouse: { name: { contains: q, mode: 'insensitive' as const } } },
          ].filter(Boolean),
        }
      : {}

    const where = {
      product: { deletedAt: null },
      ...baseWhere,
      ...(Object.keys(searchWhere).length ? searchWhere : {}),
    }

    const include = {
      product: true,
      fromWarehouse: true,
      toWarehouse: true,
      initiatedBy: { select: { id: true, name: true, email: true } as const },
    }

    if (cursorMode) {
      const { cursor, take } = parseCursor(searchParams, { take: 200 })
      const totalCount = await prisma.transfer.count({ where })
      const raw = await prisma.transfer.findMany({
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        where, include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      })
      const { data, nextCursor, hasMore } = buildCursorResponse(raw, take, totalCount)
      return NextResponse.json({ transfers: data, nextCursor, totalCount, hasMore })
    }

    const { page, pageSize, skip, take } = parsePagination(searchParams, { page: 1, pageSize: 200 })

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        skip, take, where, include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      prisma.transfer.count({ where }),
    ])

    return NextResponse.json({ transfers, total, page, pageSize })
  } catch (error) {
    console.error('[TRANSFERS_GET_ERROR]', error)
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

    if (!hasScope(user, 'transfers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    console.log('[TRANSFER_POST_BODY]', JSON.stringify(body))
    const result = transferRequestSchema.safeParse(body)
    if (!result.success) {
      console.log('[TRANSFER_POST_ERROR]', JSON.stringify(result.error.issues))
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, toWarehouseId, quantity, notes } = result.data

    // Operators can only request to their own warehouse
    if (user.role === 'OPERATOR' && user.warehouseId !== toWarehouseId) {
      return NextResponse.json({ error: 'You can only request transfers to your assigned warehouse' }, { status: 403 })
    }

    // Create a transfer REQUEST — no source warehouse yet
    const transfer = await prisma.transfer.create({
      data: {
        productId,
        toWarehouseId,
        quantityInitiated: quantity,
        status: 'REQUESTED',
        initiatedById: user.id,
        notes: notes || null,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    })

    return NextResponse.json({ transfer }, { status: 201 })
  } catch (error) {
    console.error('[TRANSFER_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
