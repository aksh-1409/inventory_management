import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import WarehousesClient from './WarehousesClient'

async function getWarehouses() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
    include: {
      inventoryItems: {
        include: { product: true },
      },
    },
  })

  return warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    location: w.location,
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
}

export default async function WarehousesPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const warehouses = await getWarehouses()

  return (
    <WarehousesClient
      initialWarehouses={warehouses}
      userRole={session.user.role}
    />
  )
}
