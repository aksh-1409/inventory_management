import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

const receiveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  supplierId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const body = await req.json()
    const result = receiveSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, warehouseId, supplierId, quantity, unitCost, notes } = result.data

    // Verify product and warehouse exist
    const [product, warehouse, supplier] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId } }),
      prisma.supplier.findUnique({ where: { id: supplierId } }),
    ])

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (!warehouse) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    // Upsert inventory item (create if doesn't exist)
    const inventoryItem = await prisma.inventoryItem.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: {
        productId,
        warehouseId,
        quantity: 0,
      },
      update: {},
    })

    // Atomic: increment stock + create transaction
    const [updatedItem, transaction] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { quantity: { increment: quantity } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: 'IN',
          delta: quantity,
          reference: notes || `Received from ${supplier.name}`,
          userId: user.id,
        },
      }),
    ])

    return NextResponse.json({
      receipt: {
        id: transaction.id,
        productId,
        warehouseId,
        supplierId,
        quantity,
        unitCost: unitCost || null,
        total: unitCost ? quantity * unitCost : null,
        createdAt: transaction.createdAt.toISOString(),
        product: { id: product.id, name: product.name, sku: product.sku },
        warehouse: { id: warehouse.id, name: warehouse.name },
        supplier: { id: supplier.id, name: supplier.name },
      },
      newStock: updatedItem.quantity,
    }, { status: 201 })
  } catch (error) {
    console.error('[RECEIVE_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
