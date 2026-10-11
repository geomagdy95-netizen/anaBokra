import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { createRateLimiter, type RateLimiter } from '../rate-limit';
import { normalizePhone } from '../otp/phone';
import { SmsUnavailableError, type SmsSender } from './sms';

/**
 * Verifies that a parent or guardian controls a phone number (consent-texts §1.3), without keeping
 * the number. A pending check holds only a hash of the code and the last 3 digits for display; rate
 * limits are keyed by a keyed hash of the number that the limiter forgets within the hour.
 */
export interface PendingCheck {
  codeHash: string;
  last3: string;
  expiresAt: number;
  attempts: number;
}

export type VerifyError = 'invalid_phone' | 'rate_limited' | 'sms_unavailable' | 'send_failed' | 'invalid_code' | 'expired' | 'too_many_attempts';

export class VerifyFailure extends Error {
  constructor(
    readonly code: VerifyError,
    readonly retryAfterSec?: number,
  ) {
    super(code);
  }
}

export interface VerifierOptions {
  sms: SmsSender | null;
  now?: () => number;
  /** Secret for hashing numbers in rate-limit keys. A random per-process secret is fine. */
  secret?: string;
  ttlMs?: number;
  maxAttempts?: number;
  perPhonePerHour?: number;
  perIpPerHour?: number;
}

const HOUR = 60 * 60 * 1000;

const text = (code: string, locale: 'ar' | 'en') =>
  locale === 'ar'
    ? `رمز التحقق لـ«أنا بكرة»: ${code}. لا تشاركه مع أحد. صالح لمدة 10 دقائق.`
    : `Your anaBokra verification code is ${code}. Don't share it. It expires in 10 minutes.`;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export class PhoneVerifier {
  private pending = new Map<string, PendingCheck>();
  private now: () => number;
  private secret: string;
  private ttlMs: number;
  private maxAttempts: number;
  private perPhone: RateLimiter;
  private perIp: RateLimiter;

  constructor(private readonly options: VerifierOptions) {
    this.now = options.now ?? Date.now;
    this.secret = options.secret ?? randomBytes(32).toString('hex');
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.perPhone = createRateLimiter({ limit: options.perPhonePerHour ?? 3, windowMs: HOUR, now: this.now });
    this.perIp = createRateLimiter({ limit: options.perIpPerHour ?? 20, windowMs: HOUR, now: this.now });
  }

  private sweep() {
    const t = this.now();
    for (const [id, p] of this.pending) if (p.expiresAt <= t) this.pending.delete(id);
  }

  /** Sends a code. The number is used for this call only and is not kept. */
  async request(rawPhone: string, locale: 'ar' | 'en', ip: string): Promise<{ requestId: string; last3: string; expiresInSec: number }> {
    this.sweep();
    const phone = typeof rawPhone === 'string' ? normalizePhone(rawPhone) : null;
    if (!phone) throw new VerifyFailure('invalid_phone');
    if (!this.options.sms) throw new VerifyFailure('sms_unavailable');
    const byIp = await this.perIp.consume(`ip:${ip}`);
    if (!byIp.allowed) throw new VerifyFailure('rate_limited', byIp.retryAfterSec);
    const byPhone = await this.perPhone.consume(`phone:${createHmac('sha256', this.secret).update(phone).digest('hex')}`);
    if (!byPhone.allowed) throw new VerifyFailure('rate_limited', byPhone.retryAfterSec);

    const requestId = randomBytes(16).toString('hex');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await this.options.sms.send(phone, text(code, locale));
    } catch (e) {
      throw new VerifyFailure(e instanceof SmsUnavailableError ? 'sms_unavailable' : 'send_failed');
    }
    const last3 = phone.slice(-3);
    this.pending.set(requestId, { codeHash: sha256(`${requestId}:${code}`), last3, expiresAt: this.now() + this.ttlMs, attempts: 0 });
    return { requestId, last3, expiresInSec: Math.round(this.ttlMs / 1000) };
  }

  /** Checks a code. On success the pending check is removed and only the last 3 digits are returned. */
  confirm(requestId: string, code: string): { last3: string; verifiedAt: string } {
    this.sweep();
    const p = typeof requestId === 'string' ? this.pending.get(requestId) : undefined;
    if (!p) throw new VerifyFailure('expired');
    if (p.attempts >= this.maxAttempts) {
      this.pending.delete(requestId);
      throw new VerifyFailure('too_many_attempts');
    }
    p.attempts += 1;
    const given = Buffer.from(sha256(`${requestId}:${String(code ?? '').trim()}`));
    if (!timingSafeEqual(given, Buffer.from(p.codeHash))) throw new VerifyFailure('invalid_code');
    this.pending.delete(requestId);
    return { last3: p.last3, verifiedAt: new Date(this.now()).toISOString() };
  }

  /** For tests: how many checks are waiting. */
  get size() {
    this.sweep();
    return this.pending.size;
  }
}

// One verifier per server process (survives dev hot reloads). Pending checks live in memory only.
const g = globalThis as typeof globalThis & { __phoneVerifier?: PhoneVerifier };

export function getPhoneVerifier(create: () => PhoneVerifier): PhoneVerifier {
  g.__phoneVerifier ??= create();
  return g.__phoneVerifier;
}
