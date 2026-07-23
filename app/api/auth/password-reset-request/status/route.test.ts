import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { passwordResetRequest: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock('@/lib/password-reset', () => ({
  hashResetSecret: (s: string) => `hash:${s}`,
  parseResetCookie: vi.fn(),
  RESET_REQUEST_COOKIE: 'stockpilot-reset-request',
}));

import { GET } from './route';
import * as pwReset from '@/lib/password-reset';

const request = (cookie?: string) => {
  const req = new NextRequest('http://localhost/api/auth/password-reset-request/status', {
    method: 'GET',
  });
  if (cookie) req.cookies.set('stockpilot-reset-request', cookie);
  return req;
};

describe('GET /api/auth/password-reset-request/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pwReset.parseResetCookie).mockImplementation((value: string | undefined) => {
      if (!value) return null;
      const dot = value.indexOf('.');
      return dot > 0 ? { requestId: value.slice(0, dot), secret: value.slice(dot + 1) } : null;
    });
  });

  it('returns EXPIRED when no cookie', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('EXPIRED');
  });

  it('returns PENDING when request not found', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await GET(request('req-uuid.secret'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('PENDING');
  });

  it('returns PENDING when secret hash does not match', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      requestSecretHash: 'hash:wrong',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await GET(request('req-uuid.secret'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('PENDING');
  });

  it('returns EXPIRED and updates DB when past expiry', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      requestSecretHash: 'hash:secret',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });
    mocks.update.mockResolvedValue({});

    const response = await GET(request('req-uuid.secret'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('EXPIRED');
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'req-uuid' },
      data: { status: 'EXPIRED' },
    });
  });

  it('returns the current status of a valid request', async () => {
    const future = new Date(Date.now() + 60_000);
    mocks.findUnique.mockResolvedValue({
      id: 'req-uuid',
      requestSecretHash: 'hash:secret',
      status: 'APPROVED',
      expiresAt: future,
    });

    const response = await GET(request('req-uuid.secret'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('APPROVED');
    expect(json.expiresAt).toBe(future.toISOString());
  });
});
