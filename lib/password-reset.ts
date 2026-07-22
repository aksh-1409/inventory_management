import crypto from 'crypto'

export const RESET_REQUEST_COOKIE = 'stockpilot-reset-request'

export function hashResetSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export function parseResetCookie(value: string | undefined): { requestId: string; secret: string } | null {
  if (!value) return null
  const separator = value.indexOf('.')
  if (separator < 1) return null
  const requestId = value.slice(0, separator)
  const secret = value.slice(separator + 1)
  return requestId && secret ? { requestId, secret } : null
}
