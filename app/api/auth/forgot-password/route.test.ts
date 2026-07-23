import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  randomBytes: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('crypto', () => ({
  default: {
    randomBytes: mocks.randomBytes,
    randomUUID: mocks.randomUUID,
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({ digest: vi.fn().mockReturnValue('hash') }),
    }),
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
    passwordResetRequest: { updateMany: mocks.updateMany, create: mocks.create },
  },
}));
vi.mock('@/lib/email', () => ({ normalizeEmail: (e: string) => e.toLowerCase().trim() }));

import { POST } from './route';

const request = (body: unknown, ip?: string) =>
  new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip ?? '1.2.3.4' },
  });

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({ success: true, remaining: 4 });
    mocks.randomUUID.mockReturnValue('req-uuid-1');
    mocks.randomBytes.mockReturnValue({ toString: () => 'secret123' });
  });

  it('creates a request for OPERATOR and sets a cookie', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'op@test.com',
      role: 'OPERATOR',
      name: 'Op',
    });
    mocks.transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => unknown) => {
      const tx = { passwordResetRequest: { updateMany: mocks.updateMany, create: mocks.create } };
      mocks.create.mockResolvedValue({ id: 'req-uuid-1' });
      return fn(tx);
    });

    const response = await POST(request({ email: 'OP@TEST.COM' }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.statusUrl).toBe('/auth/password-reset');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('stockpilot-reset-request=req-uuid-1.secret123');
  });

  it('returns 200 for non-operator without creating a request', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'admin@test.com', role: 'ADMIN' });

    const response = await POST(request({ email: 'admin@test.com' }));

    expect(response.status).toBe(200);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns 200 even when email does not exist (no info leak)', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(request({ email: 'unknown@test.com' }));

    expect(response.status).toBe(200);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects rate-limited requests with 429', async () => {
    mocks.checkRateLimit.mockReturnValue({ success: false, retryAfterMs: 60_000 });

    const response = await POST(request({ email: 'op@test.com' }));

    expect(response.status).toBe(429);
  });

  it('rejects missing email', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Email is required.');
  });

  it('returns 503 when DB fails', async () => {
    mocks.findUnique.mockRejectedValue(new Error('db down'));

    const response = await POST(request({ email: 'op@test.com' }));

    expect(response.status).toBe(503);
  });

  it('cancels previous PENDING or APPROVED requests for the same user', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'op@test.com', role: 'OPERATOR' });
    mocks.transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => unknown) => {
      const tx = { passwordResetRequest: { updateMany: mocks.updateMany, create: mocks.create } };
      mocks.create.mockResolvedValue({ id: 'req-uuid-1' });
      return fn(tx);
    });

    await POST(request({ email: 'op@test.com' }));

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'CANCELLED' },
    });
  });
});
