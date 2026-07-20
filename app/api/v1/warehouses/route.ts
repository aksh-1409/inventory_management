import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { z } from 'zod'

const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const take = Math.min(Number(searchParams.get('take')) || 100, 500)
    const skip = Number(searchParams.get('skip')) || 0

    const warehouses = await prisma.warehouse.findMany({
      take,
      skip,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    })

    return NextResponse.json({ warehouses })
  } catch (error) {
    console.error('[WAREHOUSES_GET_ERROR]', error)
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
    if (!hasScope(user, 'warehouses:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = warehouseSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.create({ data: result.data })

    return NextResponse.json({ warehouse }, { status: 201 })
  } catch (error) {
    console.error('[WAREHOUSES_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
