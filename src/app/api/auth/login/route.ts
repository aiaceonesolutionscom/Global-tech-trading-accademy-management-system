import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit';
import { safeError } from '@/lib/security';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    // 1. Extract client IP for brute-force rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : request.headers.get('x-real-ip') || '127.0.0.1';

    // 2. Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (rateLimit.isBlocked) {
      const waitMinutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
      logger.security(`Brute-force login lockout triggered for IP: ${ip}`, {
        ip,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });

      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked for security. Please wait ${waitMinutes} minute(s).`,
        },
        { status: 429 }
      );
    }

    // 3. Parse and sanitize input
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Enforce basic length limits to prevent DoS payloads
    if (email.length > 100 || password.length > 100) {
      return NextResponse.json(
        { error: 'Invalid credentials format' },
        { status: 400 }
      );
    }

    // 4. Query user from database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const attempt = recordFailedAttempt(ip);
      logger.security(`Failed login attempt for non-existent user: ${email}`, {
        ip,
        email,
        remainingAttempts: attempt.remainingAttempts,
        isBlocked: attempt.isBlocked,
      });

      const remainingMsg = attempt.isBlocked
        ? 'Account temporarily locked for 15 minutes.'
        : `${attempt.remainingAttempts} attempt(s) remaining before lockout.`;
      return NextResponse.json(
        { error: `Invalid email or password. ${remainingMsg}` },
        { status: 401 }
      );
    }

    // 5. Verify hashed password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const attempt = recordFailedAttempt(ip);
      logger.security(`Failed password attempt for user: ${email}`, {
        ip,
        email,
        remainingAttempts: attempt.remainingAttempts,
        isBlocked: attempt.isBlocked,
      });

      const remainingMsg = attempt.isBlocked
        ? 'Account temporarily locked for 15 minutes.'
        : `${attempt.remainingAttempts} attempt(s) remaining before lockout.`;
      return NextResponse.json(
        { error: `Invalid email or password. ${remainingMsg}` },
        { status: 401 }
      );
    }

    // 6. Reset rate limiter on successful authentication
    resetRateLimit(ip);

    // 7. Generate session token
    const token = createToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // 8. Log successful activity
    logger.activity(`User logged in successfully: ${user.email} (${user.name})`, {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip,
    });

    // 9. Return response without leaking internal password hash or sensitive metadata
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Set secure HTTP-only cookie (JavaScript cannot access, protected against XSS theft)
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    return safeError(error, 'An error occurred during authentication');
  }
}
