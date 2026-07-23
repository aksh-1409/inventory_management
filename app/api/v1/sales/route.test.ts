import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findInventory: vi.fn(),
  updateInventory: vi.fn(),
  createTransaction: vi.fn(),
  transaction: vi.fn(),
  findProduct: vi.fn(),
  findWarehouse: vi.fn(),
  findCustomer: vi.fn(),
}));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: mocks.requireAuth,
  hasScope: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    inventoryItem: { findUnique: mocks.findInventory, update: mocks.updateInventory },
    inventoryTransaction: { create: mocks.createTransaction },
    $transaction: mocks.transaction,
    product: { findUnique: mocks.findProduct },
    warehouse: { findUnique: mocks.findWarehouse },
    customer: { findUnique: mocks.findCustomer },
  },
}));

import { POST } from './route';

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/v1/sales', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
const validSale = {
  productId: 'p1',
  warehouseId: 'w1',
  customerId: 'c1',
  quantity: 2,
  unitPrice: 10,
};

describe('POST /api/v1/sales', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', warehouseId: null } });
    mocks.findInventory.mockResolvedValue({ id: 'i1', quantity: 2 });
    mocks.updateInventory.mockReturnValue(Promise.resolve({ quantity: 0 }));
    mocks.createTransaction.mockReturnValue(
      Promise.resolve({ id: 't1', createdAt: new Date('2026-01-01') })
    );
    mocks.transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) =>
      cb({
        inventoryItem: { findUnique: mocks.findInventory, update: mocks.updateInventory },
        inventoryTransaction: { create: mocks.createTransaction },
        $executeRaw: vi.fn(),
      })
    );
    mocks.findProduct.mockResolvedValue({ id: 'p1', name: 'Shoe', sku: 'SHOE-1' });
    mocks.findWarehouse.mockResolvedValue({ id: 'w1', name: 'Main' });
    mocks.findCustomer.mockResolvedValue({ id: 'c1', name: 'Pat', email: null, phone: '1' });
  });

  it('records a sale at the exact available-stock boundary', async () => {
    const response = await POST(request(validSale));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      sale: { quantity: 2, total: 20 },
      remainingStock: 0,
    });
    expect(mocks.updateInventory).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { quantity: { decrement: 2 } },
    });
  });

  it('rejects unauthenticated and invalid requests', async () => {
    mocks.requireAuth.mockResolvedValueOnce(null);
    expect((await POST(request(validSale))).status).toBe(401);
    expect((await POST(request({ ...validSale, quantity: 0 }))).status).toBe(400);
  });

  it('rejects missing and insufficient inventory', async () => {
    mocks.findInventory.mockResolvedValueOnce(null);
    expect((await POST(request(validSale))).status).toBe(404);
    mocks.findInventory.mockResolvedValueOnce({ id: 'i1', quantity: 1 });
    mocks.findInventory.mockResolvedValueOnce({ id: 'i1', quantity: 1 });
    expect((await POST(request(validSale))).status).toBe(409);
  });

  it('prevents operators from selling stock in another warehouse', async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: 'w2' },
    });
    const response = await POST(request(validSale));
    expect(response.status).toBe(403);
    expect(mocks.findInventory).not.toHaveBeenCalled();
  });

  it('returns 500 when persistence fails', async () => {
    mocks.transaction.mockRejectedValue(new Error('database unavailable'));
    expect((await POST(request(validSale))).status).toBe(500);
  });
});
