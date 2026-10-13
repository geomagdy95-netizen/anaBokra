import type { DataMode } from './data-mode';
import { routing, type Locale } from '@/i18n/routing';

// Phase 2 or parked screens (docs/system/screens.md). Phase 1 keeps one career page, opened from the app.
const PHASE2 = [
  /^\/careers\/?$/,
  /^\/careers\/(compare|favorites)(\/|$)/,
  /^\/(explore|login|verify|account|ask-parent|school|schools|parents|consent|family|admin|try)(\/|$)/,
];
const DEV = /^\/dev(\/|$)/;

/**
 * Where a page request goes instead, or null to serve it. In phase 1 (local mode) the phase 2 screens
 * redirect to the app; developer pages are hidden from production builds in both modes.
 */
export function hiddenRouteRedirect(pathname: string, { mode, production }: { mode: DataMode; production: boolean }): string | null {
  const m = /^\/(ar|en)(?=\/|$)/.exec(pathname);
  const locale: Locale = (m?.[1] as Locale | undefined) ?? routing.defaultLocale;
  const rest = (m ? pathname.slice(m[0].length) : pathname) || '/';
  const hidden = (production && DEV.test(rest)) || (mode === 'local' && PHASE2.some((re) => re.test(rest)));
  return hidden ? `/${locale}/journey` : null;
}
