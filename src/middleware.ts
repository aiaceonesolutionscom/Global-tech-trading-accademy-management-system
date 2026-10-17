import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_COOKIE_NAME = 'gt_session_token';
const JWT_SECRET_STRING = process.env.JWT_SECRET || 'gt-international-academy-jwt-secret-key-2026';
const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET_STRING);

// Public API endpoints that don't require authentication
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
];

// Helper to verify token in Edge runtime
async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, images, favicons, Next.js internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files like .png, .ico, .svg
  ) {
    return NextResponse.next();
  }

  // 2. Allow public auth endpoints
  if (PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 3. Extract session token from cookie
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const sessionUser = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const isAuthenticated = !!sessionUser;

  // 4. If user is visiting /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Already logged in, redirect directly to dashboard
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
    // Not logged in, allow visiting login page
    return NextResponse.next();
  }

  // 5. If root path /
  if (pathname === '/') {
    const targetUrl = new URL(isAuthenticated ? '/dashboard' : '/login', request.url);
    return NextResponse.redirect(targetUrl);
  }

  // 6. Handle protected API routes
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized access. Authentication session required.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 7. Handle all dashboard routes (/dashboard, /students, /fee-bills, /payments, etc.)
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Add redirect param so user returns to the page after login
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
