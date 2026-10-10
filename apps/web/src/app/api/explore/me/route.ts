import { NextResponse } from 'next/server';

import { loadExplorePersonal } from '@/server/explore/personal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's score context, top careers and saved items. Signed out => an empty, valid payload. Never cached. */
export async function GET() {
  return NextResponse.json({ ok: true, ...(await loadExplorePersonal()) }, { headers: { 'cache-control': 'private, no-store' } });
}
