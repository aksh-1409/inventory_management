import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TransfersClient from './TransfersClient'

async function getData(userRole: string, userWarehouseId: string | null) {
  const isAdmin = userRole === 'ADMIN'

  const whereFilter = isAdmin || !userWarehouseId ? {} : {
    OR: [
      { fromWarehouseId: userWarehouseId! },
      { toWarehouseId: userWarehouseId! },
      { status: 'REQUESTED' as const },
    ],
  }

  const [transfers, products, warehouses] = await Promise.all([
    prisma.transfer.findMany({
      where: whereFilter,
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    }),
  ])

  // Fetch damage counts for completed transfers
  const completedTransferIds = transfers.filter(t => t.status === 'COMPLETED').map(t => t.id)
  const damageTxns = completedTransferIds.length > 0 ? await prisma.inventoryTransaction.findMany({
    where: {
      type: 'DAMAGE',
      reference: { contains: 'Damaged in transfer' },
    },
    include: { inventoryItem: { select: { warehouseId: true, productId: true } } },
  }) : []

  const damageMap = new Map<string, number>()
  for (const tx of damageTxns) {
    if (!tx.reference) continue
    const match = tx.reference.match(/Damaged in transfer (.+)/)
    if (match) {
      damageMap.set(match[1], Math.abs(tx.delta))
    }
  }

  return {
    transfers: transfers.map((t) => ({
      id: t.id,
      quantityInitiated: t.quantityInitiated,
      quantityReceived: t.quantityReceived,
      damagedQuantity: damageMap.get(t.id) || 0,
      status: t.status,
      trackingNumber: t.trackingNumber,
      notes: t.notes,
      shippedAt: t.shippedAt?.toISOString() || null,
      receivedAt: t.receivedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      product: { id: t.product.id, name: t.product.name, sku: t.product.sku },
      fromWarehouse: { id: t.fromWarehouse.id, name: t.fromWarehouse.name },
      toWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
      initiatedBy: t.initiatedBy ? { name: t.initiatedBy.name } : null,
    })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
  }
}

export default async function TransfersPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const data = await getData(session.user.role, session.user.warehouseId)

  return (
    <TransfersClient
      initialTransfers={data.transfers}
      products={data.products}
      warehouses={data.warehouses}
      userRole={session.user.role}
      userWarehouseId={session.user.warehouseId}
    />
  )
}
