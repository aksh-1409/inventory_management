import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parsePagination, parseCursor, parseSearch, buildCursorResponse } from '@/lib/pagination'
import TransfersClient from './TransfersClient'

export default async function TransfersPage(props: { searchParams?: Promise<{ q?: string; cursor?: string; take?: string; page?: string; pageSize?: string }> }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const searchParams = new URLSearchParams()
  const sp = await props.searchParams
  if (sp?.q) searchParams.set('q', sp.q)
  if (sp?.cursor) searchParams.set('cursor', sp.cursor)
  if (sp?.take) searchParams.set('take', sp.take)
  if (sp?.page) searchParams.set('page', sp.page)
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize)

  const q = parseSearch(searchParams)
  const cursorMode = sp?.cursor || sp?.take

  const isAdmin = session.user.role === 'ADMIN'
  const baseWhere = isAdmin || !session.user.warehouseId ? {} : {
    OR: [
      { fromWarehouseId: session.user.warehouseId! },
      { toWarehouseId: session.user.warehouseId! },
      { status: 'REQUESTED' as const },
    ],
  }

  const searchWhere = q ? {
    AND: [
      {
        OR: [
          { product: { name: { contains: q, mode: 'insensitive' as const } } },
          { product: { sku: { contains: q, mode: 'insensitive' as const } } },
          { fromWarehouse: { name: { contains: q, mode: 'insensitive' as const } } },
          { toWarehouse: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      },
    ],
  } : {}

  const where = { product: { deletedAt: null }, ...baseWhere, ...searchWhere }

  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
  ])

  const productRefs = products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))
  const warehouseRefs = warehouses.map((w) => ({ id: w.id, name: w.name }))

  if (cursorMode) {
    const { cursor, take } = parseCursor(searchParams, { take: 200 })
    const totalCount = await prisma.transfer.count({ where })
    const raw = await prisma.transfer.findMany({
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where,
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    })
    const { data, nextCursor, hasMore } = buildCursorResponse(raw, take, totalCount)
    const serialized = data.map((t) => ({
      id: t.id,
      quantityInitiated: t.quantityInitiated,
      quantityReceived: t.quantityReceived,
      damagedQuantity: 0,
      status: t.status,
      trackingNumber: t.trackingNumber,
      notes: t.notes,
      shippedAt: t.shippedAt?.toISOString() || null,
      receivedAt: t.receivedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      product: { id: t.product.id, name: t.product.name, sku: t.product.sku },
      fromWarehouse: t.fromWarehouse ? { id: t.fromWarehouse.id, name: t.fromWarehouse.name } : null,
      toWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
      initiatedBy: t.initiatedBy ? { name: t.initiatedBy.name } : null,
    }))
    return (
      <TransfersClient
        initialTransfers={serialized}
        totalCount={totalCount}
        nextCursor={nextCursor}
        hasMore={hasMore}
        products={productRefs}
        warehouses={warehouseRefs}
        userRole={session.user.role}
        userWarehouseId={session.user.warehouseId}
      />
    )
  }

  const { page, pageSize, skip, take } = parsePagination(searchParams)

  const [transfers, total] = await Promise.all([
    prisma.transfer.findMany({
      skip, take, where,
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transfer.count({ where }),
  ])

  const completedTransferIds = transfers.filter(t => t.status === 'COMPLETED').map(t => t.id)
  const damageTxns = completedTransferIds.length > 0 ? await prisma.inventoryTransaction.findMany({
    where: { type: 'DAMAGE', reference: { contains: 'Damaged in transfer' } },
    include: { inventoryItem: { select: { warehouseId: true, productId: true } } },
  }) : []

  const damageMap = new Map<string, number>()
  for (const tx of damageTxns) {
    if (!tx.reference) continue
    const match = tx.reference.match(/Damaged in transfer (.+)/)
    if (match) damageMap.set(match[1], Math.abs(tx.delta))
  }

  const data = transfers.map((t) => ({
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
    fromWarehouse: t.fromWarehouse ? { id: t.fromWarehouse.id, name: t.fromWarehouse.name } : null,
    toWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
    initiatedBy: t.initiatedBy ? { name: t.initiatedBy.name } : null,
  }))

  return (
    <TransfersClient
      initialTransfers={data}
      total={total}
      page={page}
      pageSize={pageSize}
      products={productRefs}
      warehouses={warehouseRefs}
      userRole={session.user.role}
      userWarehouseId={session.user.warehouseId}
    />
  )
}
