import { randomInt } from 'node:crypto';

import { createRateLimiter, type RateLimiter } from '../rate-limit';

/**
 * Relay for moving data between phones (consent-texts §1.5). It holds sealed bytes it cannot read
 * (the key never leaves the phones), in memory only, for at most 10 minutes, and hands them over once.
 */
export type RelayError = 'too_large' | 'rate_limited' | 'not_found' | 'invalid';

export class RelayFailure extends Error {
  constructor(
    readonly code: RelayError,
    readonly retryAfterSec?: number,
  ) {
    super(code);
  }
}

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const HOUR = 60 * 60 * 1000;

export interface RelayOptions {
  now?: () => number;
  ttlMs?: number;
  maxBytes?: number;
  createsPerIpPerHour?: number;
  claimsPerIpPerHour?: number;
}

export class TransferRelay {
  private items = new Map<string, { payload: string; expiresAt: number }>();
  private now: () => number;
  private ttlMs: number;
  private maxBytes: number;
  private creates: RateLimiter;
  private claims: RateLimiter;

  constructor(options: RelayOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000;
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    this.creates = createRateLimiter({ limit: options.createsPerIpPerHour ?? 10, windowMs: HOUR, now: this.now });
    this.claims = createRateLimiter({ limit: options.claimsPerIpPerHour ?? 30, windowMs: HOUR, now: this.now });
  }

  private sweep() {
    const t = this.now();
    for (const [code, item] of this.items) if (item.expiresAt <= t) this.items.delete(code);
  }

  async put(payload: unknown, ip: string): Promise<{ code: string; expiresInSec: number }> {
    this.sweep();
    if (typeof payload !== 'string' || payload.length === 0) throw new RelayFailure('invalid');
    if (payload.length > this.maxBytes) throw new RelayFailure('too_large');
    const limit = await this.creates.consume(`ip:${ip}`);
    if (!limit.allowed) throw new RelayFailure('rate_limited', limit.retryAfterSec);
    let code = '';
    do code = Array.from({ length: 8 }, () => B32[randomInt(32)]).join('');
    while (this.items.has(code));
    this.items.set(code, { payload, expiresAt: this.now() + this.ttlMs });
    return { code, expiresInSec: Math.round(this.ttlMs / 1000) };
  }

  /** Returns the payload once, then forgets it. */
  async take(rawCode: unknown, ip: string): Promise<string> {
    this.sweep();
    const limit = await this.claims.consume(`ip:${ip}`);
    if (!limit.allowed) throw new RelayFailure('rate_limited', limit.retryAfterSec);
    const code = typeof rawCode === 'string' ? rawCode.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1') : '';
    const item = this.items.get(code);
    if (!item) throw new RelayFailure('not_found');
    this.items.delete(code);
    return item.payload;
  }

  get size() {
    this.sweep();
    return this.items.size;
  }
}

const g = globalThis as typeof globalThis & { __transferRelay?: TransferRelay };
export function getTransferRelay(): TransferRelay {
  g.__transferRelay ??= new TransferRelay();
  return g.__transferRelay;
}
