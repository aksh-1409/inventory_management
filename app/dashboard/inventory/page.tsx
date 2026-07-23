import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination';
import InventoryClient from './InventoryClient';

export default async function InventoryPage(props: {
  searchParams?: Promise<{
    q?: string;
    cursor?: string;
    take?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  const searchParams = new URLSearchParams();
  const sp = await props.searchParams;
  if (sp?.q) searchParams.set('q', sp.q);
  if (sp?.cursor) searchParams.set('cursor', sp.cursor);
  if (sp?.take) searchParams.set('take', sp.take);
  if (sp?.page) searchParams.set('page', sp.page);
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize);

  const q = parseSearch(searchParams);
  const cursorMode = sp?.cursor || sp?.take;

  const where: Prisma.InventoryItemWhereInput = { product: { deletedAt: null } };
  if (session.user.warehouseId) {
    where.warehouseId = session.user.warehouseId;
  }
  if (q) {
    where.OR = [
      { product: { name: { contains: q, mode: 'insensitive' as const } } },
      { product: { sku: { contains: q, mode: 'insensitive' as const } } },
      { warehouse: { name: { contains: q, mode: 'insensitive' as const } } },
    ];
  }

  async function fetchItems(skipVal?: number, takeVal?: number, cursorVal?: string) {
    return prisma.inventoryItem.findMany({
      ...(cursorVal
        ? { take: takeVal! + 1, cursor: { id: cursorVal }, skip: 1 }
        : { skip: skipVal, take: takeVal }),
      where,
      include: {
        product: true,
        warehouse: true,
        transactions: { where: { type: 'DAMAGE' }, select: { delta: true } },
      },
      orderBy: cursorVal
        ? [{ product: { name: 'asc' } }, { id: 'asc' }]
        : { product: { name: 'asc' } },
    });
  }

  if (cursorMode) {
    const { cursor, take } = parseCursor(searchParams);
    const totalCount = await prisma.inventoryItem.count({ where });
    const rawItems = await fetchItems(undefined, take, cursor);
    const items = rawItems.map((item) => ({
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
      warehouse: { id: item.warehouse.id, name: item.warehouse.name },
    }));
    const { data, nextCursor, hasMore } = buildCursorResponse(items, take, totalCount);
    return (
      <InventoryClient
        initialItems={data}
        totalCount={totalCount}
        nextCursor={nextCursor}
        hasMore={hasMore}
        userRole={session.user.role}
      />
    );
  }

  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const [rawItems, total] = await Promise.all([
    fetchItems(skip, take),
    prisma.inventoryItem.count({ where }),
  ]);

  const items = rawItems.map((item) => ({
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
  }));

  return (
    <InventoryClient
      initialItems={items}
      total={total}
      page={page}
      pageSize={pageSize}
      userRole={session.user.role}
    />
  );
}
