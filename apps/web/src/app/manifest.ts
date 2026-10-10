import type { MetadataRoute } from 'next';

// Placeholder PWA manifest. No service worker yet. Not localized: Arabic is the default locale.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'أنا بكرة — anaBokra',
    short_name: 'أنا بكرة',
    description: 'اكتشف المهنة المناسبة ليك',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    background_color: '#fcfbf8',
    theme_color: '#0f766e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
