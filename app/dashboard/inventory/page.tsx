import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InventoryClient from './InventoryClient'

async function getInventory(warehouseId: string | null) {
  const where: any = { product: { deletedAt: null } }
  if (warehouseId) {
    where.warehouseId = warehouseId
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      product: true,
      warehouse: true,
      transactions: {
        where: { type: 'DAMAGE' },
        select: { delta: true },
      },
    },
    orderBy: { product: { name: 'asc' } },
  })

  return items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    damaged: Math.abs(item.transactions.reduce((sum, t) => sum + t.delta, 0)),
    productId: item.productId,
    warehouseId: item.warehouseId,
    product: {
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      reorderPoint: item.product.reorderPoint,
    },
    warehouse: {
      id: item.warehouse.id,
      name: item.warehouse.name,
    },
  }))
}

export default async function InventoryPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const items = await getInventory(session.user.warehouseId)

  return (
    <InventoryClient
      initialItems={items}
      userRole={session.user.role}
    />
  )
}
