/**
 * Who is asking, from the User-Agent header. Used by robots.ts (what may crawl) and the proxy (who is
 * turned away). A User-Agent can be faked, so this only stops crawlers that say who they are; the
 * rate limit and the honeypot catch the ones that don't.
 */

/**
 * AI crawlers and AI fetchers (training, AI search and "browse for the user" agents), by the token
 * each company documents. Matched case-insensitively as a substring of the User-Agent.
 */
export const AI_BOTS = [
  // OpenAI
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  // Anthropic
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'Claude-Web',
  'anthropic-ai',
  // Google AI training (robots.txt token; Google-Extended never fetches pages itself)
  'Google-Extended',
  'Google-CloudVertexBot',
  'GoogleOther',
  // Apple AI training (robots.txt token)
  'Applebot-Extended',
  // Meta
  'meta-externalagent',
  'meta-externalfetcher',
  'FacebookBot',
  // Others
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'Diffbot',
  'YouBot',
  'AI2Bot',
  'Ai2Bot-Dolma',
  'DuckAssistBot',
  'MistralAI-User',
  'PanguBot',
  'Timpibot',
  'ImagesiftBot',
  'Omgilibot',
  'Omgili',
  'Webzio-Extended',
  'Kangaroo Bot',
  'iaskspider',
  'ISSCyberRiskCrawler',
  'Sidetrade indexer bot',
  'VelenPublicWebCrawler',
  'img2dataset',
  'FriendlyCrawler',
] as const;

/** Scraping libraries and tools that announce themselves (real browsers never send these). */
export const SCRAPER_PATTERNS: RegExp[] = [
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /httpx/i,
  /scrapy/i,
  /go-http-client/i,
  /java\//i,
  /okhttp/i,
  /libwww-perl/i,
  /php\//i,
  /node-fetch/i,
  /axios\//i,
  /undici/i,
  /\bhttrack\b/i,
  /\bwget\b/i,
  /\bcurl\//i,
  /colly/i,
  /phantomjs/i,
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /zgrab/i,
  /masscan/i,
  /\bnutch\b/i,
  /heritrix/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /dataforseobot/i,
  /blexbot/i,
];

/** Search engines that may index the public pages (they respect robots.txt). */
export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'YandexBot', 'Applebot', 'Baiduspider'] as const;

export type AgentKind = 'ai' | 'scraper' | 'search' | 'other';

const lower = (s: string) => s.toLowerCase();
const AI_LOWER = AI_BOTS.map(lower);
const SEARCH_LOWER = SEARCH_BOTS.map(lower);

/** Classifies a User-Agent. An empty one counts as a scraper (every real browser sends one). */
export function classifyAgent(ua: string | null | undefined): AgentKind {
  const s = lower(ua ?? '').trim();
  if (!s) return 'scraper';
  // AI first: some AI agents also contain a search engine's name (e.g. "Applebot-Extended").
  if (AI_LOWER.some((bot) => s.includes(bot))) return 'ai';
  if (SCRAPER_PATTERNS.some((re) => re.test(s))) return 'scraper';
  if (SEARCH_LOWER.some((bot) => s.includes(bot))) return 'search';
  return 'other';
}

/** Hidden link only a crawler that ignores robots.txt would follow (see robots.ts and the proxy). */
export const HONEYPOT_PATH = '/ab-trail';
