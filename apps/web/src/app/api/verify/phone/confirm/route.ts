import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { verifier, verifyError } from '@/server/verify/http';

export const runtime = 'nodejs';

/** Parent phone check: confirms the code. Returns only the last 3 digits of the number. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as { requestId?: unknown; code?: unknown } | null;
  if (!body || typeof body.requestId !== 'string' || typeof body.code !== 'string') return apiError('invalid_code');
  try {
    return NextResponse.json({ ok: true, ...verifier().confirm(body.requestId, body.code) });
  } catch (e) {
    return verifyError(e);
  }
}
