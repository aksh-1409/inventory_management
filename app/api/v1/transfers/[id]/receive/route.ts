import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

const receiveSchema = z.object({
  quantityReceived: z.number().int().positive(),
  damagedQuantity: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})

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

    const { id } = await ctx.params
    const body = await req.json()
    const result = receiveSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { quantityReceived, damagedQuantity = 0, notes } = result.data

    const existing = await prisma.transfer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Only destination warehouse (or admin) can receive
    if (user.role === 'OPERATOR' && user.warehouseId !== existing.toWarehouseId) {
      return NextResponse.json({ error: 'Only the destination warehouse can receive this transfer' }, { status: 403 })
    }

    if (existing.status !== 'IN_TRANSIT') {
      return NextResponse.json({ error: `Cannot receive transfer in ${existing.status} status` }, { status: 409 })
    }

    if (quantityReceived > existing.quantityInitiated) {
      return NextResponse.json(
        { error: `Received quantity (${quantityReceived}) exceeds initiated quantity (${existing.quantityInitiated})` },
        { status: 400 }
      )
    }

    if (damagedQuantity > quantityReceived) {
      return NextResponse.json(
        { error: `Damaged quantity (${damagedQuantity}) cannot exceed received quantity (${quantityReceived})` },
        { status: 400 }
      )
    }

    const goodQuantity = quantityReceived - damagedQuantity

    // Find or create destination inventory
    const destInventory = await prisma.inventoryItem.upsert({
      where: {
        productId_warehouseId: {
          productId: existing.productId,
          warehouseId: existing.toWarehouseId,
        },
      },
      create: {
        productId: existing.productId,
        warehouseId: existing.toWarehouseId,
        quantity: 0,
      },
      update: {},
    })

    // Atomic: receive good stock + update transfer + create transactions
    const txOps: any[] = [
      prisma.transfer.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          quantityReceived,
          receivedAt: new Date(),
          notes: notes || existing.notes,
        },
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: destInventory.id },
        data: { quantity: { increment: quantityReceived } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: destInventory.id,
          type: 'TRANSFER_IN',
          delta: quantityReceived,
          reference: `Transfer received${damagedQuantity > 0 ? ` (${damagedQuantity} damaged)` : ''}`,
          userId: user.id,
        },
      }),
    ]

    // Write off damaged items: decrement from destination + log
    if (damagedQuantity > 0) {
      txOps.push(
        prisma.inventoryItem.update({
          where: { id: destInventory.id },
          data: { quantity: { decrement: damagedQuantity } },
        }),
        prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: destInventory.id,
            type: 'DAMAGE',
            delta: -damagedQuantity,
            reference: `Damaged in transfer ${id}`,
            userId: user.id,
          },
        }),
      )
    }

    const [transfer, ...rest] = await prisma.$transaction(txOps)

    return NextResponse.json({ transfer })
  } catch (error) {
    console.error('[TRANSFER_RECEIVE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
