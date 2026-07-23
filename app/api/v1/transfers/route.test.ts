import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: mocks.requireAuth,
  hasScope: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { transfer: { findMany: mocks.findMany, count: mocks.count, create: mocks.create } },
}));
import { GET, POST } from './route';

const request = (method = 'GET', body?: unknown) =>
  new NextRequest('http://localhost/api/v1/transfers', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });

describe('/api/v1/transfers', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', warehouseId: null } });
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: 't1', status: 'REQUESTED' });
  });

  it('returns all transfers to admins and warehouse-related/open requests to operators', async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { product: { deletedAt: null } } })
    );

    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: 'w1' },
    });
    expect((await GET(request())).status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ fromWarehouseId: 'w1' }, { toWarehouseId: 'w1' }, { status: 'REQUESTED' }],
        }),
      })
    );
  });

  it('creates a minimum-size request for the assigned destination', async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: 'w1' },
    });
    const response = await POST(
      request('POST', { productId: 'p1', toWarehouseId: 'w1', quantity: 1 })
    );
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REQUESTED' }) })
    );
  });

  it('rejects another destination, invalid quantity, and unauthenticated access', async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: 'w1' },
    });
    expect(
      (await POST(request('POST', { productId: 'p1', toWarehouseId: 'w2', quantity: 1 }))).status
    ).toBe(403);
    expect(
      (await POST(request('POST', { productId: 'p1', toWarehouseId: 'w1', quantity: 0 }))).status
    ).toBe(400);
    mocks.requireAuth.mockResolvedValueOnce(null);
    expect((await GET(request())).status).toBe(401);
  });

  it('returns 500 when the database fails', async () => {
    mocks.findMany.mockRejectedValue(new Error('database unavailable'));
    expect((await GET(request())).status).toBe(500);
  });
});
