import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    if (existing.status !== 'IN_TRANSIT') {
      return NextResponse.json({ error: `Cannot receive transfer in ${existing.status} status` }, { status: 409 })
    }

    const totalAccounted = quantityReceived + damagedQuantity
    if (totalAccounted > existing.quantityInitiated) {
      return NextResponse.json(
        { error: `Total received (${totalAccounted}) exceeds initiated quantity (${existing.quantityInitiated})` },
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

    // Atomic: receive good stock + update transfer + create transaction
    const [transfer, updatedDest, transaction] = await prisma.$transaction([
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
        data: { quantity: { increment: goodQuantity } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: destInventory.id,
          type: 'TRANSFER_IN',
          delta: goodQuantity,
          reference: `Transfer received${damagedQuantity > 0 ? ` (${damagedQuantity} damaged)` : ''}`,
          userId: session.user.id,
        },
      }),
    ])

    return NextResponse.json({ transfer })
  } catch (error) {
    console.error('[TRANSFER_RECEIVE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
