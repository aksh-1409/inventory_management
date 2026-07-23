import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parsePagination, parseSearch } from '@/lib/pagination'
import SuppliersClient from './SuppliersClient'

export default async function SuppliersPage(props: { searchParams?: Promise<{ q?: string; page?: string; pageSize?: string; showDeleted?: string }> }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const searchParams = new URLSearchParams()
  const sp = await props.searchParams
  if (sp?.q) searchParams.set('q', sp.q)
  if (sp?.page) searchParams.set('page', sp.page)
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize)
  if (sp?.showDeleted) searchParams.set('showDeleted', sp.showDeleted)

  const q = parseSearch(searchParams)
  const { page, pageSize, skip, take } = parsePagination(searchParams)
  const showDeleted = sp?.showDeleted === '1'

  const where = {
    ...(showDeleted ? {} : { deletedAt: null }),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { contactName: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [rawSuppliers, total] = await Promise.all([
    prisma.supplier.findMany({ skip, take, where, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ])

  const suppliers = rawSuppliers.map((s) => ({
    id: s.id, name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, deletedAt: s.deletedAt?.toISOString() ?? null, createdAt: s.createdAt.toISOString(),
  }))

  return <SuppliersClient initialSuppliers={suppliers} total={total} page={page} pageSize={pageSize} userRole={session.user.role} showDeleted={showDeleted} />
}
