import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { setupSchema } from '@/lib/schemas'

export async function PUT(req: Request) {
  try {
    const session = await auth()

    const user = (session as any)?.user
    const userId = user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = setupSchema.safeParse(await req.json())
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }
    const { name, warehouseId, password } = result.data

    const dbUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const role = dbUser.role
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse) {
        return NextResponse.json({ error: 'Warehouse not found' }, { status: 400 })
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Warehouse selection is required for operators.' }, { status: 400 })
    }

    if (!dbUser.passwordSetAt && !password) {
      return NextResponse.json({ error: 'Set a local password to finish account setup.' }, { status: 400 })
    }

    const passwordUpdate = !dbUser.passwordSetAt && password
      ? { passwordHash: await bcrypt.hash(password, 12), passwordSetAt: new Date(), passwordChangedAt: new Date() }
      : {}

    await prisma.user.update({
      where: { id: userId },
      data: { name, warehouseId: warehouseId || null, ...passwordUpdate },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
