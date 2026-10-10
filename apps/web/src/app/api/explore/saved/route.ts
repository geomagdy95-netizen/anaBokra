import { NextResponse } from 'next/server';
import { z } from 'zod';

import { refExists } from '@/features/explore/saved-ref';
import { sameOrigin } from '@/server/auth/http';
import { withSaved, type SavedStoreFailure } from '@/server/explore/saved';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<SavedStoreFailure, number> = { unauthenticated: 401, consent_required: 403, not_found: 404, unavailable: 503 };
const body = z.object({ ref: z.string().min(3).max(160) });
const NO_STORE = { 'cache-control': 'private, no-store' };

const fail = (code: SavedStoreFailure) => NextResponse.json({ ok: false, error: code }, { status: STATUS[code], headers: NO_STORE });

async function mutate(request: Request, op: 'add' | 'remove') {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const { ref } = parsed.data;
  if (op === 'add' && !refExists(ref)) return fail('not_found');

  const res = await withSaved(async (store) => {
    if (op === 'add') await store.add(ref);
    else await store.remove(ref);
    return store.list();
  });
  return res.ok ? NextResponse.json({ ok: true, saved: res.value }, { headers: NO_STORE }) : fail(res.code);
}

export const POST = (request: Request) => mutate(request, 'add');
export const DELETE = (request: Request) => mutate(request, 'remove');
