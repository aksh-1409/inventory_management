import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  whFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  hash: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.userUpdate },
    warehouse: { findUnique: mocks.whFindUnique },
  },
}));
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }));

import { PUT } from './route';

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/setup', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('PUT /api/auth/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'u1', name: 'Old Name' } });
    mocks.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Old Name',
      role: 'ADMIN',
      passwordSetAt: new Date(),
    });
    mocks.userUpdate.mockResolvedValue({});
    mocks.hash.mockResolvedValue('hash');
  });

  it('returns 401 without authentication', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await PUT(request({ name: 'New Name' }));

    expect(response.status).toBe(401);
  });

  it('updates name and warehouse for admin', async () => {
    mocks.whFindUnique.mockResolvedValue({ id: 'w1', name: 'WH' });

    const response = await PUT(request({ name: 'New Name', warehouseId: 'w1' }));

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ name: 'New Name', warehouseId: 'w1' }),
    });
  });

  it('allows admin to omit warehouseId', async () => {
    const response = await PUT(request({ name: 'New Name' }));

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ name: 'New Name', warehouseId: null }),
    });
  });

  it('rejects missing name', async () => {
    const response = await PUT(request({ warehouseId: 'w1' }));

    expect(response.status).toBe(400);
  });

  it('rejects operator without warehouse', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'op1', name: 'Op' } });
    mocks.findUnique.mockResolvedValue({ id: 'op1', role: 'OPERATOR', passwordSetAt: new Date() });

    const response = await PUT(request({ name: 'Op' }));

    expect(response.status).toBe(400);
  });

  it('requires password when passwordSetAt is missing', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } });
    mocks.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN', passwordSetAt: null });

    const response = await PUT(request({ name: 'User' }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('password');
  });

  it('sets password hash and passwordSetAt when needed', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN', passwordSetAt: null });

    const response = await PUT(request({ name: 'New Name', password: 'newpassword123' }));

    expect(response.status).toBe(200);
    expect(mocks.hash).toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ passwordHash: 'hash', passwordSetAt: expect.any(Date) }),
    });
  });

  it('returns 500 on database failure', async () => {
    mocks.userUpdate.mockRejectedValue(new Error('db error'));

    const response = await PUT(request({ name: 'New Name' }));

    expect(response.status).toBe(500);
  });
});
