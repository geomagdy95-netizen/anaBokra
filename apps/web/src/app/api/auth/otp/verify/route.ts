import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { apiError, isEmail, sameOrigin } from '@/server/auth/http';
import { ensureProfile } from '@/server/auth/profile';
import { parseLocale, parseRole, safeNextPath } from '@/server/auth/roles';
import { clientIp, getLimiters } from '@/server/otp/limits';
import { normalizePhone } from '@/server/otp/phone';

export const runtime = 'nodejs';

/** Verify the 6-digit code, set the session cookies, and make sure the profile row exists. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return apiError('invalid_json');

  const role = parseRole(body.role);
  const locale = parseLocale(body.locale);
  const channel = body.channel === 'email' ? 'email' : 'phone';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^\d{6}$/.test(token)) return apiError('invalid_code');

  let target: string;
  if (channel === 'phone') {
    const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
    if (!phone) return apiError('invalid_phone');
    target = phone;
  } else {
    if (!isEmail(body.email)) return apiError('invalid_email');
    target = body.email.trim().toLowerCase();
  }

  const limiters = getLimiters();
  const ip = await limiters.verifyIp.consume(`ip:${clientIp(request.headers)}`);
  if (!ip.allowed) return apiError('rate_limited', { retryAfterSec: ip.retryAfterSec });
  const who = await limiters.verifyTarget.consume(`${channel}:${target}`);
  if (!who.allowed) return apiError('rate_limited', { retryAfterSec: who.retryAfterSec });

  const supabase = await createClient();
  const { data, error } =
    channel === 'phone'
      ? await supabase.auth.verifyOtp({ phone: target, token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: target, token, type: 'email' });

  if (error || !data.user) {
    if (error && (error.status ?? 500) >= 500) {
      console.error(`[otp/verify] ${error.status} ${error.code ?? ''} ${error.message}`);
      return apiError('server_error');
    }
    return apiError('invalid_code');
  }

  let finalRole = role;
  try {
    const profile = await ensureProfile(data.user, role, locale);
    if (profile.role === 'student' || profile.role === 'parent') finalRole = profile.role;
  } catch (err) {
    // The DB trigger already created the profile; bootstrap problems must not lock the user out.
    console.error('[otp/verify] ensureProfile failed:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, role: finalRole, next: safeNextPath(body.next) });
}
