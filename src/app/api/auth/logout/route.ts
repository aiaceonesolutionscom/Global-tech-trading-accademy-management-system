import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    logger.activity(`User logged out: ${user.email} (${user.name})`, {
      userId: user.id,
      email: user.email,
    });
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear authentication cookie
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export async function GET() {
  return POST();
}
