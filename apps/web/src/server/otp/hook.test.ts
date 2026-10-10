import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { HookAuthError, HookPayloadError, normalizeHookSecret, verifySendSmsHook } from './hook';

const SECRET_B64 = Buffer.from('super-secret-signing-key-0123456789').toString('base64');
const SECRET = `v1,whsec_${SECRET_B64}`;

/** Sign exactly like Supabase / standard-webhooks: base64(HMAC_SHA256(secret, `${id}.${ts}.${body}`)). */
function signed(body: string, opts: { id?: string; ts?: number; secret?: string } = {}) {
  const id = opts.id ?? 'msg_123';
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const key = Buffer.from(normalizeHookSecret(opts.secret ?? SECRET), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return new Headers({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` });
}

const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    user: { id: 'u1', phone: '201012345678', user_metadata: { locale: 'ar', role: 'student' } },
    sms: { otp: '123456' },
    ...over,
  });

describe('verifySendSmsHook', () => {
  it('accepts a correctly signed call and extracts phone, code, locale', () => {
    const b = body();
    expect(verifySendSmsHook(b, signed(b), SECRET)).toEqual({ phone: '+201012345678', code: '123456', locale: 'ar' });
  });

  it('reads locale=en from user metadata', () => {
    const b = body({ user: { phone: '+201012345678', user_metadata: { locale: 'en' } } });
    expect(verifySendSmsHook(b, signed(b), SECRET).locale).toBe('en');
  });

  it('strips the v1,whsec_ prefix from the secret', () => {
    expect(normalizeHookSecret(SECRET)).toBe(SECRET_B64);
    expect(normalizeHookSecret(SECRET_B64)).toBe(SECRET_B64);
  });

  it('rejects a body that was tampered with', () => {
    const b = body();
    const h = signed(b);
    expect(() => verifySendSmsHook(body({ sms: { otp: '999999' } }), h, SECRET)).toThrow(HookAuthError);
  });

  it('rejects a signature made with another secret', () => {
    const b = body();
    const other = `v1,whsec_${Buffer.from('another-secret').toString('base64')}`;
    expect(() => verifySendSmsHook(b, signed(b, { secret: other }), SECRET)).toThrow(HookAuthError);
  });

  it('rejects missing headers', () => {
    expect(() => verifySendSmsHook(body(), new Headers(), SECRET)).toThrow(HookAuthError);
  });

  it('rejects stale timestamps (replay protection)', () => {
    const b = body();
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(() => verifySendSmsHook(b, signed(b, { ts: old }), SECRET)).toThrow(HookAuthError);
  });

  it('accepts when one of several space-separated signatures matches', () => {
    const b = body();
    const h = signed(b);
    h.set('webhook-signature', `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${h.get('webhook-signature')}`);
    expect(verifySendSmsHook(b, h, SECRET).code).toBe('123456');
  });

  it.each([
    ['missing otp', { sms: {} }],
    ['non-numeric otp', { sms: { otp: 'abcdef' } }],
    ['missing phone', { user: { user_metadata: {} } }],
    ['invalid phone', { user: { phone: '123' } }],
  ])('signed but malformed payload (%s) -> HookPayloadError', (_name, over) => {
    const b = body(over);
    expect(() => verifySendSmsHook(b, signed(b), SECRET)).toThrow(HookPayloadError);
  });
});
