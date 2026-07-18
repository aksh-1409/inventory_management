/**
 * Rate Limiter — Sliding Window implementation using an in-memory Map.
 *
 * For production, replace the Map with a Redis store (e.g. Upstash Redis)
 * so the limit persists across serverless function invocations.
 *
 * Limits: 5 attempts per 15 minutes per unique key (email or IP).
 */

interface RateLimitEntry {
  count: number
  resetAt: number // Unix timestamp (ms) when the window resets
}

const store = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes in milliseconds

/**
 * Check if a given key (email or IP) has exceeded the rate limit.
 * @returns `{ success: true }` if allowed, or `{ success: false, retryAfterMs }` if blocked.
 */
export function checkRateLimit(key: string): {
  success: boolean
  retryAfterMs?: number
  remaining?: number
} {
  const now = Date.now()
  const entry = store.get(key)

  // No previous entry or window has expired — reset
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { success: true, remaining: MAX_ATTEMPTS - 1 }
  }

  // Within window — increment count
  entry.count += 1

  if (entry.count > MAX_ATTEMPTS) {
    return {
      success: false,
      retryAfterMs: entry.resetAt - now,
    }
  }

  return { success: true, remaining: MAX_ATTEMPTS - entry.count }
}

/**
 * Reset the rate limit for a given key (e.g. on successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Cleanup expired entries to prevent memory leaks.
 * Call this periodically (e.g. on a cron or at startup).
 */
export function cleanupRateLimit(): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}
