import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@anabokra/engine', '@anabokra/content', '@anabokra/ai'],
  async headers() {
    // Every response says "no AI training or text-and-data mining" (TDMRep: public/.well-known/tdmrep.json).
    const noAi = [
      { key: 'X-Robots-Tag', value: 'noai, noimageai' },
      { key: 'tdm-reservation', value: '1' },
    ];
    // The app's own screens are never for search engines either (their data is on the phone).
    const appOnly = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noai, noimageai' }];
    return [
      { source: '/:path*', headers: noAi },
      { source: '/:locale(ar|en)/:area(journey|assessment|admin|dev|consent|explore)/:path*', headers: appOnly },
      { source: '/:locale(ar|en)/:area(journey|assessment|admin|dev|consent|explore)', headers: appOnly },
      // Phones must always check for a new service worker (src/app/sw.js).
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

export default withNextIntl(nextConfig);
