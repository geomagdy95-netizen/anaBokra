import { NextResponse } from 'next/server';

import { clientIp } from '../otp/limits';
import { PhoneVerifier, VerifyFailure, getPhoneVerifier } from './phone-verifier';
import { smsSenderFromEnv } from './sms';

const STATUS: Record<VerifyFailure['code'], number> = {
  invalid_phone: 400,
  invalid_code: 400,
  expired: 410,
  too_many_attempts: 429,
  rate_limited: 429,
  sms_unavailable: 503,
  send_failed: 502,
};

export const verifier = () => getPhoneVerifier(() => new PhoneVerifier({ sms: smsSenderFromEnv() }));

export function verifyError(e: unknown) {
  if (!(e instanceof VerifyFailure)) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  const res = NextResponse.json({ ok: false, error: e.code, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }, { status: STATUS[e.code] });
  if (e.retryAfterSec) res.headers.set('retry-after', String(e.retryAfterSec));
  return res;
}

export { clientIp };
