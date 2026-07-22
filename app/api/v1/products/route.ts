import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { productSchema } from '@/lib/schemas'
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination'
import { auditLog } from '@/lib/audit'
import { csvStream, formatCurrency } from '@/lib/export'
import { generateListPdf } from '@/lib/export-pdf'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const cursorMode = searchParams.has('cursor')
    const exportType = searchParams.get('export')

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

    // Export mode: fetch all matching rows for CSV/PDF
    if (exportType) {
      const allProducts = await prisma.product.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: {
          inventoryItems: { include: { warehouse: true } },
        },
      })
      const rows = allProducts.map(p => ({
        name: p.name, sku: p.sku, category: p.category ?? '',
        price: Number(p.price), costPrice: p.costPrice ? Number(p.costPrice) : null,
        reorderPoint: p.reorderPoint, createdAt: p.createdAt.toISOString(),
      }))
      if (exportType === 'csv') {
        return csvStream([
          { key: 'name', label: 'Name' },
          { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category' },
          { key: 'price', label: 'Price', transform: (v) => formatCurrency(v) },
          { key: 'costPrice', label: 'Cost', transform: (v) => formatCurrency(v) },
          { key: 'reorderPoint', label: 'Reorder' },
          { key: 'createdAt', label: 'Created' },
        ], rows)
      }
      if (exportType === 'pdf') {
        const buf = await generateListPdf('Products Report', `Generated ${new Date().toLocaleDateString()}`, [
          { key: 'name', label: 'Name', width: '25%' },
          { key: 'sku', label: 'SKU', width: '15%' },
          { key: 'category', label: 'Category', width: '15%' },
          { key: 'price', label: 'Price', width: '15%', transform: (v: unknown) => formatCurrency(v) },
          { key: 'costPrice', label: 'Cost', width: '15%', transform: (v: unknown) => formatCurrency(v) },
          { key: 'reorderPoint', label: 'Reorder', width: '15%' },
        ], rows)
        return new NextResponse(new Uint8Array(buf), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="products.pdf"' },
        })
      }
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
    await auditLog(user.id, 'Product', product.id, 'CREATE', { after: product })

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
