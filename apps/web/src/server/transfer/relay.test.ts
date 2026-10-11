import { describe, expect, it } from 'vitest';

import { RelayFailure, TransferRelay, type RelayError } from './relay';

async function err(p: Promise<unknown>): Promise<RelayError | 'no_error'> {
  try {
    await p;
    return 'no_error';
  } catch (e) {
    if (e instanceof RelayFailure) return e.code;
    throw e;
  }
}

describe('TransferRelay', () => {
  it('hands a payload over once, by code (case and look-alikes forgiven)', async () => {
    const relay = new TransferRelay();
    const { code } = await relay.put('sealed-bytes', 'a');
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(await relay.take(`${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`, 'b')).toBe('sealed-bytes');
    expect(await err(relay.take(code, 'b'))).toBe('not_found');
    expect(relay.size).toBe(0);
  });

  it('forgets payloads after 10 minutes', async () => {
    let t = 0;
    const relay = new TransferRelay({ now: () => t });
    const { code } = await relay.put('x', 'a');
    t += 10 * 60 * 1000 + 1;
    expect(await err(relay.take(code, 'b'))).toBe('not_found');
  });

  it('refuses empty and oversized payloads, and rate-limits', async () => {
    const relay = new TransferRelay({ maxBytes: 10, createsPerIpPerHour: 1, claimsPerIpPerHour: 2 });
    expect(await err(relay.put('', 'a'))).toBe('invalid');
    expect(await err(relay.put('x'.repeat(11), 'a'))).toBe('too_large');
    await relay.put('ok', 'a');
    expect(await err(relay.put('ok', 'a'))).toBe('rate_limited');
    await err(relay.take('AAAAAAAA', 'z'));
    await err(relay.take('AAAAAAAA', 'z'));
    expect(await err(relay.take('AAAAAAAA', 'z'))).toBe('rate_limited');
  });
});
