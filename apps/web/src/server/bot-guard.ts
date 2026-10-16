import { NextResponse } from 'next/server';

import { classifyAgent, HONEYPOT_PATH } from '@/lib/bots';

import { clientIp } from './otp/limits';
import { createRateLimiter, type RateLimiter } from './rate-limit';

/**
 * First line of the proxy: keeps crawlers and scrapers away from the app and its content.
 * - Declared AI crawlers and scraping tools get 403 (robots.txt already asks them to stay out).
 * - Anything that follows the hidden honeypot link (disallowed in robots.txt, invisible to people) is
 *   blocked by IP for a day.
 * - Every IP gets a generous request budget per minute; a whole class behind one university IP stays
 *   well under it, a scraper walking the site does not.
 * Memory only (one server process): no IP address is written anywhere (compliance-map §7).
 *
 * On in production; BOT_GUARD=off turns it off, BOT_GUARD=on turns it on in development.
 * BOT_RATE_PER_MIN sets the budget (default 600). BOT_ALLOW_UA lists comma-separated User-Agent
 * fragments to let through (e.g. an uptime monitor).
 */

const BLOCK_MS = 24 * 60 * 60 * 1000;

export interface GuardConfig {
  enabled: boolean;
  perMinute: number;
  allow: string[];
}

export function guardConfig(env: Record<string, string | undefined> = process.env): GuardConfig {
  const flag = env.BOT_GUARD?.toLowerCase();
  return {
    enabled: flag === 'on' || (flag !== 'off' && env.NODE_ENV === 'production'),
    perMinute: Math.max(60, Number(env.BOT_RATE_PER_MIN) || 600),
    allow: (env.BOT_ALLOW_UA ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

export class BotGuard {
  private readonly blocked = new Map<string, number>();
  private readonly limiter: RateLimiter;

  constructor(
    private readonly config: GuardConfig,
    private readonly now: () => number = Date.now,
  ) {
    this.limiter = createRateLimiter({ limit: config.perMinute, windowMs: 60_000, now });
  }

  /** A response that ends the request, or null to let it through. */
  async check(request: { headers: Headers; nextUrl: { pathname: string } }): Promise<NextResponse | null> {
    if (!this.config.enabled) return null;
    const path = request.nextUrl.pathname;
    const ua = request.headers.get('user-agent') ?? '';
    if (this.config.allow.some((a) => ua.toLowerCase().includes(a))) return null;
    const ip = clientIp(request.headers);
    const t = this.now();

    const until = this.blocked.get(ip);
    if (until && until > t) return deny(403, 'blocked');
    if (until) this.blocked.delete(ip);

    if (path === HONEYPOT_PATH || path.endsWith(HONEYPOT_PATH)) {
      this.blocked.set(ip, t + BLOCK_MS);
      // Look like an ordinary missing page, so the trap isn't obvious.
      return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex, nofollow' } });
    }

    const kind = classifyAgent(ua);
    if (kind === 'ai') return deny(403, 'ai');
    if (kind === 'scraper') return deny(403, 'scraper');

    // Static files (art, icons, fonts) don't count toward the budget; pages and API calls do.
    if (!/\.[a-z0-9]{2,5}$/i.test(path)) {
      const limit = await this.limiter.consume(`ip:${ip}`);
      if (!limit.allowed) return deny(429, 'rate', limit.retryAfterSec);
    }
    return null;
  }
}

function deny(status: 403 | 429, reason: 'ai' | 'scraper' | 'blocked' | 'rate', retryAfter?: number): NextResponse {
  const body =
    reason === 'ai'
      ? 'Automated collection of anaBokra content, including for training or grounding AI systems, is not permitted. See /robots.txt and the terms of use.'
      : reason === 'rate'
        ? 'Too many requests. Please slow down.'
        : 'Automated access is not permitted.';
  const headers: Record<string, string> = { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow, noai, noimageai' };
  if (retryAfter) headers['retry-after'] = String(retryAfter);
  return new NextResponse(body, { status, headers });
}

const g = globalThis as typeof globalThis & { __botGuard?: BotGuard };

/** The process-wide guard (one block list and budget per server process). */
export function botGuard(): BotGuard {
  g.__botGuard ??= new BotGuard(guardConfig());
  return g.__botGuard;
}
