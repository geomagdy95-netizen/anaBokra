import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { clientIp } from '@/server/otp/limits';
import { getStatsService, StatsFailure } from '@/server/stats/service';

export const runtime = 'nodejs';

const STATUS = { invalid: 400, rate_limited: 429, store_failed: 503 } as const;

/** One anonymous record: summary, checked path or results rating (consent-texts §1.6). Nothing identifying is accepted or logged. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = await request.json().catch(() => null);
  try {
    await (await getStatsService()).submit(body, clientIp(request.headers));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!(e instanceof StatsFailure)) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    return NextResponse.json({ ok: false, error: e.code }, { status: STATUS[e.code] });
  }
}
