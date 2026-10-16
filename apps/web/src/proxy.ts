import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { DATA_MODE } from './lib/data-mode';
import { botGuard } from './server/bot-guard';
import { hiddenRouteRedirect } from './lib/hidden-routes';
import { withSession } from './lib/supabase/proxy';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Turns away crawlers and scrapers (server/bot-guard.ts), sends hidden screens to the app, refreshes
// the Supabase session cookies, then lets next-intl handle locale routing.
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // The crawl rules themselves stay readable for everyone, so bots can see they're asked to stay out.
  const rules = path === '/robots.txt' || path.startsWith('/.well-known/');
  if (!rules) {
    const denied = await botGuard().check(request);
    if (denied) return denied;
  }
  // API routes and files (art, icons, manifest...) only pass the guard; they need no locale or session.
  if (rules || path.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(path)) return NextResponse.next();

  const to = hiddenRouteRedirect(path, { mode: DATA_MODE, production: process.env.NODE_ENV === 'production' });
  if (to) return NextResponse.redirect(new URL(to, request.url));
  return withSession(request, intl);
}

export const config = {
  // Everything except Next's own build files: the bot guard covers pages, API routes and public files.
  matcher: ['/((?!_next/static|_next/image|_next/webpack-hmr|_vercel).*)'],
};
