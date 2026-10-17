// In-memory sliding window rate limiter for brute-force protection
interface RateLimitRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries every 10 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.blockedUntil && record.blockedUntil < now) {
        rateLimitStore.delete(key);
      } else if (now - record.firstAttempt > 30 * 60 * 1000) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export interface RateLimitResult {
  isBlocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Checks if an identifier (e.g. IP or email) has exceeded rate limits.
 * Default: Max 5 failed attempts within 15 minutes window. Blocked for 15 minutes if exceeded.
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  blockDurationMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record) {
    return { isBlocked: false, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  // Check if currently blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { isBlocked: true, remainingAttempts: 0, retryAfterSeconds };
  }

  // If window expired, reset
  if (now - record.firstAttempt > windowMs) {
    rateLimitStore.delete(identifier);
    return { isBlocked: false, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, maxAttempts - record.count);
  return { isBlocked: false, remainingAttempts: remaining, retryAfterSeconds: 0 };
}

/**
 * Records a failed attempt for an identifier.
 */
export function recordFailedAttempt(
  identifier: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  blockDurationMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  let record = rateLimitStore.get(identifier);

  if (!record || now - record.firstAttempt > windowMs) {
    record = { count: 1, firstAttempt: now };
  } else {
    record.count += 1;
  }

  if (record.count >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
    rateLimitStore.set(identifier, record);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(blockDurationMs / 1000),
    };
  }

  rateLimitStore.set(identifier, record);
  return {
    isBlocked: false,
    remainingAttempts: Math.max(0, maxAttempts - record.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Resets failed attempt counter upon successful login.
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
