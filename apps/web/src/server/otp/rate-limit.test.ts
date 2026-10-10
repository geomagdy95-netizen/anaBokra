import { describe, expect, it } from 'vitest';

import { createRateLimiter } from './rate-limit';

const HOUR = 3_600_000;

function limiter(limit = 5) {
  let t = 1_000_000;
  const rl = createRateLimiter({ limit, windowMs: HOUR, now: () => t });
  return { rl, advance: (ms: number) => (t += ms) };
}

describe('rate limiter', () => {
  it('allows up to the limit and then blocks', async () => {
    const { rl } = limiter(5);
    for (let i = 0; i < 5; i++) {
      const r = await rl.consume('+201012345678');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const blocked = await rl.consume('+201012345678');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(3600);
  });

  it('keys are independent', async () => {
    const { rl } = limiter(1);
    expect((await rl.consume('a')).allowed).toBe(true);
    expect((await rl.consume('a')).allowed).toBe(false);
    expect((await rl.consume('b')).allowed).toBe(true);
  });

  it('frees a slot when the oldest hit leaves the window (sliding)', async () => {
    const { rl, advance } = limiter(2);
    await rl.consume('k'); // t0
    advance(10 * 60_000);
    await rl.consume('k'); // t0 + 10m
    advance(10 * 60_000);
    const blocked = await rl.consume('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(40 * 60); // oldest expires in 40 min
    advance(40 * 60_000);
    expect((await rl.consume('k')).allowed).toBe(true);
  });

  it('rejected attempts do not extend the lockout', async () => {
    const { rl, advance } = limiter(1);
    await rl.consume('k');
    advance(30 * 60_000);
    await rl.consume('k'); // rejected
    await rl.consume('k'); // rejected
    advance(30 * 60_000);
    expect((await rl.consume('k')).allowed).toBe(true); // window of the first hit elapsed
  });
});
