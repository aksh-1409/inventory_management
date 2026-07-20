import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authMock, findUniqueMock, updateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({
  prisma: { apiKey: { findUnique: findUniqueMock, update: updateMock } },
}))

import { apiAuth, hasScope, requireAuth } from './api-auth'

const request = (key?: string) => new NextRequest('http://localhost/api/v1/products', {
  headers: key ? { authorization: `Bearer ${key}` } : {},
})

describe('API authentication', () => {
  beforeEach(() => {
    authMock.mockResolvedValue(null)
    updateMock.mockResolvedValue({})
  })

  it('authenticates an active unexpired API key and records its use', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'key-1', userId: 'user-1', isActive: true, expiresAt: null,
      scopes: ['products:read'], user: { role: 'OPERATOR', warehouseId: 'warehouse-1' },
    })

    await expect(apiAuth(request('sp_live_secret'))).resolves.toEqual({
      id: 'user-1', role: 'OPERATOR', warehouseId: 'warehouse-1', scopes: ['products:read'],
    })
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'key-1' } }))
  })

  it('rejects malformed, inactive, unknown, and exactly-expired keys', async () => {
    await expect(apiAuth(request('wrong'))).resolves.toBeNull()
    expect(findUniqueMock).not.toHaveBeenCalled()

    findUniqueMock.mockResolvedValueOnce(null)
    await expect(apiAuth(request('sp_live_unknown'))).resolves.toBeNull()

    findUniqueMock.mockResolvedValueOnce({ isActive: false })
    await expect(apiAuth(request('sp_live_inactive'))).resolves.toBeNull()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    findUniqueMock.mockResolvedValueOnce({ isActive: true, expiresAt: new Date(), user: {} })
    await expect(apiAuth(request('sp_live_expired'))).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('prefers a session and falls back to an API key', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'session-user', role: 'ADMIN', warehouseId: null } })
    await expect(requireAuth(request('sp_live_secret'))).resolves.toEqual({
      source: 'session', user: { id: 'session-user', role: 'ADMIN', warehouseId: null },
    })
    expect(findUniqueMock).not.toHaveBeenCalled()

    findUniqueMock.mockResolvedValueOnce({
      id: 'key-1', userId: 'api-user', isActive: true, expiresAt: null,
      scopes: [], user: { role: 'OPERATOR', warehouseId: null },
    })
    await expect(requireAuth(request('sp_live_secret'))).resolves.toMatchObject({
      source: 'api-key', user: { id: 'api-user' },
    })
  })

  it('enforces exact scopes while allowing administrators', () => {
    // Session user (no scopes) → all scopes allowed
    expect(hasScope({ id: '1', role: 'OPERATOR', warehouseId: null }, 'products:read')).toBe(true)
    // API-key user with matching scope → allowed
    expect(hasScope({ id: '1', role: 'OPERATOR', warehouseId: null, scopes: ['products:read'] }, 'products:read')).toBe(true)
    // API-key user with non-matching scope → denied
    expect(hasScope({ id: '1', role: 'OPERATOR', warehouseId: null, scopes: ['products'] }, 'products:read')).toBe(false)
    // API-key user with empty scopes → denied
    expect(hasScope({ id: '1', role: 'OPERATOR', warehouseId: null, scopes: [] }, 'products:read')).toBe(false)
    // ADMIN bypasses scopes entirely
    expect(hasScope({ id: '1', role: 'ADMIN', warehouseId: null }, 'anything')).toBe(true)
  })
})
