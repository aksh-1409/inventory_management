import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ReceivingClient from './ReceivingClient'

async function getData(warehouseId: string | null) {
  const txWhere: any = { type: 'IN' }
  if (warehouseId) {
    txWhere.inventoryItem = { warehouseId }
  }

  const [transactions, products, warehouses, suppliers] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: txWhere,
      include: {
        inventoryItem: {
          include: { product: true, warehouse: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
  ])

  return {
    receipts: transactions.map((t) => ({
      id: t.id,
      delta: t.delta,
      reference: t.reference,
      createdAt: t.createdAt.toISOString(),
      product: { id: t.inventoryItem.product.id, name: t.inventoryItem.product.name, sku: t.inventoryItem.product.sku },
      warehouse: { id: t.inventoryItem.warehouse.id, name: t.inventoryItem.warehouse.name },
    })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
  }
}

export default async function ReceivingPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const data = await getData(session.user.warehouseId)

  return (
    <ReceivingClient
      initialReceipts={data.receipts}
      products={data.products}
      warehouses={data.warehouses}
      suppliers={data.suppliers}
      userRole={session.user.role}
    />
  )
}
