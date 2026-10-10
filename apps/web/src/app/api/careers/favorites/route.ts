import { careerById } from '@anabokra/content';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { sameOrigin } from '@/server/auth/http';
import { withFavorites, type FavoritesFailure } from '@/server/careers/favorites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<FavoritesFailure, number> = { unauthenticated: 401, consent_required: 403, not_found: 404, unavailable: 503 };
const body = z.object({ careerId: z.string().min(1).max(100) });
const NO_STORE = { 'cache-control': 'private, no-store' };

const fail = (code: FavoritesFailure) => NextResponse.json({ ok: false, error: code }, { status: STATUS[code], headers: NO_STORE });

async function mutate(request: Request, op: 'add' | 'remove') {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const { careerId } = parsed.data;
  if (op === 'add' && !careerById(careerId)) return fail('not_found');

  const res = await withFavorites(async (store) => {
    if (op === 'add') await store.add(careerId);
    else await store.remove(careerId);
    return store.list();
  });
  return res.ok ? NextResponse.json({ ok: true, favorites: res.value }, { headers: NO_STORE }) : fail(res.code);
}

export const POST = (request: Request) => mutate(request, 'add');
export const DELETE = (request: Request) => mutate(request, 'remove');
