import { Webhook } from 'standardwebhooks';

import { normalizeAuthPhone } from './phone';
import type { OtpLocale } from './types';

export class HookAuthError extends Error {
  constructor(message = 'Invalid hook signature') {
    super(message);
    this.name = 'HookAuthError';
  }
}

export class HookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookPayloadError';
  }
}

export interface SendSmsHookPayload {
  /** E.164 with leading "+". */
  phone: string;
  code: string;
  locale: OtpLocale;
}

/** Supabase shows hook secrets as `v1,whsec_<base64>`; standardwebhooks wants only the base64 part. */
export function normalizeHookSecret(secret: string): string {
  return secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
}

/**
 * Verify the standard-webhooks signature of a Supabase Auth hook call and parse the Send SMS payload.
 * `rawBody` must be the exact request text (do not re-serialize JSON).
 */
export function verifySendSmsHook(rawBody: string, headers: Headers, secret: string): SendSmsHookPayload {
  const wh = new Webhook(normalizeHookSecret(secret));
  let data: unknown;
  try {
    data = wh.verify(rawBody, {
      'webhook-id': headers.get('webhook-id') ?? '',
      'webhook-timestamp': headers.get('webhook-timestamp') ?? '',
      'webhook-signature': headers.get('webhook-signature') ?? '',
    });
  } catch {
    throw new HookAuthError();
  }

  const payload = data as { user?: { phone?: unknown; user_metadata?: { locale?: unknown } }; sms?: { otp?: unknown } } | null;
  const rawPhone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (typeof rawPhone !== 'string') throw new HookPayloadError('user.phone missing');
  if (typeof otp !== 'string' || !/^\d{4,10}$/.test(otp)) throw new HookPayloadError('sms.otp missing or malformed');
  const phone = normalizeAuthPhone(rawPhone);
  if (!phone) throw new HookPayloadError('user.phone is not a valid E.164 number');
  const locale: OtpLocale = payload?.user?.user_metadata?.locale === 'en' ? 'en' : 'ar';
  return { phone, code: otp, locale };
}
