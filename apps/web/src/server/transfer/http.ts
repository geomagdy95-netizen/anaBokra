import { NextResponse } from 'next/server';

import { RelayFailure } from './relay';

const STATUS = { too_large: 413, rate_limited: 429, not_found: 404, invalid: 400 } as const;

export function relayError(e: unknown) {
  if (!(e instanceof RelayFailure)) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  return NextResponse.json({ ok: false, error: e.code }, { status: STATUS[e.code], headers: e.retryAfterSec ? { 'retry-after': String(e.retryAfterSec) } : {} });
}
