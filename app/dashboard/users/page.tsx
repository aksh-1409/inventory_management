import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const users = await prisma.user.findMany({
    include: { warehouse: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    warehouse: u.warehouse ? { id: u.warehouse.id, name: u.warehouse.name } : null,
    createdAt: u.createdAt.toISOString(),
  }))

  return <UsersClient initialUsers={data} currentUserId={session.user.id} />
}
