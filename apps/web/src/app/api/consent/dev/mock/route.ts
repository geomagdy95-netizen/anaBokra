import { NextResponse } from 'next/server';

import { MOCK_OTP } from '@/server/consent/constants';
import { getMockOutbox, isConsentMock, MOCK_CLASS_CODE, MOCK_ROLE_COOKIE, MOCK_ROLES, resetConsentMock } from '@/server/consent/mock';
import { resetMock } from '@/server/assessment/mock';
import { sameOrigin } from '@/server/auth/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dev-only (ASSESSMENT_REPO=memory): outbox of WhatsApp messages (links!), the fake OTP and the class code. 404 elsewhere. */
export async function GET() {
  if (!isConsentMock()) return new NextResponse(null, { status: 404 });
  const outbox = getMockOutbox().sent.map((m) => ({ kind: m.kind, phone: m.phone, text: m.text }));
  return NextResponse.json({ ok: true, otp: MOCK_OTP, classCode: MOCK_CLASS_CODE, roles: MOCK_ROLES, outbox });
}

/** Form post: `role=student|parent|school_admin` switches the fake persona; `reset=1` wipes consent + assessment mock data. */
export async function POST(request: Request) {
  if (!isConsentMock()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData();
  const next = typeof form.get('next') === 'string' && String(form.get('next')).startsWith('/') && !String(form.get('next')).startsWith('//') ? String(form.get('next')) : '/';
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  if (form.get('reset') === '1') {
    resetMock();
    resetConsentMock();
  }
  const role = String(form.get('role') ?? '');
  if ((MOCK_ROLES as readonly string[]).includes(role)) res.cookies.set(MOCK_ROLE_COOKIE, role, { path: '/', sameSite: 'lax' });
  return res;
}
