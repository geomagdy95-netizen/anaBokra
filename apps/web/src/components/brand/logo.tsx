import { cn } from '@/lib/utils';

const MARK =
  'M164.724 77.0248L445.123 126.645C462.926 130.462 471.828 141.913 471.828 160.998V464.446C471.828 479.714 464.198 487.348 448.938 487.348C436.221 487.348 429.863 479.714 429.863 464.446V185.808C429.863 170.54 421.597 164.815 405.066 168.632L246.745 210.618C226.399 215.708 216.226 226.522 216.226 243.062V378.565C216.226 397.649 226.399 409.736 246.745 414.826L394 464.446L164.724 512.158C141.834 518.52 130.389 508.977 130.389 483.531V109.469C130.389 84.0225 141.834 73.2078 164.724 77.0248Z';

/** The anaBokra mark (the door with the orange half-sun). Decorative unless a label is given. */
export function LogoMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg viewBox="120 66 362 460" className={cn('h-8 w-auto', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path fill="#360847" d={MARK} />
      <path fill="#FB9D5D" d="M408 208C253.333 208 253.333 429 408 429V208Z" />
    </svg>
  );
}

/**
 * The full lockup in the page language: «أنا بكرة» in Arabic, "anaBokra" in English
 * (public/brand/anabokra-{ar,en}.svg, from the founder's files with the background removed).
 */
export function Logo({ locale, className }: { locale: 'ar' | 'en'; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG; next/image adds nothing here
    <img src={`/brand/anabokra-${locale}.svg`} alt={locale === 'ar' ? 'أنا بكرة' : 'anaBokra'} className={cn('h-10 w-auto', className)} />
  );
}
