import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination';
import ProductsClient from './ProductsClient';

export default async function ProductsPage(props: {
  searchParams?: Promise<{
    q?: string;
    cursor?: string;
    take?: string;
    page?: string;
    pageSize?: string;
    showDeleted?: string;
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
  if (sp?.showDeleted) searchParams.set('showDeleted', sp.showDeleted);

  const q = parseSearch(searchParams);
  const showDeleted = sp?.showDeleted === '1';
  const cursorMode = sp?.cursor || sp?.take;

  const where = {
    ...(showDeleted ? {} : { deletedAt: null }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { sku: { contains: q, mode: 'insensitive' as const } },
            { category: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  const warehousesList = warehouses.map((w) => ({ id: w.id, name: w.name }));

  if (cursorMode) {
    const { cursor, take } = parseCursor(searchParams);
    const totalCount = await prisma.product.count({ where });
    const raw = await prisma.product.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { inventoryItems: { include: { warehouse: true } } },
    });
    const serialized = raw.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      reorderPoint: p.reorderPoint,
      category: p.category,
      deletedAt: p.deletedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      inventoryItems: p.inventoryItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        warehouse: { id: item.warehouse.id, name: item.warehouse.name },
      })),
    }));
    const { data, nextCursor, hasMore } = buildCursorResponse(serialized, take, totalCount);
    return (
      <ProductsClient
        initialProducts={data}
        totalCount={totalCount}
        nextCursor={nextCursor}
        hasMore={hasMore}
        warehouses={warehousesList}
        userRole={session.user.role}
        showDeleted={showDeleted}
      />
    );
  }

  const { page, pageSize, skip, take } = parsePagination(searchParams, { page: 1, pageSize: 50 });

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      skip,
      take,
      where,
      orderBy: { name: 'asc' },
      include: { inventoryItems: { include: { warehouse: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  const products = rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    reorderPoint: p.reorderPoint,
    category: p.category,
    deletedAt: p.deletedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    inventoryItems: p.inventoryItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      warehouse: { id: item.warehouse.id, name: item.warehouse.name },
    })),
  }));

  return (
    <ProductsClient
      initialProducts={products}
      total={total}
      page={page}
      pageSize={pageSize}
      warehouses={warehousesList}
      userRole={session.user.role}
      showDeleted={showDeleted}
    />
  );
}
