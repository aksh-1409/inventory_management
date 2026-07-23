import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { parsePagination, parseSearch } from '@/lib/pagination';
import SalesClient from './SalesClient';

export default async function SalesPage(props: {
  searchParams?: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  const searchParams = new URLSearchParams();
  const sp = await props.searchParams;
  if (sp?.q) searchParams.set('q', sp.q);
  if (sp?.page) searchParams.set('page', sp.page);
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize);

  const q = parseSearch(searchParams);
  const { page, pageSize, skip, take } = parsePagination(searchParams);

  const where: Prisma.InventoryTransactionWhereInput = { type: 'OUT' };
  if (q) {
    where.inventoryItem = {
      OR: [
        { product: { name: { contains: q, mode: 'insensitive' as const } } },
        { product: { sku: { contains: q, mode: 'insensitive' as const } } },
        { warehouse: { name: { contains: q, mode: 'insensitive' as const } } },
      ],
    };
  }

  const [transactions, total, products, warehouses, customers] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      skip,
      take,
      where,
      include: { inventoryItem: { include: { product: true, warehouse: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryTransaction.count({ where }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const sales = transactions.map((t) => ({
    id: t.id,
    delta: t.delta,
    reference: t.reference,
    createdAt: t.createdAt.toISOString(),
    product: {
      id: t.inventoryItem.product.id,
      name: t.inventoryItem.product.name,
      sku: t.inventoryItem.product.sku,
    },
    warehouse: { id: t.inventoryItem.warehouse.id, name: t.inventoryItem.warehouse.name },
  }));

  return (
    <SalesClient
      initialSales={sales}
      total={total}
      page={page}
      pageSize={pageSize}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
      }))}
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      allCustomers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
    />
  );
}
