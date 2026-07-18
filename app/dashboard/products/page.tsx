import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProductsClient from './ProductsClient'

async function getProducts() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      inventoryItems: {
        include: { warehouse: true },
      },
    },
  })

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    reorderPoint: p.reorderPoint,
    category: p.category,
    createdAt: p.createdAt.toISOString(),
    inventoryItems: p.inventoryItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      warehouse: { id: item.warehouse.id, name: item.warehouse.name },
    })),
  }))
}

async function getWarehouses() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: 'asc' } })
  return warehouses.map((w) => ({ id: w.id, name: w.name }))
}

export default async function ProductsPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const [products, warehouses] = await Promise.all([getProducts(), getWarehouses()])

  return (
    <ProductsClient
      initialProducts={products}
      warehouses={warehouses}
      userRole={session.user.role}
    />
  )
}
