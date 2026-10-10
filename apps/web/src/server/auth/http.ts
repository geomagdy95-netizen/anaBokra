import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_phone'
  | 'invalid_email'
  | 'invalid_code'
  | 'rate_limited'
  | 'send_failed'
  | 'forbidden'
  | 'server_error';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_json: 400,
  invalid_phone: 400,
  invalid_email: 400,
  invalid_code: 400,
  rate_limited: 429,
  send_failed: 502,
  forbidden: 403,
  server_error: 500,
};

export function apiError(code: ApiErrorCode, extra: { retryAfterSec?: number } = {}) {
  const res = NextResponse.json({ ok: false, error: code, ...extra }, { status: STATUS[code] });
  if (extra.retryAfterSec) res.headers.set('retry-after', String(extra.retryAfterSec));
  return res;
}

/** Reject cross-site browser POSTs (defence in depth on top of SameSite=Lax cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients (curl, tests)
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
