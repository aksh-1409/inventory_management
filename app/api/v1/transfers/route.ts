import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { z } from 'zod'

const requestSchema = z.object({
  productId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const transfers = await prisma.transfer.findMany({
      ...(user.role === 'OPERATOR' && user.warehouseId
        ? {
            where: {
              OR: [
                { fromWarehouseId: user.warehouseId },
                { toWarehouseId: user.warehouseId },
                { status: 'REQUESTED' as const },
              ],
            },
          }
        : {}),
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ transfers })
  } catch (error) {
    console.error('[TRANSFERS_GET_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    if (!hasScope(user, 'transfers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    console.log('[TRANSFER_POST_BODY]', JSON.stringify(body))
    const result = requestSchema.safeParse(body)
    if (!result.success) {
      console.log('[TRANSFER_POST_ERROR]', JSON.stringify(result.error.issues))
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, toWarehouseId, quantity, notes } = result.data

    // Operators can only request to their own warehouse
    if (user.role === 'OPERATOR' && user.warehouseId !== toWarehouseId) {
      return NextResponse.json({ error: 'You can only request transfers to your assigned warehouse' }, { status: 403 })
    }

    // Create a transfer REQUEST — no source warehouse yet
    const transfer = await prisma.transfer.create({
      data: {
        productId,
        toWarehouseId,
        quantityInitiated: quantity,
        status: 'REQUESTED',
        initiatedById: user.id,
        notes: notes || null,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    })

    return NextResponse.json({ transfer }, { status: 201 })
  } catch (error) {
    console.error('[TRANSFER_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
