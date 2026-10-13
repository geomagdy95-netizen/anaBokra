import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@anabokra/engine', '@anabokra/content', '@anabokra/ai'],
  async headers() {
    // Phones must always check for a new service worker (src/app/sw.js).
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
};

export default withNextIntl(nextConfig);
