import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  product: vi.fn(),
  warehouse: vi.fn(),
  supplier: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  createTransaction: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: mocks.requireAuth,
  hasScope: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findUnique: mocks.product },
    warehouse: { findUnique: mocks.warehouse },
    supplier: { findUnique: mocks.supplier },
    inventoryItem: { upsert: mocks.upsert, update: mocks.update },
    inventoryTransaction: { create: mocks.createTransaction },
    $transaction: mocks.transaction,
  },
}));
import { POST } from './route';

const body = { productId: 'p1', warehouseId: 'w1', supplierId: 's1', quantity: 1, unitCost: 4 };
const request = (value: unknown) =>
  new NextRequest('http://localhost/api/v1/receive', {
    method: 'POST',
    body: JSON.stringify(value),
    headers: { 'content-type': 'application/json' },
  });

describe('POST /api/v1/receive', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', warehouseId: null } });
    mocks.product.mockResolvedValue({ id: 'p1', name: 'Shoe', sku: 'S1' });
    mocks.warehouse.mockResolvedValue({ id: 'w1', name: 'Main' });
    mocks.supplier.mockResolvedValue({ id: 's1', name: 'Supply' });
    mocks.upsert.mockResolvedValue({ id: 'i1' });
    mocks.update.mockReturnValue(Promise.resolve({ quantity: 1 }));
    mocks.createTransaction.mockReturnValue(Promise.resolve({ id: 't1' }));
    mocks.transaction.mockResolvedValue([
      { quantity: 1 },
      { id: 't1', createdAt: new Date('2026-01-01') },
    ]);
  });

  it('receives the minimum quantity and calculates cost', async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      receipt: { quantity: 1, total: 4 },
      newStock: 1,
    });
  });

  it('rejects unauthenticated and nonpositive quantities', async () => {
    mocks.requireAuth.mockResolvedValueOnce(null);
    expect((await POST(request(body))).status).toBe(401);
    expect((await POST(request({ ...body, quantity: 0 }))).status).toBe(400);
  });

  it('reports each missing relation', async () => {
    mocks.product.mockResolvedValueOnce(null);
    expect((await POST(request(body))).status).toBe(404);
    mocks.warehouse.mockResolvedValueOnce(null);
    expect((await POST(request(body))).status).toBe(404);
    mocks.supplier.mockResolvedValueOnce(null);
    expect((await POST(request(body))).status).toBe(404);
  });

  it('prevents operators from receiving into another warehouse', async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: 'w2' },
    });
    const response = await POST(request(body));
    expect(response.status).toBe(403);
    expect(mocks.product).not.toHaveBeenCalled();
  });

  it('returns 500 when the transaction fails', async () => {
    mocks.transaction.mockRejectedValue(new Error('write failed'));
    expect((await POST(request(body))).status).toBe(500);
  });
});
