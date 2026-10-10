import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@anabokra/engine', '@anabokra/content', '@anabokra/ai'],
};

export default withNextIntl(nextConfig);
