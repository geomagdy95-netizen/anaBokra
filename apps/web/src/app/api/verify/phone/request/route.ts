import { NextResponse } from 'next/server';

import { apiError, sameOrigin } from '@/server/auth/http';
import { clientIp, verifier, verifyError } from '@/server/verify/http';

export const runtime = 'nodejs';

/** Parent phone check (consent-texts §1.3): sends a code. The number is not stored. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const body = (await request.json().catch(() => null)) as { phone?: unknown; locale?: unknown } | null;
  if (!body || typeof body.phone !== 'string') return apiError('invalid_phone');
  try {
    const out = await verifier().request(body.phone, body.locale === 'en' ? 'en' : 'ar', clientIp(request.headers));
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return verifyError(e);
  }
}
