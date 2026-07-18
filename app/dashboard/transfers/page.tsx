import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TransfersClient from './TransfersClient'

async function getData() {
  const [transfers, products, warehouses] = await Promise.all([
    prisma.transfer.findMany({
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
    prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
  ])

  return {
    transfers: transfers.map((t) => ({
      id: t.id,
      quantityInitiated: t.quantityInitiated,
      quantityReceived: t.quantityReceived,
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

  const data = await getData()

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
