import { intEnv } from '../env';
import { createRateLimiter, type RateLimiter } from './rate-limit';

const HOUR = 60 * 60 * 1000;
const QUARTER = 15 * 60 * 1000;

interface Limiters {
  requestPhone: RateLimiter;
  requestIp: RateLimiter;
  hookPhone: RateLimiter;
  verifyTarget: RateLimiter;
  verifyIp: RateLimiter;
}

// Survive dev hot reloads so counters are not reset on every edit.
const g = globalThis as typeof globalThis & { __mxLimiters?: Limiters };

/**
 * - requestPhone / requestIp: "send me a code" calls through our own API (per phone/email, per client IP)
 * - hookPhone: last line of defence at the Send SMS hook (also covers callers that talk to Supabase Auth directly)
 * - verifyTarget / verifyIp: code guessing
 */
export function getLimiters(): Limiters {
  g.__mxLimiters ??= {
    requestPhone: createRateLimiter({ limit: intEnv('OTP_RATE_LIMIT_PHONE_PER_HOUR', 5), windowMs: HOUR }),
    requestIp: createRateLimiter({ limit: intEnv('OTP_RATE_LIMIT_IP_PER_HOUR', 20), windowMs: HOUR }),
    hookPhone: createRateLimiter({ limit: intEnv('OTP_RATE_LIMIT_PHONE_PER_HOUR', 5), windowMs: HOUR }),
    verifyTarget: createRateLimiter({ limit: intEnv('OTP_VERIFY_LIMIT_PER_15_MIN', 10), windowMs: QUARTER }),
    verifyIp: createRateLimiter({ limit: intEnv('OTP_VERIFY_IP_LIMIT_PER_15_MIN', 40), windowMs: QUARTER }),
  };
  return g.__mxLimiters;
}

/** Best-effort client IP. Assumes a trusted reverse proxy sets x-forwarded-for / x-real-ip. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return xff || headers.get('x-real-ip')?.trim() || 'unknown';
}
