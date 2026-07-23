import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  findUnique: vi.fn(),
  prUpdate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
    passwordResetRequest: { findUnique: mocks.findUnique, update: mocks.prUpdate },
  },
}));

import { POST } from './route';

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/admin-reset-requests/req-uuid', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

const ctx = { params: Promise.resolve({ id: 'req-uuid' }) };

describe('POST /api/auth/admin-reset-requests/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => unknown) => {
      const tx = {
        $queryRaw: vi.fn(),
        passwordResetRequest: { findUnique: mocks.findUnique, update: mocks.prUpdate },
      };
      return fn(tx);
    });
  });

  it('returns 403 for non-admin', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', role: 'OPERATOR' } });

    const response = await POST(request({ action: 'approve' }), ctx);

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid action', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });

    const response = await POST(request({ action: 'invalid' }), ctx);

    expect(response.status).toBe(400);
  });

  it('approves a pending request', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      user: { role: 'OPERATOR' },
    });

    const response = await POST(request({ action: 'approve' }), ctx);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('APPROVED');
    expect(mocks.prUpdate).toHaveBeenCalledWith({
      where: { id: 'req-uuid' },
      data: expect.objectContaining({ status: 'APPROVED', reviewedById: 'admin1' }),
    });
  });

  it('rejects a pending request', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      user: { role: 'OPERATOR' },
    });

    const response = await POST(request({ action: 'reject' }), ctx);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('REJECTED');
    expect(mocks.prUpdate).toHaveBeenCalledWith({
      where: { id: 'req-uuid' },
      data: expect.objectContaining({ status: 'REJECTED' }),
    });
  });

  it('returns 409 when request is already processed', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'COMPLETED',
      expiresAt: new Date(Date.now() + 60_000),
      user: { role: 'OPERATOR' },
    });

    const response = await POST(request({ action: 'approve' }), ctx);

    expect(response.status).toBe(409);
  });

  it('returns 409 when request is expired', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } });
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
      user: { role: 'OPERATOR' },
    });

    const response = await POST(request({ action: 'approve' }), ctx);

    expect(response.status).toBe(409);
  });
});
