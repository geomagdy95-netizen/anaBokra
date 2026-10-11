import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { clientIp } from '@/server/otp/limits';

import { getResearchService, ResearchFailure, type ResearchService } from './service';

const STATUS = {
  invalid: 400,
  unknown_event: 404,
  event_closed: 410,
  research_not_offered: 403,
  research_ended: 410,
  rate_limited: 429,
  store_failed: 503,
} as const;

/** Shared handler for the pilot and research routes: same-origin JSON in, `{ ok, ... }` out. */
export async function handleResearch(request: Request, run: (svc: ResearchService, body: unknown, ip: string) => Promise<Record<string, unknown> | void>) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = await request.json().catch(() => null);
  try {
    const out = await run(await getResearchService(), body, clientIp(request.headers));
    return NextResponse.json({ ok: true, ...(out ?? {}) });
  } catch (e) {
    if (!(e instanceof ResearchFailure)) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    const headers = e.retryAfterSec ? { 'retry-after': String(e.retryAfterSec) } : undefined;
    return NextResponse.json({ ok: false, error: e.code }, { status: STATUS[e.code], headers });
  }
}
