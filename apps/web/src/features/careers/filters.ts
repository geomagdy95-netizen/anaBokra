import type { IndustryTrend } from '@anabokra/content';

import type { CatalogItem } from './catalog';
import { matchesQuery } from './search';
import { MAX_COMPARE, type Locale, type Track } from './types';

export type SortKey = 'name' | 'fit' | 'study' | 'salary';

export interface Filters {
  query: string;
  cluster: string;
  track: Track | '';
  trend: IndustryTrend | '';
  hasSalary: boolean;
  /** Minimum fit %, 0 = off. Only meaningful when the user has a result. */
  minFit: number;
}

export const DEFAULT_FILTERS: Filters = { query: '', cluster: '', track: '', trend: '', hasSalary: false, minFit: 0 };

export function filterCatalog(items: CatalogItem[], f: Filters, fits: Record<string, number>): CatalogItem[] {
  return items.filter((it) => {
    if (f.query && !matchesQuery(f.query, it.name.en, it.name.ar, it.clusterName.en, it.clusterName.ar, it.holland)) return false;
    if (f.cluster && it.cluster !== f.cluster) return false;
    // A career without a page has no track information: it cannot satisfy a track filter.
    if (f.track && !(it.tracks && it.tracks.includes(f.track))) return false;
    if (f.trend && it.trend !== f.trend) return false;
    if (f.hasSalary && !it.hasSalary) return false;
    if (f.minFit > 0 && !((fits[it.id] ?? -1) >= f.minFit)) return false;
    return true;
  });
}

/** Missing values always sort last, whichever the direction. */
export function sortCatalog(items: CatalogItem[], key: SortKey, fits: Record<string, number>, locale: Locale): CatalogItem[] {
  const collator = new Intl.Collator(locale);
  const byName = (a: CatalogItem, b: CatalogItem) => collator.compare(a.name[locale], b.name[locale]);
  const numeric = (get: (i: CatalogItem) => number | null | undefined, dir: 1 | -1) => (a: CatalogItem, b: CatalogItem) => {
    const x = get(a);
    const y = get(b);
    if (x == null && y == null) return byName(a, b);
    if (x == null) return 1;
    if (y == null) return -1;
    return x === y ? byName(a, b) : (x - y) * dir;
  };
  const out = [...items];
  switch (key) {
    case 'fit':
      return out.sort(numeric((i) => fits[i.id], -1));
    case 'study':
      return out.sort(numeric((i) => i.studyYears, 1));
    case 'salary':
      return out.sort(numeric((i) => i.salaryTop, -1));
    default:
      return out.sort(byName);
  }
}

export type CompareToggle = { ids: string[]; added: boolean; blocked: boolean };

/** Add or remove a career from the compare selection. A fourth career is refused (blocked), never silently dropped. */
export function toggleCompare(ids: string[], id: string): CompareToggle {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), added: false, blocked: false };
  if (ids.length >= MAX_COMPARE) return { ids, added: false, blocked: true };
  return { ids: [...ids, id], added: true, blocked: false };
}

/** Parse ?ids=a,b,c: unknown ids dropped, duplicates removed, capped at MAX_COMPARE. */
export function parseCompareIds(raw: string | string[] | undefined, known: (id: string) => boolean): string[] {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const seen = new Set<string>();
  for (const part of text.split(',')) {
    const id = part.trim();
    if (id && known(id) && !seen.has(id)) seen.add(id);
  }
  return [...seen].slice(0, MAX_COMPARE);
}
