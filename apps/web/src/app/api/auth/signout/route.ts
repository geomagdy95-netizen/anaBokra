import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { apiError, sameOrigin } from '@/server/auth/http';
import { parseLocale } from '@/server/auth/roles';

export const runtime = 'nodejs';

/** Sign out (form POST from the account page) and return to the login screen. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiError('forbidden');
  const form = await request.formData().catch(() => null);
  const locale = parseLocale(form?.get('locale'));
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(`/${locale}/login`, request.url), 303);
}
