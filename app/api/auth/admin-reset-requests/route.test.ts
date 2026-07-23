import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/prisma', () => ({ prisma: { passwordResetRequest: { findMany: mocks.findMany } } }));

import { GET } from './route';

describe('GET /api/auth/admin-reset-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', role: 'OPERATOR' } });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it('returns 403 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it('returns list of pending requests for admin', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });
    const future = new Date(Date.now() + 60_000);
    mocks.findMany.mockResolvedValue([
      {
        id: 'req-1',
        requestedAt: new Date(),
        expiresAt: future,
        user: { name: 'Operator A', email: 'op-a@test.com', warehouse: { name: 'Warehouse 1' } },
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.requests).toHaveLength(1);
    expect(json.requests[0]).toMatchObject({
      id: 'req-1',
      operatorName: 'Operator A',
      operatorEmail: 'op-a@test.com',
      warehouseName: 'Warehouse 1',
    });
  });
});
