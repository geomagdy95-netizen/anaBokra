import { describe, expect, it } from 'vitest';

import { classifyAgent, HONEYPOT_PATH } from '@/lib/bots';

import { BotGuard, guardConfig } from './bot-guard';

const CHROME = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const req = (path: string, ua = CHROME, ip = '10.0.0.1') => ({ nextUrl: new URL(`https://anabokra.test${path}`), headers: new Headers({ 'user-agent': ua, 'x-forwarded-for': ip }) });

describe('classifyAgent', () => {
  it('tells AI crawlers, scrapers, search engines and browsers apart', () => {
    expect(classifyAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toBe('ai');
    expect(classifyAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe('ai');
    expect(classifyAgent('CCBot/2.0 (https://commoncrawl.org/faq/)')).toBe('ai');
    expect(classifyAgent('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot-Extended)')).toBe('ai');
    expect(classifyAgent('python-requests/2.32.3')).toBe('scraper');
    expect(classifyAgent('Mozilla/5.0 HeadlessChrome/129.0.0.0 Safari/537.36')).toBe('scraper');
    expect(classifyAgent('')).toBe('scraper');
    expect(classifyAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('search');
    expect(classifyAgent(CHROME)).toBe('other');
  });
});

describe('BotGuard', () => {
  const on = { enabled: true, perMinute: 60, allow: [] };

  it('lets browsers and search engines through and turns AI crawlers and scrapers away', async () => {
    const g = new BotGuard(on);
    expect(await g.check(req('/ar/careers/pharmacist'))).toBeNull();
    expect(await g.check(req('/ar', 'Mozilla/5.0 (compatible; Googlebot/2.1)'))).toBeNull();
    const ai = await g.check(req('/ar/careers/pharmacist', 'GPTBot/1.2'));
    expect(ai?.status).toBe(403);
    expect(await ai?.text()).toMatch(/AI systems/);
    expect((await g.check(req('/api/stats', 'python-requests/2.32')))?.status).toBe(403);
  });

  it('blocks an IP for a day once it follows the honeypot', async () => {
    let now = 0;
    const g = new BotGuard(on, () => now);
    expect((await g.check(req(HONEYPOT_PATH, CHROME, '9.9.9.9')))?.status).toBe(404);
    expect((await g.check(req('/ar', CHROME, '9.9.9.9')))?.status).toBe(403);
    expect(await g.check(req('/ar', CHROME, '8.8.8.8'))).toBeNull();
    now += 25 * 60 * 60 * 1000;
    expect(await g.check(req('/ar', CHROME, '9.9.9.9'))).toBeNull();
  });

  it('rate-limits pages per IP but not static files', async () => {
    const g = new BotGuard({ ...on, perMinute: 60 }, () => 1000);
    for (let i = 0; i < 60; i++) expect(await g.check(req(`/ar/careers/c${i}`))).toBeNull();
    const limited = await g.check(req('/ar/careers/one-more'));
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('retry-after')).toBeTruthy();
    expect(await g.check(req('/art/tasks/health/day.webp'))).toBeNull();
  });

  it('is off in development unless asked, and honours the allow list', async () => {
    expect(guardConfig({ NODE_ENV: 'development' }).enabled).toBe(false);
    expect(guardConfig({ NODE_ENV: 'production' }).enabled).toBe(true);
    expect(guardConfig({ NODE_ENV: 'production', BOT_GUARD: 'off' }).enabled).toBe(false);
    expect(guardConfig({ NODE_ENV: 'development', BOT_GUARD: 'on' }).enabled).toBe(true);
    const g = new BotGuard({ ...on, allow: ['uptimerobot'] });
    expect(await g.check(req('/ar', 'Mozilla/5.0+(compatible; UptimeRobot/2.0; curl/8.0)'))).toBeNull();
    expect(await new BotGuard({ ...on, enabled: false }).check(req('/ar', 'GPTBot'))).toBeNull();
  });
});
