import { describe, expect, it } from 'vitest';

import { PhoneVerifier, VerifyFailure, type VerifyError } from './phone-verifier';
import { ConsoleSmsSender } from './sms';

function setup(overrides: Partial<ConstructorParameters<typeof PhoneVerifier>[0]> = {}) {
  let t = 1_000_000;
  const sms = new ConsoleSmsSender();
  const v = new PhoneVerifier({ sms, now: () => t, secret: 'test', ...overrides });
  const codeOf = () => sms.sent.at(-1)!.text.match(/\d{6}/)![0];
  return { v, sms, codeOf, advance: (ms: number) => (t += ms) };
}

async function err(p: Promise<unknown> | (() => unknown)): Promise<VerifyError | 'no_error'> {
  try {
    await (typeof p === 'function' ? p() : p);
    return 'no_error';
  } catch (e) {
    if (e instanceof VerifyFailure) return e.code;
    throw e;
  }
}

describe('PhoneVerifier', () => {
  it('sends a code and confirms it, returning only the last 3 digits', async () => {
    const { v, sms, codeOf } = setup();
    const { requestId, last3 } = await v.request('0101 234 5678', 'ar', '1.1.1.1');
    expect(last3).toBe('678');
    expect(sms.sent[0]!.phone).toBe('+201012345678');
    expect(sms.sent[0]!.text).toContain('أنا بكرة');
    expect(v.confirm(requestId, codeOf())).toMatchObject({ last3: '678' });
    expect(v.size).toBe(0);
  });

  it('keeps no phone number in a pending check', async () => {
    const { v } = setup();
    const { requestId } = await v.request('01012345678', 'en', 'ip');
    const stored = JSON.stringify((v as unknown as { pending: Map<string, unknown> }).pending.get(requestId));
    expect(stored).not.toContain('1012345678');
    expect(stored).not.toContain('01012345678');
  });

  it('rejects a wrong code, then locks after too many attempts', async () => {
    const { v } = setup({ maxAttempts: 2 });
    const { requestId } = await v.request('01012345678', 'en', 'ip');
    expect(await err(() => v.confirm(requestId, '000000'))).toBe('invalid_code');
    expect(await err(() => v.confirm(requestId, '000001'))).toBe('invalid_code');
    expect(await err(() => v.confirm(requestId, '000002'))).toBe('too_many_attempts');
    expect(await err(() => v.confirm(requestId, '000003'))).toBe('expired');
  });

  it('expires codes after 10 minutes', async () => {
    const { v, codeOf, advance } = setup();
    const { requestId } = await v.request('01012345678', 'en', 'ip');
    advance(10 * 60 * 1000 + 1);
    expect(await err(() => v.confirm(requestId, codeOf()))).toBe('expired');
  });

  it('rate-limits per number and refuses invalid numbers', async () => {
    const { v } = setup({ perPhonePerHour: 2 });
    await v.request('01012345678', 'en', 'a');
    await v.request('+201012345678', 'en', 'b');
    expect(await err(v.request('01012345678', 'en', 'c'))).toBe('rate_limited');
    expect(await err(v.request('12345', 'en', 'd'))).toBe('invalid_phone');
  });

  it('refuses to send when no SMS provider is configured', async () => {
    const { v } = setup({ sms: null });
    expect(await err(v.request('01012345678', 'en', 'ip'))).toBe('sms_unavailable');
  });
});
