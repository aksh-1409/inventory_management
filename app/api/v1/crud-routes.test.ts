import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasScope: vi.fn().mockReturnValue(true),
  productFind: vi.fn(),
  productCreate: vi.fn(),
  customerFind: vi.fn(),
  customerCreate: vi.fn(),
  supplierCreate: vi.fn(),
}));
vi.mock('@/lib/api-auth', () => ({ requireAuth: mocks.requireAuth, hasScope: mocks.hasScope }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findUnique: mocks.productFind, create: mocks.productCreate, findMany: vi.fn() },
    customer: { findUnique: mocks.customerFind, create: mocks.customerCreate, findMany: vi.fn() },
    supplier: { create: mocks.supplierCreate, findMany: vi.fn() },
  },
}));

import { POST as createProduct } from './products/route';
import { POST as createCustomer } from './customers/route';
import { POST as createSupplier } from './suppliers/route';

const request = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('collection CRUD routes', () => {
  beforeEach(() => {
    mocks.hasScope.mockReturnValue(true);
    mocks.requireAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', warehouseId: null } });
    mocks.productFind.mockResolvedValue(null);
    mocks.customerFind.mockResolvedValue(null);
    mocks.productCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));
    mocks.customerCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data }));
    mocks.supplierCreate.mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data }));
  });

  it('creates entities when optional form fields are null', async () => {
    const product = await createProduct(
      request('/api/v1/products', {
        sku: 'S1',
        name: 'Shoe',
        price: 10,
        reorderPoint: 0,
        description: null,
        costPrice: null,
        category: null,
      })
    );
    const customer = await createCustomer(
      request('/api/v1/customers', { name: 'Pat', phone: '1', email: null })
    );
    const supplier = await createSupplier(
      request('/api/v1/suppliers', {
        name: 'Supply',
        contactName: null,
        email: null,
        phone: null,
      })
    );

    expect([product.status, customer.status, supplier.status]).toEqual([201, 201, 201]);
  });

  it('enforces scoped writes for products and suppliers', async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 'u1', role: 'OPERATOR', warehouseId: null, scopes: [] },
    });
    mocks.hasScope.mockReturnValue(false);
    expect(
      (await createProduct(request('/api/v1/products', { sku: 'S1', name: 'Test', price: 10 })))
        .status
    ).toBe(403);
    expect((await createSupplier(request('/api/v1/suppliers', { name: 'S' }))).status).toBe(403);
  });

  it('rejects invalid fields and duplicate unique values', async () => {
    expect(
      (await createProduct(request('/api/v1/products', { sku: '', name: 'Shoe', price: 10 })))
        .status
    ).toBe(400);
    mocks.productFind.mockResolvedValueOnce({ id: 'existing' });
    expect(
      (await createProduct(request('/api/v1/products', { sku: 'S1', name: 'Shoe', price: 10 })))
        .status
    ).toBe(409);
    mocks.customerFind.mockResolvedValueOnce({ id: 'existing' });
    expect(
      (await createCustomer(request('/api/v1/customers', { name: 'Pat', phone: '1' }))).status
    ).toBe(409);
  });

  it('returns 401 without authentication and 500 on persistence failure', async () => {
    mocks.requireAuth.mockResolvedValueOnce(null);
    expect(
      (await createCustomer(request('/api/v1/customers', { name: 'Pat', phone: '1' }))).status
    ).toBe(401);
    mocks.customerCreate.mockRejectedValueOnce(new Error('database unavailable'));
    expect(
      (await createCustomer(request('/api/v1/customers', { name: 'Pat', phone: '1' }))).status
    ).toBe(500);
  });
});
