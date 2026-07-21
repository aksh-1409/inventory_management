import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request) {
  const session = await auth()

  const userId = (session as any)?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, warehouseId } = await req.json()
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
  if (!warehouse) {
    return NextResponse.json({ error: 'Warehouse not found' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name, warehouseId },
  })

  return NextResponse.json({ success: true })
}
