import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  costPrice: z.number().positive().optional(),
  reorderPoint: z.number().int().min(0).default(5),
  category: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        inventoryItems: {
          include: { warehouse: true },
        },
      },
    })

    const serialized = products.map((p) => ({
      ...p,
      price: Number(p.price),
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      inventoryItems: p.inventoryItems.map((item) => ({
        ...item,
        warehouse: { id: item.warehouse.id, name: item.warehouse.name },
      })),
    }))

    return NextResponse.json({ products: serialized })
  } catch (error) {
    console.error('[PRODUCTS_GET_ERROR]', error)
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
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const result = productSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    // Check for duplicate SKU
    const existing = await prisma.product.findUnique({ where: { sku: result.data.sku } })
    if (existing) {
      return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 })
    }

    const product = await prisma.product.create({ data: result.data })

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        costPrice: product.costPrice ? Number(product.costPrice) : null,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[PRODUCTS_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
