import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { findUniqueMock, createMock, deleteMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(), createMock: vi.fn(), deleteMock: vi.fn(), updateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { idempotencyKey: { findUnique: findUniqueMock, create: createMock, delete: deleteMock, update: updateMock } },
}))

import { withIdempotency } from './idempotency'

const request = (key?: string) => new NextRequest('http://localhost/api/v1/sales', {
  method: 'POST', headers: key ? { 'Idempotency-Key': key } : {},
})

describe('withIdempotency', () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue({})
    deleteMock.mockResolvedValue({})
    updateMock.mockResolvedValue({})
  })

  it('executes and caches a new JSON response', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ sale: 'created' }, { status: 201 }))
    const response = await withIdempotency(request('sale-1'), handler)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ sale: 'created' })
    expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ key: 'sale-1', responseStatus: 0 }) })
    expect(updateMock).toHaveBeenCalledWith({
      where: { key: 'sale-1' },
      data: expect.objectContaining({ responseStatus: 201, responseBody: { sale: 'created' } }),
    })
  })

  it('replays an unexpired response without executing the handler', async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error(), { code: 'P2002' }))
    findUniqueMock.mockResolvedValue({
      responseBody: { sale: 'existing' }, responseStatus: 200,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const handler = vi.fn()
    const response = await withIdempotency(request('sale-1'), handler)

    expect(handler).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ sale: 'existing' })
  })

  it('returns 409 when the first request is still processing', async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error(), { code: 'P2002' }))
    findUniqueMock.mockResolvedValue({
      responseBody: {}, responseStatus: 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    const handler = vi.fn()
    const response = await withIdempotency(request('sale-1'), handler)

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(409)
  })

  it('re-executes after an expired response', async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error(), { code: 'P2002' }))
    findUniqueMock.mockResolvedValue({
      responseBody: { stale: true }, responseStatus: 200,
      expiresAt: new Date(0),
    })
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ fresh: true }))

    const response = await withIdempotency(request('sale-1'), handler)

    expect(handler).toHaveBeenCalledOnce()
    await expect(response.json()).resolves.toEqual({ fresh: true })
  })

  it('bypasses persistence without a key and propagates handler failures', async () => {
    const success = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    await withIdempotency(request(), success)
    expect(createMock).not.toHaveBeenCalled()

    const failure = new Error('sale failed')
    await expect(withIdempotency(request(), () => Promise.reject(failure))).rejects.toBe(failure)
  })
})
