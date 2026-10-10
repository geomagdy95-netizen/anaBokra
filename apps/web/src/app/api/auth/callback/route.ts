import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/server/auth/profile';
import { parseLocale, parseRole, safeNextPath } from '@/server/auth/roles';

export const runtime = 'nodejs';

/** OAuth (Google) PKCE return: exchange the code for a session, bootstrap the profile, go to the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const locale = parseLocale(searchParams.get('locale'));
  const role = parseRole(searchParams.get('role'));
  const next = safeNextPath(searchParams.get('next'));
  const failure = NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, origin));

  const code = searchParams.get('code');
  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error('[auth/callback] exchange failed:', error?.message);
    return failure;
  }

  try {
    await ensureProfile(data.user, role, locale);
  } catch (err) {
    console.error('[auth/callback] ensureProfile failed:', err instanceof Error ? err.message : err);
  }
  return NextResponse.redirect(new URL(`/${locale}${next}`, origin));
}
