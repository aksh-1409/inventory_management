import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { parsePagination, parseSearch } from '@/lib/pagination';
import ReceivingClient from './ReceivingClient';

export default async function ReceivingPage(props: {
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
  const { skip, take } = parsePagination(searchParams);

  const inventoryItemWhere: Record<string, unknown> = {};
  if (session.user.warehouseId) {
    inventoryItemWhere.warehouseId = session.user.warehouseId;
  }
  if (q) {
    inventoryItemWhere.OR = [
      { product: { name: { contains: q, mode: 'insensitive' as const } } },
      { product: { sku: { contains: q, mode: 'insensitive' as const } } },
      { warehouse: { name: { contains: q, mode: 'insensitive' as const } } },
    ];
  }
  const txWhere: Prisma.InventoryTransactionWhereInput = {
    type: 'IN',
    ...(Object.keys(inventoryItemWhere).length
      ? { inventoryItem: inventoryItemWhere as Prisma.InventoryItemWhereInput }
      : {}),
  };

  const [transactions, total, products, warehouses, suppliers] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      skip,
      take,
      where: txWhere,
      include: { inventoryItem: { include: { product: true, warehouse: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryTransaction.count({ where: txWhere }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const receipts = transactions.map((t) => ({
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
    <ReceivingClient
      initialReceipts={receipts}
      totalNumber={total}
      products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
