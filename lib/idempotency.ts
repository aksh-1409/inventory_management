import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Idempotency guard for POST/PUT/DELETE routes.
 *
 * Uses insert-first locking: the UNIQUE constraint on `key` guarantees
 * only one caller wins the race. Losers return the cached response or
 * a 409 "still processing" if the winner hasn't finished yet.
 */
export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = req.headers.get('Idempotency-Key')
  if (!idempotencyKey) {
    return handler()
  }

  // Atomically claim the key — unique constraint prevents concurrent claims
  const claimed = await prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      responseStatus: 0,
      responseBody: {},
    },
  }).catch((e: any) => {
    if (e?.code === 'P2002') return null
    throw e
  })

  if (!claimed) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    })
    if (existing) {
      if (existing.responseStatus === 0) {
        return NextResponse.json(
          { error: 'Request is being processed. Retry after a short delay.' },
          { status: 409, headers: { 'Retry-After': '2' } },
        )
      }
      if (existing.expiresAt > new Date()) {
        return NextResponse.json(existing.responseBody as object, {
          status: existing.responseStatus,
        })
      }
    }
  }

  // We hold the claim — execute the handler
  try {
    const response = await handler()
    const body = await response.clone().json().catch(() => ({}))

    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: {
        responseStatus: response.status,
        responseBody: body,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    return response
  } catch (e) {
    await prisma.idempotencyKey.delete({ where: { key: idempotencyKey } }).catch(() => {})
    throw e
  }
}
