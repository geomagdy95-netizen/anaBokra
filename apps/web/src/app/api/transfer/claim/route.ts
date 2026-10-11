import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { clientIp } from '@/server/otp/limits';
import { relayError } from '@/server/transfer/http';
import { getTransferRelay } from '@/server/transfer/relay';

export const runtime = 'nodejs';

/** New phone: collect the sealed data once; it is then gone from the server. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  try {
    return NextResponse.json({ ok: true, payload: await getTransferRelay().take(body?.code, clientIp(request.headers)) });
  } catch (e) {
    return relayError(e);
  }
}
