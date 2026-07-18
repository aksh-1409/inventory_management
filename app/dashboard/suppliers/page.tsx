import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SuppliersClient from './SuppliersClient'

async function getSuppliers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    createdAt: s.createdAt.toISOString(),
  }))
}

export default async function SuppliersPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const suppliers = await getSuppliers()

  return <SuppliersClient initialSuppliers={suppliers} userRole={session.user.role} />
}
