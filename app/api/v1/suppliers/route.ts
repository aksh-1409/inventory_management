import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasScope } from '@/lib/api-auth'
import { supplierSchema } from '@/lib/schemas'
import { parsePagination, parseSearch } from '@/lib/pagination'
import { auditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = parseSearch(searchParams)
    const { page, pageSize, skip, take } = parsePagination(searchParams)

    const where = {
      deletedAt: null,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { contactName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ skip, take, where, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      prisma.supplier.count({ where }),
    ])

    return NextResponse.json({ suppliers, total, page, pageSize })
  } catch (error) {
    console.error('[SUPPLIERS_GET_ERROR]', error)
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
    if (!hasScope(user, 'suppliers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = supplierSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const data = { ...result.data, email: result.data.email || null }
    const supplier = await prisma.supplier.create({ data })
    await auditLog(user.id, 'Supplier', supplier.id, 'CREATE', { after: supplier })

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    console.error('[SUPPLIERS_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
