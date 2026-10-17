import jwt from 'jsonwebtoken';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'gt-international-academy-jwt-secret-key-2026';
const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET_STRING);

export const AUTH_COOKIE_NAME = 'gt_session_token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Creates a signed JWT for the authenticated user session (valid for 7 days)
 */
export function createToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET_STRING, { expiresIn: '7d' });
}

/**
 * Synchronous token verification for Node.js API handlers
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET_STRING) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Edge-compatible asynchronous token verification for Next.js Middleware
 */
export async function verifyEdgeToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES);
    if (!payload || !payload.id || !payload.email) return null;
    return {
      id: String(payload.id),
      name: String(payload.name || ''),
      email: String(payload.email),
      role: String(payload.role || 'ADMIN'),
    };
  } catch {
    return null;
  }
}

/**
 * Server-side helper to fetch currently authenticated user from session cookie
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true },
    });

    return user ? (user as AuthUser) : null;
  } catch {
    return null;
  }
}
