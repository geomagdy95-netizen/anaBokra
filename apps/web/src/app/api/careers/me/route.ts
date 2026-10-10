import { NextResponse } from 'next/server';

import { loadPersonal } from '@/server/careers/personal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's own fit per career and favorites. Signed out => an empty, valid payload. Never cached. */
export async function GET() {
  const data = await loadPersonal();
  return NextResponse.json({ ok: true, ...data }, { headers: { 'cache-control': 'private, no-store' } });
}
