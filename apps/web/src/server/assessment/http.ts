import { NextResponse } from 'next/server';

import { sameOrigin } from '@/server/auth/http';

import { AssessmentError, ERROR_STATUS } from './errors';
import { getAssessmentRuntime, type AssessmentRuntime } from './runtime';
import type { AssessmentService } from './service';

export function assessmentError(code: AssessmentError['code'], message?: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: code, ...(message ? { message } : {}), ...(details !== undefined ? { details } : {}) },
    { status: ERROR_STATUS[code] },
  );
}

interface Handler {
  userId: string;
  service: AssessmentService;
  runtime: AssessmentRuntime;
  body: unknown;
}

/**
 * Route-handler wrapper: same-origin check for writes, verified session (Auth server round trip),
 * JSON body parsing, and uniform `{ ok, ... }` / `{ ok: false, error, details? }` responses.
 */
export async function handleAssessment(
  request: Request,
  { method, run }: { method: 'GET' | 'POST' | 'PUT'; run: (h: Handler) => Promise<unknown> },
) {
  try {
    if (method !== 'GET' && !sameOrigin(request)) return assessmentError('forbidden');
    const runtime = await getAssessmentRuntime();
    if (!runtime) return assessmentError('unauthenticated');

    let body: unknown;
    if (method !== 'GET') {
      body = await request.json().catch(() => undefined);
      if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) return assessmentError('invalid_json');
    }

    const data = await run({ userId: runtime.userId, service: runtime.service, runtime, body });
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (err) {
    if (err instanceof AssessmentError) return assessmentError(err.code, err.message, err.details);
    console.error('[assessment]', err instanceof Error ? err.message : err);
    return assessmentError('server_error');
  }
}
