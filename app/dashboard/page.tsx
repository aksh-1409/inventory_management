import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

async function getData(warehouseId: string | null) {
  const isAdmin = !warehouseId

  const [products, warehouses, inventoryItems, pendingTransfers, recentTransactions] = await Promise.all([
    prisma.product.findMany({
      where: warehouseId
        ? { deletedAt: null, inventoryItems: { some: { warehouseId } } }
        : { deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: warehouseId ? { id: warehouseId } : {},
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryItem.findMany({
      where: warehouseId ? { warehouseId } : {},
      include: { product: true, warehouse: true },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.transfer.findMany({
      where: {
        status: { in: ['REQUESTED', 'PENDING', 'IN_TRANSIT'] },
        ...(warehouseId ? { OR: [{ toWarehouseId: warehouseId }, { fromWarehouseId: warehouseId }] } : {}),
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.inventoryTransaction.findMany({
      where: warehouseId ? { inventoryItem: { warehouseId } } : {},
      include: {
        inventoryItem: {
          include: { product: true, warehouse: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  // Build matrix data
  const matrix: Record<string, Record<string, { quantity: number; reorderPoint: number }>> = {}
  for (const item of inventoryItems) {
    if (!item.product.deletedAt) {
      if (!matrix[item.productId]) matrix[item.productId] = {}
      matrix[item.productId][item.warehouseId] = {
        quantity: item.quantity,
        reorderPoint: item.product.reorderPoint,
      }
    }
  }

  // Stats
  const totalProducts = products.length
  const totalWarehouses = warehouses.length
  const lowStockCount = inventoryItems.filter(
    (i) => !i.product.deletedAt && i.quantity <= i.product.reorderPoint
  ).length
  const pendingCount = pendingTransfers.length

  return {
    stats: { totalProducts, totalWarehouses: (await prisma.warehouse.findMany()).length, lowStockCount, pendingCount },
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, reorderPoint: p.reorderPoint })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
    matrix,
    pendingTransfers: pendingTransfers.map((t) => ({
      id: t.id,
      quantityInitiated: t.quantityInitiated,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      product: { name: t.product.name, sku: t.product.sku },
      fromWarehouse: { name: t.fromWarehouse.name },
      toWarehouse: { name: t.toWarehouse.name },
    })),
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      delta: t.delta,
      reference: t.reference,
      createdAt: t.createdAt.toISOString(),
      product: { name: t.inventoryItem.product.name },
      warehouse: { name: t.inventoryItem.warehouse.name },
    })),
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const data = await getData(session.user.warehouseId)

  return (
    <DashboardClient
      stats={data.stats}
      products={data.products}
      warehouses={data.warehouses}
      matrix={data.matrix}
      pendingTransfers={data.pendingTransfers}
      recentTransactions={data.recentTransactions}
      userName={session.user.name || 'User'}
      userRole={session.user.role}
      userWarehouseId={session.user.warehouseId}
    />
  )
}
