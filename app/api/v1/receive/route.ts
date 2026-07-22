import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { receiveSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    if (!hasScope(user, 'receive:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = receiveSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, warehouseId, supplierId, quantity, unitCost, notes } = result.data

    if (user.role === 'OPERATOR' && user.warehouseId !== warehouseId) {
      return NextResponse.json(
        { error: 'You can only receive stock into your assigned warehouse' },
        { status: 403 }
      )
    }

    // Verify product and warehouse exist
    const [product, warehouse, supplier] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId } }),
      prisma.supplier.findUnique({ where: { id: supplierId } }),
    ])

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (!warehouse) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    // Atomic: upsert, increment stock, create transaction — all in one transaction
    const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventoryItem.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: { productId, warehouseId, quantity: 0 },
        update: {},
      })

      const updated = await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: { increment: quantity } },
      })
      const txn = await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: inv.id,
          type: 'IN',
          delta: quantity,
          reference: notes || `Received from ${supplier.name}`,
          userId: user.id,
        },
      })
      return [updated, txn]
    })

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
