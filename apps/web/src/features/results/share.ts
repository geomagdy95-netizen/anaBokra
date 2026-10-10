import type { ResultView } from './view';

export interface SharePrivacy {
  hideName: boolean;
  hideMatches: boolean;
}

export const SHARE_FORMATS = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
} as const;
export type ShareFormat = keyof typeof SHARE_FORMATS;
export const isShareFormat = (v: string): v is ShareFormat => v in SHARE_FORMATS;

/** Privacy is opt-out by default for matches only: the name is shown unless hidden. */
export const DEFAULT_PRIVACY: SharePrivacy = { hideName: false, hideMatches: false };

export function privacyQuery(p: SharePrivacy, locale: string): string {
  const q = new URLSearchParams({ locale });
  if (p.hideName) q.set('hideName', '1');
  if (p.hideMatches) q.set('hideMatches', '1');
  return q.toString();
}

export function parsePrivacy(sp: URLSearchParams): SharePrivacy {
  return { hideName: sp.get('hideName') === '1', hideMatches: sp.get('hideMatches') === '1' };
}

export interface ShareModel {
  /** First name only, or null when hidden / unknown. */
  name: string | null;
  hollandCode: string;
  /** Cluster of the best match, or null when matches are hidden. */
  topArea: string | null;
}

/** What may appear on the card. The privacy toggles are enforced here, so the image route cannot leak by mistake. */
export function buildShareModel(view: Pick<ResultView, 'hollandCode' | 'top'>, displayName: string | null, privacy: SharePrivacy): ShareModel {
  const first = displayName?.trim().split(/\s+/)[0] ?? '';
  return {
    name: privacy.hideName || !first ? null : first,
    hollandCode: view.hollandCode,
    topArea: privacy.hideMatches ? null : (view.top[0]?.cluster ?? null),
  };
}
