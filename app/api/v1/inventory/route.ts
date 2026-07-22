import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { adjustmentSchema } from '@/lib/schemas'
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const cursorMode = searchParams.has('cursor')
    const warehouseId = searchParams.get('warehouseId') || undefined

    const where = {
      ...(warehouseId ? { warehouseId } : {}),
      product: { deletedAt: null },
      ...(q ? {
        OR: [
          { product: { name: { contains: q, mode: 'insensitive' as const } } },
          { product: { sku: { contains: q, mode: 'insensitive' as const } } },
          { warehouse: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      } : {}),
    }

    if (cursorMode) {
      const { cursor, take } = parseCursor(searchParams)
      const totalCount = await prisma.inventoryItem.count({ where })
      const raw = await prisma.inventoryItem.findMany({
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        where,
        include: { product: true, warehouse: true },
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      })
      const serialized = raw.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        productId: item.productId,
        warehouseId: item.warehouseId,
        product: {
          id: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          reorderPoint: item.product.reorderPoint,
        },
        warehouse: { id: item.warehouse.id, name: item.warehouse.name },
      }))
      const { data, nextCursor, hasMore } = buildCursorResponse(serialized, take, totalCount)
      return NextResponse.json({ items: data, nextCursor, totalCount, hasMore })
    }

    const { page, pageSize, skip, take } = parsePagination(searchParams)

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        skip, take, where,
        include: { product: true, warehouse: true },
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      }),
      prisma.inventoryItem.count({ where }),
    ])

    const serialized = items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      productId: item.productId,
      warehouseId: item.warehouseId,
      product: {
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        reorderPoint: item.product.reorderPoint,
      },
      warehouse: {
        id: item.warehouse.id,
        name: item.warehouse.name,
      },
    }))

    return NextResponse.json({ items: serialized, total, page, pageSize })
  } catch (error) {
    console.error('[INVENTORY_GET_ERROR]', error)
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
    if (!hasScope(user, 'inventory:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = adjustmentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { inventoryItemId, delta, reason } = result.data

    if (delta === 0) {
      return NextResponse.json({ error: 'Adjustment cannot be zero' }, { status: 400 })
    }

    // Atomic: lock row, update, log — all in one interactive transaction
    const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE id = ${inventoryItemId} FOR UPDATE`
      const updated = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantity: { increment: delta } },
      })
      const txn = await tx.inventoryTransaction.create({
        data: {
          inventoryItemId,
          type: 'ADJUSTMENT',
          delta,
          reference: `Adjustment: ${reason}`,
          userId: user.id,
        },
      })
      return [updated, txn]
    })

    return NextResponse.json({
      item: updatedItem,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        delta: transaction.delta,
        reference: transaction.reference,
        createdAt: transaction.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[INVENTORY_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
