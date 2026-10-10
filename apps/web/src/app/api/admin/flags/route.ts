import { NextResponse } from 'next/server';
import { z } from 'zod';

import { adminFor } from '@/server/admin/runtime';
import { sameOrigin } from '@/server/auth/http';

export const runtime = 'nodejs';

const Body = z.object({ key: z.string().regex(/^[a-z][a-z0-9_.]*$/).max(80), enabled: z.boolean() });

/** Toggle a feature flag (super_admin). Unknown callers get 404 like the admin pages. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const ctx = await adminFor('flags');
  if (!ctx) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  try {
    const flag = await ctx.repo.setFlag(parsed.data.key, parsed.data.enabled, ctx.userId);
    return NextResponse.json({ ok: true, flag });
  } catch (e) {
    const unknown = e instanceof Error && e.message === 'unknown_flag';
    return NextResponse.json({ ok: false, error: unknown ? 'unknown_flag' : 'server_error' }, { status: unknown ? 404 : 500 });
  }
}
