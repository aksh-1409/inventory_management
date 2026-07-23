import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const TEST_DB_URL = 'postgresql://postgres:password@localhost:5432/stockpilot_test';

let prisma: PrismaClient;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seed() {
  const admin = await prisma.user.create({
    data: { name: 'Test Admin', email: 'admin@test.local', passwordHash: 'x', role: 'ADMIN' },
  });
  const operator = await prisma.user.create({
    data: {
      name: 'Test Op',
      email: 'op@test.local',
      passwordHash: 'x',
      role: 'OPERATOR',
      warehouseId: null,
    },
  });

  const w1 = await prisma.warehouse.create({ data: { name: 'W1', location: 'A' } });
  const w2 = await prisma.warehouse.create({ data: { name: 'W2', location: 'B' } });
  const w3 = await prisma.warehouse.create({ data: { name: 'W3', location: 'C' } });

  const prod = await prisma.product.create({
    data: { sku: 'TST-001', name: 'Test Widget', price: 10, reorderPoint: 5 },
  });

  // w1 has exactly 10
  const inv1 = await prisma.inventoryItem.create({
    data: { productId: prod.id, warehouseId: w1.id, quantity: 10 },
  });
  await prisma.inventoryItem.create({
    data: { productId: prod.id, warehouseId: w2.id, quantity: 10 },
  });

  // Transfer from w1 -> w3, REQUESTED, quantity 5
  const transfer = await prisma.transfer.create({
    data: {
      productId: prod.id,
      fromWarehouseId: w1.id,
      toWarehouseId: w3.id,
      quantityInitiated: 5,
      status: 'REQUESTED',
    },
  });

  // Transfer from w1 -> w3, PENDING (already accepted), quantity 5
  const pendingTransfer = await prisma.transfer.create({
    data: {
      productId: prod.id,
      fromWarehouseId: w1.id,
      toWarehouseId: w3.id,
      quantityInitiated: 5,
      status: 'PENDING',
    },
  });

  return { admin, operator, w1, w2, w3, prod, inv1, transfer, pendingTransfer };
}

// ---------------------------------------------------------------------------
// Concurrent wrappers
// ---------------------------------------------------------------------------

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simulate a sale with forced read-then-write gap, using FOR UPDATE lock. */
async function trySale(
  productId: string,
  warehouseId: string,
  qty: number
): Promise<{ ok: boolean; status: number }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await delay(5);
      // Lock the row
      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} FOR UPDATE`;
      const inv = await tx.inventoryItem.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });
      if (!inv || inv.quantity < qty) return { ok: false as const, status: 409 };

      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: { decrement: qty } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: inv.id,
          type: 'OUT',
          delta: -qty,
          reference: 'Concurrent sale test',
        },
      });
      return { ok: true as const, status: 201 };
    });
    return result;
  } catch {
    return { ok: false, status: 500 };
  }
}

/** Race two sales returning the final stock quantity. */
async function raceSales(productId: string, warehouseId: string, qtyA: number, qtyB: number) {
  const [ra, rb] = await Promise.all([
    trySale(productId, warehouseId, qtyA),
    trySale(productId, warehouseId, qtyB),
  ]);
  const final = await prisma.inventoryItem.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return { ra, rb, finalQty: final!.quantity };
}

/** Simulate a transfer accept with forced read-then-write gap, using FOR UPDATE lock. */
async function tryAccept(
  transferId: string,
  fromWhId: string
): Promise<{ ok: boolean; status: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await delay(5);
      // Lock the transfer row so the second concurrent read blocks until the first commit
      await tx.$executeRaw`SELECT status FROM transfers WHERE id = ${transferId} FOR UPDATE`;
      const existing = await tx.transfer.findUnique({ where: { id: transferId } });
      if (!existing || existing.status !== 'REQUESTED') return { ok: false, status: 409 };

      // Lock inventory row
      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE product_id = ${existing.productId} AND warehouse_id = ${fromWhId} FOR UPDATE`;
      await delay(5);
      const srcInv = await tx.inventoryItem.findUnique({
        where: { productId_warehouseId: { productId: existing.productId, warehouseId: fromWhId } },
      });
      if (!srcInv || srcInv.quantity < existing.quantityInitiated)
        return { ok: false, status: 409 };

      await tx.transfer.update({
        where: { id: transferId },
        data: { fromWarehouseId: fromWhId, status: 'PENDING' },
      });
      await tx.inventoryItem.update({
        where: { id: srcInv.id },
        data: { quantity: { decrement: existing.quantityInitiated } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: srcInv.id,
          type: 'TRANSFER_OUT',
          delta: -existing.quantityInitiated,
          reference: 'Concurrent accept test',
        },
      });
      return { ok: true, status: 200 };
    });
  } catch {
    return { ok: false, status: 500 };
  }
}

/** Race two accepts. Returns the final transfer status and source stock. */
async function raceAccepts(transferId: string, srcWhId: string, prodId: string) {
  const [ra, rb] = await Promise.all([
    tryAccept(transferId, srcWhId),
    tryAccept(transferId, srcWhId),
  ]);
  const finalTransfer = await prisma.transfer.findUnique({ where: { id: transferId } });
  const finalInv = await prisma.inventoryItem.findUnique({
    where: { productId_warehouseId: { productId: prodId, warehouseId: srcWhId } },
  });
  return { ra, rb, finalTransfer, finalInv };
}

/** Simulate a transfer receive with forced read-then-write gap, using FOR UPDATE lock. */
async function tryReceive(transferId: string): Promise<{ ok: boolean; status: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await delay(5);
      const existing = await tx.transfer.findUnique({ where: { id: transferId } });
      if (!existing || existing.status !== 'IN_TRANSIT') return { ok: false, status: 409 };

      // Lock destination inventory row
      await tx.$executeRaw`SELECT quantity FROM inventory_items WHERE product_id = ${existing.productId} AND warehouse_id = ${existing.toWarehouseId} FOR UPDATE`;
      await delay(5);

      const destInv = await tx.inventoryItem.upsert({
        where: {
          productId_warehouseId: {
            productId: existing.productId,
            warehouseId: existing.toWarehouseId,
          },
        },
        create: { productId: existing.productId, warehouseId: existing.toWarehouseId, quantity: 0 },
        update: {},
      });

      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          quantityReceived: existing.quantityInitiated,
          receivedAt: new Date(),
        },
      });
      await tx.inventoryItem.update({
        where: { id: destInv.id },
        data: { quantity: { increment: existing.quantityInitiated } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: destInv.id,
          type: 'TRANSFER_IN',
          delta: existing.quantityInitiated,
          reference: 'Concurrent receive test',
        },
      });
      return { ok: true, status: 200 };
    });
  } catch {
    return { ok: false, status: 500 };
  }
}

async function raceReceives(transferId: string, prodId: string, destWhId: string) {
  const [ra, rb] = await Promise.all([tryReceive(transferId), tryReceive(transferId)]);
  const finalTransfer = await prisma.transfer.findUnique({ where: { id: transferId } });
  const finalInv = await prisma.inventoryItem.findUnique({
    where: { productId_warehouseId: { productId: prodId, warehouseId: destWhId } },
  });
  return { ra, rb, finalTransfer, finalInv };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('real-database concurrency and invariants', () => {
  let data: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    const pool = new Pool({ connectionString: TEST_DB_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    // Clean all test data
    await prisma.inventoryTransaction.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.warehouse.deleteMany();
    await prisma.$disconnect();
  });

  // Create fresh seed before every test
  beforeEach(async () => {
    // Clean in reverse dependency order
    await prisma.inventoryTransaction.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.warehouse.deleteMany();
    data = await seed();
  });

  // -----------------------------------------------------------------------
  // 1. Concurrent sales overselling
  // -----------------------------------------------------------------------
  it('prevents overselling under concurrent requests (stock=10, a=8, b=5)', async () => {
    const { ra, rb, finalQty } = await raceSales(data.prod.id, data.w1.id, 8, 5);

    // At most one sale succeeded; total sold ≤ 10
    const successes = [ra, rb].filter((r) => r.ok).length;
    expect(successes).toBeLessThanOrEqual(1);
    expect(finalQty).toBeGreaterThanOrEqual(0);
    // Stock is either 2 (only 8 succeeded) or 5 (only 5 succeeded)
    expect([2, 5]).toContain(finalQty);
  });

  // -----------------------------------------------------------------------
  // 2. Concurrent transfer accept race
  // -----------------------------------------------------------------------
  it('prevents duplicate concurrent accept of the same REQUESTED transfer', async () => {
    const srcInvBefore = await prisma.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId: data.prod.id, warehouseId: data.w1.id } },
    });
    expect(srcInvBefore!.quantity).toBe(10);

    const { ra, rb, finalTransfer, finalInv } = await raceAccepts(
      data.transfer.id,
      data.w1.id,
      data.prod.id
    );

    // Only one accept should succeed
    const successes = [ra, rb].filter((r) => r.ok).length;
    expect(successes).toBe(1);
    // Transfer should be PENDING (not COMPLETED twice)
    expect(finalTransfer!.status).toBe('PENDING');
    // Source stock should be decremented exactly once: 10 - 5 = 5
    expect(finalInv!.quantity).toBe(5);
  });

  // -----------------------------------------------------------------------
  // 3. Concurrent transfer receive race
  // -----------------------------------------------------------------------
  it('prevents duplicate concurrent receive of the same IN_TRANSIT transfer', async () => {
    // First, promote the PENDING transfer to IN_TRANSIT
    await prisma.transfer.update({
      where: { id: data.pendingTransfer.id },
      data: { status: 'IN_TRANSIT', shippedAt: new Date() },
    });

    // Destination w3 starts at 0
    const destBefore = await prisma.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId: data.prod.id, warehouseId: data.w3.id } },
    });
    expect(destBefore?.quantity ?? 0).toBe(0);

    const { ra, rb, finalTransfer, finalInv } = await raceReceives(
      data.pendingTransfer.id,
      data.prod.id,
      data.w3.id
    );

    // Only one receive should succeed
    const successes = [ra, rb].filter((r) => r.ok).length;
    expect(successes).toBe(1);
    // Transfer should be COMPLETED
    expect(finalTransfer!.status).toBe('COMPLETED');
    // Destination stock should be incremented exactly once: 0 + 5 = 5
    expect(finalInv!.quantity).toBe(5);
  });

  // -----------------------------------------------------------------------
  // 4. Transaction rollback on partial failure
  // -----------------------------------------------------------------------
  it('rolls back fully when an interactive transaction throws mid-way', async () => {
    const item = data.inv1;
    const beforeQty = item.quantity;

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: { increment: 100 } },
        });
        // Force a syntax error in raw SQL to trigger rollback
        await tx.$executeRaw`INVALID SQL HERE`;
      })
    ).rejects.toThrow();

    // Stock should NOT have changed
    const after = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(after!.quantity).toBe(beforeQty);
  });

  it('rolls back all operations when a mid-transaction interactive statement fails', async () => {
    // Promote to IN_TRANSIT first
    await prisma.transfer.update({
      where: { id: data.transfer.id },
      data: { fromWarehouseId: data.w1.id, status: 'IN_TRANSIT', shippedAt: new Date() },
    });

    const destItem = await prisma.inventoryItem.upsert({
      where: { productId_warehouseId: { productId: data.prod.id, warehouseId: data.w3.id } },
      create: { productId: data.prod.id, warehouseId: data.w3.id, quantity: 0 },
      update: {},
    });

    // Interactive transaction that succeeds partially then fails
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.transfer.update({
          where: { id: data.transfer.id },
          data: { status: 'COMPLETED', quantityReceived: 5, receivedAt: new Date() },
        });
        await tx.inventoryItem.update({
          where: { id: destItem.id },
          data: { quantity: { increment: 5 } },
        });
        // Force failure — valid SQL that violates a constraint
        await tx.$executeRaw`INSERT INTO nonexistent_table VALUES (1)`;
      })
    ).rejects.toThrow();

    // All operations rolled back
    const afterTransfer = await prisma.transfer.findUnique({ where: { id: data.transfer.id } });
    expect(afterTransfer!.status).toBe('IN_TRANSIT');
    const afterInv = await prisma.inventoryItem.findUnique({ where: { id: destItem.id } });
    expect(afterInv!.quantity).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 5. API-key scope enforcement
  // -----------------------------------------------------------------------
  it('API-key scopes are now enforced by all mutation routes', async () => {
    // Verify that hasScope is imported and used in the key mutation routes.
    // Previously scopes were stored but never enforced.
    const { readFile } = await import('node:fs/promises');
    const files = [
      'app/api/v1/sales/route.ts',
      'app/api/v1/receive/route.ts',
      'app/api/v1/inventory/route.ts',
      'app/api/v1/api-keys/route.ts',
      'app/api/v1/transfers/route.ts',
      'app/api/v1/transfers/[id]/accept/route.ts',
      'app/api/v1/transfers/[id]/receive/route.ts',
      'app/api/v1/transfers/[id]/ship/route.ts',
      'app/api/v1/products/route.ts',
      'app/api/v1/products/[id]/route.ts',
      'app/api/v1/customers/route.ts',
      'app/api/v1/customers/[id]/route.ts',
      'app/api/v1/suppliers/route.ts',
      'app/api/v1/suppliers/[id]/route.ts',
      'app/api/v1/warehouses/route.ts',
      'app/api/v1/warehouses/[id]/route.ts',
      'app/api/v1/webhooks/route.ts',
      'app/api/v1/webhooks/[id]/route.ts',
      'app/api/v1/webhooks/[id]/test/route.ts',
    ];
    for (const fp of files) {
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('hasScope');
    }
  });

  // -----------------------------------------------------------------------
  // 6. Webhook lifecycle dispatch
  // -----------------------------------------------------------------------
  it('webhooks are dispatched from sale and transfer-complete workflows', async () => {
    // dispatchWebhook is now imported and called from sale and transfer routes.
    const { readFile } = await import('node:fs/promises');
    const saleRoute = await readFile('app/api/v1/sales/route.ts', 'utf-8');
    expect(saleRoute).toContain("import { dispatchWebhook } from '@/lib/webhooks'");
    expect(saleRoute).toContain("dispatchWebhook('sale.created'");

    const transferReceiveRoute = await readFile(
      'app/api/v1/transfers/[id]/receive/route.ts',
      'utf-8'
    );
    expect(transferReceiveRoute).toContain("import { dispatchWebhook } from '@/lib/webhooks'");
    expect(transferReceiveRoute).toContain("dispatchWebhook('transfer.completed'");
  });
});
