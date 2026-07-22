import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parsePagination, parseSearch } from '@/lib/pagination'
import WarehousesClient from './WarehousesClient'

export default async function WarehousesPage(props: { searchParams?: Promise<{ q?: string; page?: string; pageSize?: string; showDeleted?: string }> }) {
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
        { location: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [rawWarehouses, total] = await Promise.all([
    prisma.warehouse.findMany({
      skip, take, where,
      orderBy: { name: 'asc' },
      include: { inventoryItems: { include: { product: true } } },
    }),
    prisma.warehouse.count({ where }),
  ])

  const warehouses = rawWarehouses.map((w) => ({
    id: w.id,
    name: w.name,
    location: w.location,
    deletedAt: w.deletedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    inventoryItems: w.inventoryItems
      .filter((item) => !item.product.deletedAt)
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: { id: item.product.id, name: item.product.name, sku: item.product.sku },
      })),
    totalProducts: w.inventoryItems.filter((item) => !item.product.deletedAt).length,
    totalStock: w.inventoryItems.filter((item) => !item.product.deletedAt).reduce((sum, item) => sum + item.quantity, 0),
  }))

  return <WarehousesClient initialWarehouses={warehouses} total={total} page={page} pageSize={pageSize} userRole={session.user.role} showDeleted={showDeleted} />
}
