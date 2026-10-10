import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Refresh the Supabase session inside the proxy and let next-intl build the response.
 *
 * Order matters: refreshed cookies are written to the *request* first so the downstream
 * render sees them, then `respond()` (next-intl) builds the response, then the cookies are
 * copied onto that response so the browser stores them.
 */
export async function withSession(request: NextRequest, respond: (request: NextRequest) => NextResponse): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (!url || !key || !hasSession) return respond(request); // anonymous visitor: nothing to refresh

  let refreshed: { name: string; value: string; options: Parameters<NextResponse['cookies']['set']>[2] }[] = [];
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        refreshed = toSet;
        cacheHeaders = headers;
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
      },
    },
  });

  try {
    // Validates the JWT (and refreshes it when expired). Do not put code between createServerClient and this call.
    await supabase.auth.getClaims();
  } catch {
    // Never block navigation because the auth server is unreachable.
  }

  const response = respond(request);
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(cacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}
