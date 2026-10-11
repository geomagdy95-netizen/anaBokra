import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { clientIp } from '@/server/otp/limits';
import { relayError } from '@/server/transfer/http';
import { getTransferRelay } from '@/server/transfer/relay';

export const runtime = 'nodejs';

/** Old phone: leave sealed data for 10 minutes. The server can't read it. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as { payload?: unknown } | null;
  try {
    return NextResponse.json({ ok: true, ...(await getTransferRelay().put(body?.payload, clientIp(request.headers))) });
  } catch (e) {
    return relayError(e);
  }
}
