import 'server-only';

import { NextResponse } from 'next/server';

import { sameOrigin } from '@/server/auth/http';

import { getConsentRuntime, getPublicConsentService, resolveOrigin, type ConsentRole, type ConsentRuntime } from './runtime';
import type { ConsentService } from './service';
import { ConsentError, ERROR_STATUS, type ConsentErrorCode } from './types';

export function consentError(code: ConsentErrorCode, message?: string, details?: unknown) {
  const retry = (details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
  const res = NextResponse.json({ ok: false, error: code, ...(message && message !== code ? { message } : {}), ...(details !== undefined ? { details } : {}) }, { status: ERROR_STATUS[code] });
  if (retry) res.headers.set('retry-after', String(retry));
  return res;
}

async function readBody(request: Request, method: string): Promise<Record<string, unknown>> {
  if (method === 'GET') return {};
  const body = await request.json().catch(() => undefined);
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) throw new ConsentError('invalid_json');
  return body as Record<string, unknown>;
}

function respond(err: unknown) {
  if (err instanceof ConsentError) return consentError(err.code, err.message, err.details);
  console.error('[consent]', err instanceof Error ? err.message : err);
  return consentError('server_error');
}

/** Signed-in routes: same-origin check, session, optional role restriction, JSON body, uniform { ok, ... } envelope. */
export async function handleConsent(
  request: Request,
  opts: { method: 'GET' | 'POST'; roles?: ConsentRole[]; run: (h: { runtime: ConsentRuntime; body: Record<string, unknown> }) => Promise<unknown> },
) {
  try {
    if (opts.method !== 'GET' && !sameOrigin(request)) throw new ConsentError('forbidden');
    const runtime = await getConsentRuntime();
    if (!runtime) throw new ConsentError('unauthenticated');
    if (opts.roles && !opts.roles.includes(runtime.role)) throw new ConsentError('forbidden');
    const body = await readBody(request, opts.method);
    return NextResponse.json({ ok: true, ...((await opts.run({ runtime, body })) as object) });
  } catch (err) {
    return respond(err);
  }
}

/** Guardian (token) routes: no session needed. */
export async function handlePublic(
  request: Request,
  opts: { run: (h: { service: ConsentService; body: Record<string, unknown>; origin: string }) => Promise<unknown> },
) {
  try {
    if (!sameOrigin(request)) throw new ConsentError('forbidden');
    const body = await readBody(request, 'POST');
    const [service, origin] = await Promise.all([getPublicConsentService(), resolveOrigin()]);
    return NextResponse.json({ ok: true, ...((await opts.run({ service, body, origin })) as object) });
  } catch (err) {
    return respond(err);
  }
}

export const localeOf = (v: unknown): 'ar' | 'en' => (v === 'en' ? 'en' : 'ar');
