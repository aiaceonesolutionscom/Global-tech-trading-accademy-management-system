import { NextResponse } from 'next/server';
import { getCurrentUser, AuthUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Enforces server-side authentication for API routes.
 * If user is not authenticated, logs a security warning and returns a 401 Unauthorized JSON response.
 * If user is authenticated, returns the verified AuthUser.
 */
export async function requireAuth(
  request?: Request
): Promise<{ user: AuthUser; errorResponse: null } | { user: null; errorResponse: NextResponse }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      const url = request ? new URL(request.url).pathname : 'unknown API';
      const ip = request ? request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown' : 'unknown';
      logger.security(`Unauthorized API request intercepted at ${url}`, { ip, path: url });

      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: 'Unauthorized access. Valid authenticated session required.' },
          { status: 401 }
        ),
      };
    }

    return { user, errorResponse: null };
  } catch (error) {
    logger.error('Session verification exception in requireAuth', error);
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized access. Session verification failed.' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Enforces role-based access control (e.g., ADMIN only)
 */
export async function requireRole(
  allowedRoles: string[],
  request?: Request
): Promise<{ user: AuthUser; errorResponse: null } | { user: null; errorResponse: NextResponse }> {
  const auth = await requireAuth(request);
  if (auth.errorResponse || !auth.user) {
    return auth;
  }

  if (!allowedRoles.includes(auth.user.role)) {
    const url = request ? new URL(request.url).pathname : 'unknown';
    logger.security(`Forbidden role access attempt at ${url}`, {
      userId: auth.user.id,
      userRole: auth.user.role,
      allowedRoles,
    });

    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Forbidden. You do not have permission to perform this action.' },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, errorResponse: null };
}

/**
 * Sanitizes server-side error responses so NO internal database schemas,
 * table structures, connection strings, or stack traces leak to the client DevTools / Inspect element.
 * Automatically logs the complete error with stack traces to logs/error.log.
 */
export function safeError(
  error: unknown,
  fallbackMessage = 'An unexpected server error occurred. Please contact administrator.'
): NextResponse {
  // Automatically write full error with stack trace to logs/error.log
  logger.error(fallbackMessage, error);

  // Return only a safe, sanitized message to the browser
  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  );
}

/**
 * Strips dangerous HTML / script tags from input strings to prevent XSS injection.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .trim();
}
