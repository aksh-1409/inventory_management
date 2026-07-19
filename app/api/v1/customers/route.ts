import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
})

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { user } = authResult

    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ customers })
  } catch (error) {
    console.error('[CUSTOMERS_GET_ERROR]', error)
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

    const body = await req.json()
    const result = customerSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    // Check duplicate phone
    const existing = await prisma.customer.findUnique({ where: { phone: result.data.phone } })
    if (existing) {
      return NextResponse.json({ error: 'A customer with this phone already exists.' }, { status: 409 })
    }

    const data = { ...result.data, email: result.data.email || null }
    const customer = await prisma.customer.create({ data })

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    console.error('[CUSTOMERS_POST_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
