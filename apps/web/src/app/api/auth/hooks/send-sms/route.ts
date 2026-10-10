import { NextResponse } from 'next/server';

import { requireEnv } from '@/server/env';
import { getOtpSender, OtpSendError } from '@/server/otp';
import { HookAuthError, HookPayloadError, verifySendSmsHook } from '@/server/otp/hook';
import { getLimiters } from '@/server/otp/limits';

export const runtime = 'nodejs';

/** Supabase Auth hook error envelope: { error: { http_code, message } }. */
function hookError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { http_code: status, message } }, { status, headers });
}

/**
 * Supabase Auth "Send SMS" hook (HTTP). Supabase signs the call with standard-webhooks
 * (secret: SEND_SMS_HOOK_SECRETS). We deliver the OTP over WhatsApp via the configured OtpSender.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  let secret: string;
  try {
    secret = requireEnv('SEND_SMS_HOOK_SECRETS');
  } catch {
    console.error('[send-sms hook] SEND_SMS_HOOK_SECRETS is not configured');
    return hookError(500, 'Hook is not configured');
  }

  let payload;
  try {
    payload = verifySendSmsHook(raw, request.headers, secret);
  } catch (err) {
    if (err instanceof HookAuthError) return hookError(401, 'Invalid signature');
    if (err instanceof HookPayloadError) return hookError(400, err.message);
    throw err;
  }

  const limit = await getLimiters().hookPhone.consume(`phone:${payload.phone}`);
  if (!limit.allowed) {
    return hookError(429, 'Too many codes requested for this number', { 'retry-after': String(limit.retryAfterSec) });
  }

  try {
    await getOtpSender().send(payload);
  } catch (err) {
    // Log the cause (never the code); tell Supabase only that delivery failed.
    console.error('[send-sms hook] delivery failed:', err instanceof Error ? err.message : err);
    if (err instanceof OtpSendError && err.kind === 'config') return hookError(500, 'OTP sender is not configured');
    return hookError(502, 'Could not deliver the code');
  }

  return NextResponse.json({});
}
