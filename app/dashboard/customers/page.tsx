import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CustomersClient from './CustomersClient'

async function getCustomers() {
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } })
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: c.createdAt.toISOString(),
  }))
}

export default async function CustomersPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const customers = await getCustomers()

  return <CustomersClient initialCustomers={customers} userRole={session.user.role} />
}
