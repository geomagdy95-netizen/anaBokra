import type { MetadataRoute } from 'next';

import { AI_BOTS, HONEYPOT_PATH } from '@/lib/bots';
import { siteUrl } from '@/server/careers/site';

/** Areas no crawler should enter: the app itself (data stays on the phone anyway), admin, dev, API. */
const PRIVATE = ['/admin', '/dev', '/journey', '/assessment', '/consent', '/explore'];
const privatePaths = ['/api/', ...PRIVATE.flatMap((p) => [p, `/ar${p}`, `/en${p}`])];

/**
 * Search engines may index the public pages (home, careers, legal); AI crawlers may not collect
 * anything. The proxy enforces the same rules for crawlers that ignore this file (server/bot-guard.ts),
 * and anything that follows the honeypot path is blocked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...AI_BOTS], disallow: '/' },
      { userAgent: '*', allow: '/', disallow: [...privatePaths, HONEYPOT_PATH] },
    ],
    host: siteUrl().origin,
  };
}
