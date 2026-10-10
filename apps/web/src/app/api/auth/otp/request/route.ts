import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { apiError, isEmail, sameOrigin } from '@/server/auth/http';
import { parseLocale, parseRole } from '@/server/auth/roles';
import { clientIp, getLimiters } from '@/server/otp/limits';
import { maskPhone, normalizePhone } from '@/server/otp/phone';

export const runtime = 'nodejs';

/**
 * Ask Supabase Auth to send a one-time code: WhatsApp (phone) or email.
 * Normalizes the number, rate-limits per client IP and per phone/email, then calls Auth.
 * For phones Auth calls our Send SMS hook, which delivers over WhatsApp.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return apiError('invalid_json');

  const role = parseRole(body.role);
  const locale = parseLocale(body.locale);
  const channel = body.channel === 'email' ? 'email' : 'phone';

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
  const ip = await limiters.requestIp.consume(`ip:${clientIp(request.headers)}`);
  if (!ip.allowed) return apiError('rate_limited', { retryAfterSec: ip.retryAfterSec });
  const who = await limiters.requestPhone.consume(`${channel}:${target}`);
  if (!who.allowed) return apiError('rate_limited', { retryAfterSec: who.retryAfterSec });

  const supabase = await createClient();
  const { error } =
    channel === 'phone'
      ? await supabase.auth.signInWithOtp({ phone: target, options: { channel: 'sms', data: { role, locale } } })
      : await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true, data: { role, locale } } });

  if (error) {
    console.error(`[otp/request] ${channel} send failed: ${error.status ?? '-'} ${error.code ?? ''} ${error.message}`);
    if (error.status === 429 || error.code === 'over_sms_send_rate_limit' || error.code === 'over_email_send_rate_limit') {
      return apiError('rate_limited', { retryAfterSec: 60 });
    }
    if ((error.status ?? 500) >= 500 || error.code?.startsWith('hook_')) return apiError('send_failed');
    return apiError('server_error');
  }

  return NextResponse.json({ ok: true, channel, target, masked: channel === 'phone' ? maskPhone(target) : target });
}
