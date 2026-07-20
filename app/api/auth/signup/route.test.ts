import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn(), findUnique: vi.fn(), create: vi.fn(), hash: vi.fn(), whFindUnique: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique, create: mocks.create }, warehouse: { findUnique: mocks.whFindUnique } } }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
import { POST } from './route'

const valid = { name: 'Jo', email: 'jo@example.com', password: '12345678', warehouseId: 'w1' }
const request = (body: unknown) => new NextRequest('http://localhost/api/auth/signup', {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
})

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReturnValue({ success: true, remaining: 4 })
    mocks.findUnique.mockResolvedValue(null)
    mocks.whFindUnique.mockResolvedValue({ id: 'w1', name: 'WH' })
    mocks.hash.mockResolvedValue('hash')
    mocks.create.mockResolvedValue({ id: 'u1', name: 'Jo', email: valid.email, role: 'OPERATOR', createdAt: new Date() })
  })

  it('creates an operator at minimum input lengths without exposing a password', async () => {
    const response = await POST(request(valid))
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.user).not.toHaveProperty('passwordHash')
    expect(mocks.hash).toHaveBeenCalledWith('12345678', 12)
  })

  it('rejects rate-limited, invalid, and duplicate requests', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ success: false, retryAfterMs: 60_000 })
    expect((await POST(request(valid))).status).toBe(429)
    expect((await POST(request({ ...valid, password: 'short' }))).status).toBe(400)
    mocks.findUnique.mockResolvedValueOnce({ id: 'existing' })
    expect((await POST(request(valid))).status).toBe(409)
  })

  it('returns 500 when hashing or persistence fails', async () => {
    mocks.hash.mockRejectedValueOnce(new Error('hash failed'))
    expect((await POST(request(valid))).status).toBe(500)
    mocks.create.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await POST(request(valid))).status).toBe(500)
  })
})
