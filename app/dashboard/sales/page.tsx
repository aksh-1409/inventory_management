import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SalesClient from './SalesClient'

async function getData() {
  const [transactions, products, warehouses, customers] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: { type: 'OUT' },
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
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
  ])

  return {
    sales: transactions.map((t) => ({
      id: t.id,
      delta: t.delta,
      reference: t.reference,
      createdAt: t.createdAt.toISOString(),
      product: { id: t.inventoryItem.product.id, name: t.inventoryItem.product.name, sku: t.inventoryItem.product.sku },
      warehouse: { id: t.inventoryItem.warehouse.id, name: t.inventoryItem.warehouse.name },
    })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: Number(p.price) })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
  }
}

export default async function SalesPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const data = await getData()

  return (
    <SalesClient
      initialSales={data.sales}
      products={data.products}
      warehouses={data.warehouses}
      customers={data.customers}
      userRole={session.user.role}
    />
  )
}
