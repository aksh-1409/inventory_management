import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const adjustmentSchema = z.object({
  inventoryItemId: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.inventoryItem.findMany({
      where: { product: { deletedAt: null } },
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
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

    // Atomic: Read current, update, log transaction — all in one transaction
    const [updatedItem, transaction] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          quantity: { increment: delta },
        },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          type: 'ADJUSTMENT',
          delta,
          reference: `Adjustment: ${reason}`,
          userId: session.user.id,
        },
      }),
    ])

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
