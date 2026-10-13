import { routing } from '@/i18n/routing';

// Built once per `next build`: the stamp changes with every build, so phones pick up the new worker,
// which caches the new files and drops the old cache.
export const dynamic = 'force-static';

const VERSION = Date.now().toString(36);

// The app screens, cached when the worker installs so the app opens without internet. Anything else
// (a career page, a Verify path, lazy-loaded code such as the 3D map) is cached the first time it loads.
const APP_PAGES = ['/journey', '/journey/map', '/journey/saved', '/journey/account', '/assessment/result'];
const PRECACHE = routing.locales.flatMap((l) => APP_PAGES.map((p) => `/${l}${p}`));

/**
 * The service worker (phase 1 works offline once loaded, docs/gtm/pilot-plan.md):
 * - pages: network first (up to 4 s on a weak connection), then the cached copy;
 * - /_next/static (file names carry a hash): cache first;
 * - other files (icons, logo, manifest): cached copy at once, refreshed in the background;
 * - /api and Next's data requests for client navigation: never cached. Offline, a failed data
 *   request makes Next load the page itself, which then comes from the cache.
 */
const source = `
const VERSION = ${JSON.stringify(VERSION)};
const CACHE = 'anabokra-' + VERSION;
const PRECACHE = ${JSON.stringify(PRECACHE)};
const LOCALES = ${JSON.stringify(routing.locales)};
const NETWORK_TIMEOUT_MS = 4000;

const sameOrigin = (url) => url.origin === self.location.origin;
const isStatic = (url) => url.pathname.startsWith('/_next/static/');
const isData = (req, url) => req.headers.get('RSC') === '1' || url.searchParams.has('_rsc');

/** Script, style, font and preload URLs a page's HTML points to. */
function assetsIn(html) {
  const found = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\\/_next\\/static\\/[^"]+)"/g)) found.add(m[1]);
  return [...found];
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PRECACHE.map(async (path) => {
      try {
        const res = await fetch(path, { credentials: 'same-origin' });
        if (!res.ok || res.redirected) return;
        const html = await res.clone().text();
        await cache.put(path, res);
        await Promise.all(assetsIn(html).map((a) => cache.match(a).then((hit) => hit || cache.add(a)).catch(() => {})));
      } catch {
        // Offline while installing: the page is cached the first time it loads instead.
      }
    }),
  );
  await Promise.all(['/manifest.webmanifest', '/icons/icon-192.png', '/brand/anabokra-ar.svg', '/brand/anabokra-en.svg'].map((p) => cache.add(p).catch(() => {})));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('anabokra-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

const LAST_LOCALE = '/__anabokra-last-locale';
const localeOf = (url) => LOCALES.find((l) => url.pathname === '/' + l || url.pathname.startsWith('/' + l + '/'));

/**
 * Offline fallback for a page: the same page, then the same page without its query, then the app home
 * in the page's language (or the last one used: the installed app starts at /journey, no language).
 */
async function cachedPage(url) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(url.pathname + url.search)) || (await cache.match(url.pathname));
  if (hit) return hit;
  const last = await cache.match(LAST_LOCALE).then((r) => (r ? r.text() : null));
  const locale = localeOf(url) || (LOCALES.includes(last) ? last : LOCALES[0]);
  return cache.match('/' + locale + '/journey');
}

async function page(event, url) {
  const network = fetch(event.request);
  try {
    const res = await withTimeout(network, NETWORK_TIMEOUT_MS);
    if (res.ok && res.type === 'basic' && !res.redirected) {
      const copy = res.clone();
      const locale = localeOf(url);
      event.waitUntil(
        caches.open(CACHE).then((c) => Promise.all([c.put(url.pathname + url.search, copy), locale && c.put(LAST_LOCALE, new Response(locale))])),
      );
    }
    return res;
  } catch {
    const hit = await cachedPage(url);
    if (hit) return hit;
    return network; // nothing cached: let the browser show its own offline page
  }
}

async function staticFile(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()));
  return res;
}

async function otherFile(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request).then((res) => {
    if (res.ok && res.type === 'basic') return cache.put(event.request, res.clone()).then(() => res);
    return res;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url) || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') return event.respondWith(page(event, url));
  if (isData(req, url)) return;
  if (isStatic(url)) return event.respondWith(staticFile(event));
  event.respondWith(otherFile(event));
});
`;

export function GET() {
  return new Response(source, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
