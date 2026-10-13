import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { DATA_MODE } from './lib/data-mode';
import { hiddenRouteRedirect } from './lib/hidden-routes';
import { withSession } from './lib/supabase/proxy';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Sends hidden screens to the app, refreshes the Supabase session cookies, then lets next-intl handle
// locale routing.
export default function proxy(request: NextRequest) {
  const to = hiddenRouteRedirect(request.nextUrl.pathname, { mode: DATA_MODE, production: process.env.NODE_ENV === 'production' });
  if (to) return NextResponse.redirect(new URL(to, request.url));
  return withSession(request, intl);
}

export const config = {
  // Skip API routes, Next internals, and any path with a file extension (icons, manifest, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
