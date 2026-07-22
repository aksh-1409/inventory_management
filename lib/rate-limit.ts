/**
 * Rate Limiter — Sliding Window with exponential backoff.
 *
 * Uses an in-memory Map. For production serverless deployments,
 * replace the Map with a Redis store (e.g. Upstash Redis) so the
 * limit persists across function invocations.
 *
 * Base limits: 5 attempts per 15 minutes.
 * After the base window, each subsequent window doubles: 10/30min, 15/60min, 20/120min…
 */

interface RateLimitEntry {
  count: number
  resetAt: number
  windowMs: number
}

const store = new Map<string, RateLimitEntry>()

const BASE_MAX = 5
const BASE_WINDOW_MS = 15 * 60 * 1000

const WINDOW_MULTIPLIER = 2
const MAX_WINDOW_MS = 4 * 60 * 60 * 1000 // 4 hours cap

export interface RateLimitResult {
  success: boolean
  retryAfterMs?: number
  remaining?: number
}

function activeEntry(key: string): RateLimitEntry | undefined {
  const now = Date.now()
  const entry = store.get(key)

  if (entry && now >= entry.resetAt) {
    store.delete(key)
    return undefined
  }

  return entry
}

export function getRateLimitStatus(key: string): RateLimitResult {
  const entry = activeEntry(key)
  if (!entry) return { success: true, remaining: BASE_MAX }

  if (entry.count >= BASE_MAX) {
    return { success: false, retryAfterMs: entry.resetAt - Date.now() }
  }

  return { success: true, remaining: BASE_MAX - entry.count }
}

export function recordFailedAttempt(key: string): RateLimitResult {
  const now = Date.now()
  const entry = activeEntry(key)

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + BASE_WINDOW_MS, windowMs: BASE_WINDOW_MS })
    return { success: true, remaining: BASE_MAX - 1 }
  }

  entry.count += 1

  if (entry.count >= BASE_MAX) {
    return {
      success: false,
      retryAfterMs: entry.resetAt - now,
    }
  }

  return { success: true, remaining: BASE_MAX - entry.count }
}

// Generic endpoint limiter: each request counts as an attempt.
export function checkRateLimit(key: string): RateLimitResult {
  const status = getRateLimitStatus(key)
  if (!status.success) return status
  const recorded = recordFailedAttempt(key)
  return { success: true, remaining: recorded.remaining ?? 0 }
}

export function checkRateLimitPair(ipKey: string, accountKey: string): {
  success: boolean
  retryAfterMs?: number
  remaining?: number
} {
  const ipResult = checkRateLimit(ipKey)
  if (!ipResult.success) return ipResult

  return checkRateLimit(accountKey)
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}

export function cleanupRateLimit(): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}
