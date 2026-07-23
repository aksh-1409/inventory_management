import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  findUnique: vi.fn(),
  userUpdate: vi.fn(),
  prUpdate: vi.fn(),
  prUpdateMany: vi.fn(),
  tokenUpdateMany: vi.fn(),
  resetRateLimit: vi.fn(),
}));

vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
    passwordResetRequest: {
      findUnique: mocks.findUnique,
      update: mocks.prUpdate,
      updateMany: mocks.prUpdateMany,
    },
    user: { update: mocks.userUpdate },
    passwordResetToken: { updateMany: mocks.tokenUpdateMany },
  },
}));
vi.mock('@/lib/password-reset', () => ({
  hashResetSecret: (s: string) => `hash:${s}`,
  parseResetCookie: vi.fn(),
  RESET_REQUEST_COOKIE: 'stockpilot-reset-request',
}));
vi.mock('@/lib/rate-limit', () => ({ resetRateLimit: mocks.resetRateLimit }));
vi.mock('@/lib/email', () => ({ normalizeEmail: (e: string) => e.toLowerCase().trim() }));

import { POST } from './route';
import * as pwReset from '@/lib/password-reset';

const request = (body: unknown, cookie?: string) => {
  const req = new NextRequest('http://localhost/api/auth/password-reset-request/complete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  if (cookie) req.cookies.set('stockpilot-reset-request', cookie);
  return req;
};

function makeTx() {
  return {
    $queryRaw: vi.fn(),
    passwordResetRequest: {
      findUnique: mocks.findUnique,
      update: mocks.prUpdate,
      updateMany: mocks.prUpdateMany,
    },
    user: { update: mocks.userUpdate },
    passwordResetToken: { updateMany: mocks.tokenUpdateMany },
  };
}

describe('POST /api/auth/password-reset-request/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pwReset.parseResetCookie).mockImplementation((value: string | undefined) => {
      if (!value) return null;
      const dot = value.indexOf('.');
      return dot > 0 ? { requestId: value.slice(0, dot), secret: value.slice(dot + 1) } : null;
    });
    mocks.hash.mockResolvedValue('bcrypt-hash');
    mocks.transaction.mockImplementation(async (fn: (tx: any) => any) => fn(makeTx()));
  });

  it('rejects without a cookie', async () => {
    const response = await POST(request({ password: 'newpassword123' }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('no longer available');
  });

  it('rejects a short password', async () => {
    const response = await POST(request({ password: 'short' }, 'req-uuid.secret'));

    expect(response.status).toBe(400);
  });

  it('rejects when request is not APPROVED', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      requestSecretHash: 'hash:secret',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'op@test.com', role: 'OPERATOR' },
    });

    const response = await POST(request({ password: 'newpassword123' }, 'req-uuid.secret'));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('not approved');
  });

  it('successfully completes password reset', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      requestSecretHash: 'hash:secret',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'op@test.com', role: 'OPERATOR' },
    });

    const response = await POST(request({ password: 'newpassword123' }, 'req-uuid.secret'));

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ passwordHash: 'bcrypt-hash' }),
    });
    expect(mocks.prUpdate).toHaveBeenCalledWith({
      where: { id: 'req-uuid' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(mocks.resetRateLimit).toHaveBeenCalledWith('login:account:op@test.com');

    const setCookie = (await response.headers.get('set-cookie')) ?? '';
    expect(setCookie).toMatch(/max-age=0|Max-Age=0/i);
  });

  it('handles DB errors gracefully', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('db failure'));

    const response = await POST(request({ password: 'newpassword123' }, 'req-uuid.secret'));

    expect(response.status).toBe(503);
  });
});
