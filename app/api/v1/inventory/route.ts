import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { z } from 'zod'

const adjustmentSchema = z.object({
  inventoryItemId: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
})

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const { searchParams } = new URL(req.url)
    const take = Math.min(Number(searchParams.get('take')) || 100, 500)
    const skip = Number(searchParams.get('skip')) || 0
    const warehouseId = searchParams.get('warehouseId') || undefined

    const items = await prisma.inventoryItem.findMany({
      take,
      skip,
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        product: { deletedAt: null },
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { product: { name: 'asc' } },
    })

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

    return NextResponse.json({ items: serialized })
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
