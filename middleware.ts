import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { setCsrfCookie, validateCsrf } from '@/lib/csrf';

// Security headers applied to every response
const SCRIPT_SRC =
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const SECURITY_HEADERS = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    SCRIPT_SRC,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

const { auth } = NextAuth(authConfig);

export default auth(async function middleware(req: NextRequest & { auth: Session | null }) {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // --- RBAC: Admin-only routes ---
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    if (session.user?.role !== 'ADMIN') {
      const dashboardUrl = new URL('/dashboard?error=unauthorized', req.url);
      return applySecurityHeaders(NextResponse.redirect(dashboardUrl));
    }
  }

  // --- Protected routes: require any authenticated user ---
  let hasBearerToken = false;
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/v1')) {
    // Public: warehouses GET (needed for signup)
    const isPublicWarehousesGet = pathname === '/api/v1/warehouses' && req.method === 'GET';

    // API key auth: allow Bearer token to bypass session check for API routes
    const isApiRoute = pathname.startsWith('/api/v1');
    hasBearerToken =
      isApiRoute && !!req.headers.get('authorization')?.startsWith('Bearer sp_live_');

    if (!isPublicWarehousesGet && !hasBearerToken && !session) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    const needsWarehouse = session?.user?.role === 'OPERATOR' && !session.user.warehouseId;
    const needsPassword = session?.user && !session.user.passwordSetAt;
    if (
      (needsWarehouse || needsPassword) &&
      !isApiRoute &&
      pathname !== '/auth/setup' &&
      !pathname.startsWith('/auth/')
    ) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/auth/setup', req.url)));
    }
  }

  // CSRF check for mutating v1 API routes (only for cookie-based auth, skip Bearer token)
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (pathname.startsWith('/api/v1') && isMutating && !hasBearerToken && session) {
    if (!validateCsrf(req)) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
  }

  // Apply security headers to all responses
  const response = NextResponse.next();
  return applySecurityHeaders(setCsrfCookie(response));
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/|api/auth).*)'],
};
