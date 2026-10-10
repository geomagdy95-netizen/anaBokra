import { NextResponse } from 'next/server';

import { getMockProfile, isMockMode, resetMock } from '@/server/assessment/mock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dev-only helper for mock mode (ASSESSMENT_REPO=memory): `?reset=1` wipes the in-memory data,
 * `?gender=female|male|none` sets the fake student's gender (drives Arabic feminine forms).
 * 404 everywhere else, including production.
 */
export async function GET(request: Request) {
  if (!isMockMode()) return new NextResponse(null, { status: 404 });
  const q = new URL(request.url).searchParams;
  const g = q.get('gender');
  const gender = g === 'female' || g === 'male' ? g : g === 'none' ? null : undefined;
  if (q.get('reset') === '1') resetMock(gender !== undefined ? { gender } : {});
  else if (gender !== undefined) getMockProfile().gender = gender;
  return NextResponse.json({ ok: true, profile: getMockProfile() });
}
