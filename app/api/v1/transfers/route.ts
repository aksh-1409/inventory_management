import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const requestSchema = z.object({
  productId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transfers = await prisma.transfer.findMany({
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('[TRANSFER_POST_BODY]', JSON.stringify(body))
    const result = requestSchema.safeParse(body)
    if (!result.success) {
      console.log('[TRANSFER_POST_ERROR]', JSON.stringify(result.error.issues))
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { productId, toWarehouseId, quantity, notes } = result.data

    // Create a transfer REQUEST — no source warehouse yet
    const transfer = await prisma.transfer.create({
      data: {
        productId,
        fromWarehouseId: toWarehouseId, // placeholder — will be overwritten on accept
        toWarehouseId,
        quantityInitiated: quantity,
        status: 'REQUESTED',
        initiatedById: session.user.id,
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
