import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { transferAcceptSchema } from '@/lib/schemas'

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

    if (!hasScope(user, 'transfers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const result = transferAcceptSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { fromWarehouseId } = result.data

    // Operators can only accept requests where the source is their warehouse
    if (user.role === 'OPERATOR' && user.warehouseId !== fromWarehouseId) {
      return NextResponse.json({ error: 'You can only accept requests from your assigned warehouse' }, { status: 403 })
    }

    const [transfer] = await prisma.$transaction(async (tx) => {
      // Lock the transfer row so concurrent requests block until one commits
      await tx.$executeRaw`SELECT status FROM transfers WHERE id = ${id} FOR UPDATE`
      const existing = await tx.transfer.findUnique({ where: { id } })
      if (!existing) throw new Error('NOT_FOUND:Transfer not found')
      if (existing.status !== 'REQUESTED') throw new Error(`CONFLICT:Cannot accept transfer in ${existing.status} status`)

      if (fromWarehouseId === existing.toWarehouseId) {
        throw new Error('BAD_REQUEST:Source and destination warehouses must be different')
      }

      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE product_id = ${existing.productId} AND warehouse_id = ${fromWarehouseId} FOR UPDATE`

      const sourceInv = await tx.inventoryItem.findUnique({
        where: { productId_warehouseId: { productId: existing.productId, warehouseId: fromWarehouseId } },
      })
      if (!sourceInv || sourceInv.quantity < existing.quantityInitiated) {
        throw new Error(`CONFLICT:Insufficient stock at source. Available: ${sourceInv?.quantity || 0}, requested: ${existing.quantityInitiated}`)
      }

      const updatedTransfer = await tx.transfer.update({
        where: { id },
        data: { fromWarehouseId, status: 'PENDING' },
        include: { product: true, fromWarehouse: true, toWarehouse: true },
      })
      await tx.inventoryItem.update({
        where: { id: sourceInv.id },
        data: { quantity: { decrement: existing.quantityInitiated } },
      })
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: sourceInv.id,
          type: 'TRANSFER_OUT',
          delta: -existing.quantityInitiated,
          reference: `Transfer accepted — shipping to ${existing.toWarehouseId}`,
          userId: user.id,
        },
      })
      return [updatedTransfer]
    })

    return NextResponse.json({ transfer })
  } catch (error: any) {
    if (error?.message?.startsWith('NOT_FOUND:')) return NextResponse.json({ error: error.message.slice(9) }, { status: 404 })
    if (error?.message?.startsWith('CONFLICT:')) return NextResponse.json({ error: error.message.slice(9) }, { status: 409 })
    if (error?.message?.startsWith('BAD_REQUEST:')) return NextResponse.json({ error: error.message.slice(12) }, { status: 400 })
    console.error('[TRANSFER_ACCEPT_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
