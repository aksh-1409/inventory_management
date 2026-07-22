import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, cleanupRateLimit, getRateLimitStatus, recordFailedAttempt, resetRateLimit } from './rate-limit'

describe('rate limiter', () => {
  const key = 'client@example.com'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    resetRateLimit(key)
  })

  afterEach(() => vi.useRealTimers())

  it('allows five attempts and blocks the sixth', () => {
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 4 })
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 3 })
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 2 })
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 1 })
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 0 })
    expect(checkRateLimit(key)).toEqual({ success: false, retryAfterMs: 900_000 })
  })

  it('starts a fresh window at the exact reset boundary', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) checkRateLimit(key)
    vi.advanceTimersByTime(900_000)

    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 4 })
  })

  it('checks login status without counting successful attempts', () => {
    expect(getRateLimitStatus(key)).toEqual({ success: true, remaining: 5 })
    expect(getRateLimitStatus(key)).toEqual({ success: true, remaining: 5 })
    expect(recordFailedAttempt(key)).toEqual({ success: true, remaining: 4 })
    expect(getRateLimitStatus(key)).toEqual({ success: true, remaining: 4 })
  })

  it('keeps independent limits per key', () => {
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 4 })
    expect(checkRateLimit('other@example.com')).toEqual({ success: true, remaining: 4 })
    resetRateLimit('other@example.com')
  })

  it('reset and cleanup make expired entries usable again', () => {
    for (let attempt = 0; attempt < 6; attempt += 1) checkRateLimit(key)
    resetRateLimit(key)
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 4 })

    vi.advanceTimersByTime(900_000)
    cleanupRateLimit()
    expect(checkRateLimit(key)).toEqual({ success: true, remaining: 4 })
  })
})
