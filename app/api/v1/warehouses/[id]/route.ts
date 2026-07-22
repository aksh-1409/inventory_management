import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { warehouseUpdateSchema } from '@/lib/schemas'

export async function GET(
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
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    })

    if (!warehouse || warehouse.deletedAt) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('[WAREHOUSE_GET_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult
    if (!hasScope(user, 'warehouses:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const result = warehouseUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: result.data,
    })

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('[WAREHOUSE_PATCH_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult
    if (!hasScope(user, 'warehouses:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Check if warehouse has inventory
    const inventoryCount = await prisma.inventoryItem.count({ where: { warehouseId: id } })
    if (inventoryCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete warehouse with existing inventory. Transfer stock first.' },
        { status: 409 }
      )
    }

    await prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date() } })

    return NextResponse.json({ message: 'Warehouse deleted' })
  } catch (error) {
    console.error('[WAREHOUSE_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
