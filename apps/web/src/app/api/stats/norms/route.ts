import { NextResponse } from 'next/server';

import { getStatsService } from '@/server/stats/service';

export const runtime = 'nodejs';

/**
 * How many players got each game score, per age band and overall (docs/product/games.md). Counts
 * only, built from anonymous opt-in scores: phones compare a player's score against it themselves.
 */
export async function GET() {
  try {
    const norms = await (await getStatsService()).norms();
    return NextResponse.json({ v: 1, norms }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return NextResponse.json({ v: 1, norms: {} }, { status: 503 });
  }
}
