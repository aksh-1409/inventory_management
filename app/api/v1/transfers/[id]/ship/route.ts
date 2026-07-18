import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const shipSchema = z.object({
  trackingNumber: z.string().optional(),
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
    const result = shipSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.transfer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: `Cannot ship transfer in ${existing.status} status` }, { status: 409 })
    }

    const transfer = await prisma.transfer.update({
      where: { id },
      data: {
        status: 'IN_TRANSIT',
        shippedAt: new Date(),
        trackingNumber: result.data.trackingNumber || existing.trackingNumber,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    })

    return NextResponse.json({ transfer })
  } catch (error) {
    console.error('[TRANSFER_SHIP_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
