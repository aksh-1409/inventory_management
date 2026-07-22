import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { productSchema } from '@/lib/schemas'
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const cursorMode = searchParams.has('cursor')

    const where = {
      deletedAt: null,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { sku: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    if (cursorMode) {
      const { cursor, take } = parseCursor(searchParams)
      const totalCount = await prisma.product.count({ where })
      const raw = await prisma.product.findMany({
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: {
          inventoryItems: {
            include: { warehouse: true },
          },
        },
      })
      const serialized = raw.map((p) => ({
        ...p,
        price: Number(p.price),
        costPrice: p.costPrice ? Number(p.costPrice) : null,
        inventoryItems: p.inventoryItems.map((item) => ({
          ...item,
          warehouse: { id: item.warehouse.id, name: item.warehouse.name },
        })),
      }))
      const { data, nextCursor, hasMore } = buildCursorResponse(serialized, take, totalCount)
      return NextResponse.json({ products: data, nextCursor, totalCount, hasMore })
    }

    const { page, pageSize, skip, take } = parsePagination(searchParams)

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take,
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: {
          inventoryItems: {
            include: { warehouse: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    const serialized = products.map((p) => ({
      ...p,
      price: Number(p.price),
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      inventoryItems: p.inventoryItems.map((item) => ({
        ...item,
        warehouse: { id: item.warehouse.id, name: item.warehouse.name },
      })),
    }))

    return NextResponse.json({ products: serialized, total, page, pageSize })
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
    if (!hasScope(user, 'products:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
