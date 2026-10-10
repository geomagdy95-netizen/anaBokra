/** Absolute base for canonical / hreflang URLs. Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}
