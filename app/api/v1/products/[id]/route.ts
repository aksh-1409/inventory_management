import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { productUpdateSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit'

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
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventoryItems: {
          include: { warehouse: true },
        },
      },
    })

    if (!product || product.deletedAt) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        costPrice: product.costPrice ? Number(product.costPrice) : null,
        inventoryItems: product.inventoryItems.map((item) => ({
          ...item,
          warehouse: { id: item.warehouse.id, name: item.warehouse.name },
        })),
      },
    })
  } catch (error) {
    console.error('[PRODUCT_GET_ERROR]', error)
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
    if (!hasScope(user, 'products:write') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const result = productUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check SKU uniqueness if changing
    if (result.data.sku && result.data.sku !== existing.sku) {
      const skuTaken = await prisma.product.findUnique({ where: { sku: result.data.sku } })
      if (skuTaken) {
        return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 })
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: result.data,
    })
    await auditLog(user.id, 'Product', id, 'UPDATE', { before: existing, after: product })

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        costPrice: product.costPrice ? Number(product.costPrice) : null,
      },
    })
  } catch (error) {
    console.error('[PRODUCT_PATCH_ERROR]', error)
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
    if (!hasScope(user, 'products:write') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await auditLog(user.id, 'Product', id, 'DELETE')

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('[PRODUCT_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
