import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { dispatchWebhook } from '@/lib/webhooks'
import { transferReceiveSchema } from '@/lib/schemas'

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
    const result = transferReceiveSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { quantityReceived, damagedQuantity = 0, notes } = result.data

    // Do a lightweight read for pre-checks that don't need atomicity
    const preCheck = await prisma.transfer.findUnique({ where: { id }, select: { toWarehouseId: true, quantityInitiated: true } })
    if (!preCheck) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })

    if (user.role === 'OPERATOR' && user.warehouseId !== preCheck.toWarehouseId) {
      return NextResponse.json({ error: 'Only the destination warehouse can receive this transfer' }, { status: 403 })
    }

    if (quantityReceived > preCheck.quantityInitiated) {
      return NextResponse.json(
        { error: `Received quantity (${quantityReceived}) exceeds initiated quantity (${preCheck.quantityInitiated})` },
        { status: 400 }
      )
    }

    if (damagedQuantity > quantityReceived) {
      return NextResponse.json(
        { error: `Damaged quantity (${damagedQuantity}) cannot exceed received quantity (${quantityReceived})` },
        { status: 400 }
      )
    }

    // Atomic: lock, validate status, upsert, update, log — all in one transaction
    const [transfer] = await prisma.$transaction(async (tx) => {
      const existing = await tx.transfer.findUnique({ where: { id } })
      if (!existing) throw new Error('NOT_FOUND:Transfer not found')
      if (existing.status !== 'IN_TRANSIT') throw new Error(`CONFLICT:Cannot receive transfer in ${existing.status} status`)

      // Lock destination inventory row
      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE product_id = ${existing.productId} AND warehouse_id = ${existing.toWarehouseId} FOR UPDATE`

      const destInventory = await tx.inventoryItem.upsert({
        where: { productId_warehouseId: { productId: existing.productId, warehouseId: existing.toWarehouseId } },
        create: { productId: existing.productId, warehouseId: existing.toWarehouseId, quantity: 0 },
        update: {},
      })

      const updatedTransfer = await tx.transfer.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          quantityReceived,
          receivedAt: new Date(),
          notes: notes || existing.notes,
        },
        include: { product: true, fromWarehouse: true, toWarehouse: true },
      })

      await tx.inventoryItem.update({
        where: { id: destInventory.id },
        data: { quantity: { increment: quantityReceived } },
      })
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: destInventory.id,
          type: 'TRANSFER_IN',
          delta: quantityReceived,
          reference: `Transfer received${damagedQuantity > 0 ? ` (${damagedQuantity} damaged)` : ''}`,
          userId: user.id,
        },
      })

      if (damagedQuantity > 0) {
        await tx.inventoryItem.update({
          where: { id: destInventory.id },
          data: { quantity: { decrement: damagedQuantity } },
        })
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: destInventory.id,
            type: 'DAMAGE',
            delta: -damagedQuantity,
            reference: `Damaged in transfer ${id}`,
            userId: user.id,
          },
        })
      }

      return [updatedTransfer]
    })

    dispatchWebhook('transfer.completed', {
      transferId: id,
      productId: transfer.productId,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
      quantityReceived,
      damagedQuantity,
    })

    return NextResponse.json({ transfer })
  } catch (error: any) {
    if (error?.message?.startsWith('NOT_FOUND:')) return NextResponse.json({ error: error.message.slice(9) }, { status: 404 })
    if (error?.message?.startsWith('CONFLICT:')) return NextResponse.json({ error: error.message.slice(9) }, { status: 409 })
    console.error('[TRANSFER_RECEIVE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
