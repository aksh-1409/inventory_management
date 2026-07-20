import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { dispatchWebhook } from '@/lib/webhooks'
import { z } from 'zod'

const saleSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    if (!hasScope(user, 'sales:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    console.log('[SALE_POST_BODY]', JSON.stringify(body))
    const result = saleSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, warehouseId, customerId, quantity, unitPrice, notes } = result.data

    if (user.role === 'OPERATOR' && user.warehouseId !== warehouseId) {
      return NextResponse.json(
        { error: 'You can only record sales for your assigned warehouse' },
        { status: 403 }
      )
    }

    // Atomic: lock row, check stock, decrement, log — all in one transaction
    const { updatedItem, transaction } = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      })
      if (!item) throw new Error('NOT_FOUND:Product not found in this warehouse')

      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE id = ${item.id} FOR UPDATE`

      const locked = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      if (locked!.quantity < quantity) {
        throw new Error(`CONFLICT:Insufficient stock. Available: ${locked!.quantity}, requested: ${quantity}`)
      }

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: { decrement: quantity } },
      })
      const txn = await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: 'OUT',
          delta: -quantity,
          reference: notes || `Sale to customer`,
          userId: user.id,
        },
      })
      return { updatedItem: updated, transaction: txn }
    })

    dispatchWebhook('sale.created', {
      saleId: transaction.id, productId, warehouseId, customerId, quantity, unitPrice,
      total: quantity * unitPrice, remainingStock: updatedItem.quantity,
    })

    // Fetch related names for response
    const [product, warehouse, customer] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId } }),
      prisma.customer.findUnique({ where: { id: customerId } }),
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
        product: product ? { id: product.id, name: product.name, sku: product.sku } : null,
        warehouse: warehouse ? { id: warehouse.id, name: warehouse.name } : null,
        customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : null,
      },
      remainingStock: updatedItem.quantity,
    }, { status: 201 })
  } catch (error: any) {
    if (error?.message?.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ error: error.message.slice(9) }, { status: 404 })
    }
    if (error?.message?.startsWith('CONFLICT:')) {
      return NextResponse.json({ error: error.message.slice(9) }, { status: 409 })
    }
    console.error('[SALE_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
