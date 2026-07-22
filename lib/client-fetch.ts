const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : undefined
}

export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getCookie(CSRF_COOKIE)
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set(CSRF_HEADER, token)
  }
  return fetch(input, { ...init, headers })
}
