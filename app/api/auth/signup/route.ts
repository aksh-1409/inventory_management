import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/email'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  warehouseId: z.string().min(1, 'Please select a warehouse'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateCheck = checkRateLimit(`signup:${ip}`)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)} minute(s).` },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validate
    const result = signupSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, password, warehouseId } = result.data
    const email = normalizeEmail(result.data.email)

    // Validate warehouse exists
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json({ error: 'Selected warehouse not found' }, { status: 400 })
    }

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'This email is already registered. Please log in.' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user unverified (default role: OPERATOR)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        passwordSetAt: new Date(),
        role: 'OPERATOR',
        warehouseId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      message: 'Account created. You can now sign in.',
      user,
    }, { status: 201 })
  } catch (error) {
    console.error('[SIGNUP_ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
