import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Idempotency guard for POST/PUT/DELETE routes.
 * Client sends `Idempotency-Key` header. If the same key was used before,
 * returns the cached response. Otherwise executes the handler and caches the result.
 */
export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = req.headers.get('Idempotency-Key')
  if (!idempotencyKey) {
    return handler()
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  })

  if (existing) {
    return NextResponse.json(existing.responseBody as object, {
      status: existing.responseStatus,
    })
  }

  const response = await handler()

  const body = await response.clone().json().catch(() => ({}))

  await prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      responseStatus: response.status,
      responseBody: body,
    },
  })

  return response
}
