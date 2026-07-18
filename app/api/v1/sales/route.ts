import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const saleSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const result = saleSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, warehouseId, customerId, quantity, unitPrice, notes } = result.data

    // Find inventory item
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    })

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Product not found in this warehouse' },
        { status: 404 }
      )
    }

    // Atomic guard: check sufficient stock
    if (inventoryItem.quantity < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${inventoryItem.quantity}, requested: ${quantity}` },
        { status: 409 }
      )
    }

    // Atomic: decrement stock + create transaction
    const [updatedItem, transaction] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { quantity: { decrement: quantity } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: 'OUT',
          delta: -quantity,
          reference: notes || `Sale to customer`,
          userId: session.user.id,
        },
      }),
    ])

    return NextResponse.json({
      sale: {
        id: transaction.id,
        productId,
        warehouseId,
        customerId,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        createdAt: transaction.createdAt.toISOString(),
      },
      remainingStock: updatedItem.quantity,
    }, { status: 201 })
  } catch (error) {
    console.error('[SALE_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
