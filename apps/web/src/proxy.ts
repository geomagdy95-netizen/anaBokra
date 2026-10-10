import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { withSession } from './lib/supabase/proxy';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Refreshes the Supabase session cookies, then lets next-intl handle locale routing.
export default function proxy(request: NextRequest) {
  return withSession(request, intl);
}

export const config = {
  // Skip API routes, Next internals, and any path with a file extension (icons, manifest, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
