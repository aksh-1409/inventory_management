import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

const acceptSchema = z.object({
  fromWarehouseId: z.string().min(1),
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
    const result = acceptSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { fromWarehouseId } = result.data

    // Operators can only accept requests where the source is their warehouse
    if (user.role === 'OPERATOR' && user.warehouseId !== fromWarehouseId) {
      return NextResponse.json({ error: 'You can only accept requests from your assigned warehouse' }, { status: 403 })
    }

    const existing = await prisma.transfer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }
    if (existing.status !== 'REQUESTED') {
      return NextResponse.json({ error: `Cannot accept transfer in ${existing.status} status` }, { status: 409 })
    }

    // Validate same warehouse
    if (fromWarehouseId === existing.toWarehouseId) {
      return NextResponse.json({ error: 'Source and destination warehouses must be different' }, { status: 400 })
    }

    // Check source warehouse has enough stock
    const sourceInventory = await prisma.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId: existing.productId, warehouseId: fromWarehouseId } },
    })

    if (!sourceInventory || sourceInventory.quantity < existing.quantityInitiated) {
      return NextResponse.json(
        { error: `Insufficient stock at source. Available: ${sourceInventory?.quantity || 0}, requested: ${existing.quantityInitiated}` },
        { status: 409 }
      )
    }

    // Atomic: update transfer + decrement source stock + create transaction
    const [transfer, updatedSource] = await prisma.$transaction([
      prisma.transfer.update({
        where: { id },
        data: {
          fromWarehouseId,
          status: 'PENDING',
        },
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: sourceInventory.id },
        data: { quantity: { decrement: existing.quantityInitiated } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: sourceInventory.id,
          type: 'TRANSFER_OUT',
          delta: -existing.quantityInitiated,
          reference: `Transfer accepted — shipping to ${existing.toWarehouseId}`,
          userId: user.id,
        },
      }),
    ])

    return NextResponse.json({ transfer })
  } catch (error) {
    console.error('[TRANSFER_ACCEPT_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
