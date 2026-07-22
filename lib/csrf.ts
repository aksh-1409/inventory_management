import { NextRequest, NextResponse } from 'next/server'

const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export function setCsrfCookie(response: NextResponse): NextResponse {
  if (!response.cookies.get(CSRF_COOKIE)) {
    const token = generateToken()
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }
  return response
}

export function validateCsrf(req: NextRequest): boolean {
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get(CSRF_HEADER)
  if (!cookieToken || !headerToken) return false
  return timingSafeEqual(cookieToken, headerToken)
}

export function csrfError(): NextResponse {
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
}
