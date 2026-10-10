import type { Bilingual, Career, Cluster, IndustryTrend } from '@anabokra/content';

import type { CareerPage, Track } from './types';

/** What the browser, compare and favorites screens need per career. Small and serialisable. */
export interface CatalogItem {
  id: string;
  cluster: string;
  clusterName: Bilingual;
  name: Bilingual;
  holland: string;
  /** "none": the career has no authored page yet. */
  depth: 'full' | 'lite' | 'none';
  tracks: Track[] | null;
  trend: IndustryTrend | null;
  hasSalary: boolean;
  /** Highest monthly EGP figure across the published bands, for sorting. */
  salaryTop: number | null;
  studyYears: number | null;
}

export function salaryTopOf(page: CareerPage | undefined): number | null {
  const s = page?.marketEgypt?.salaryMonthlyEgp;
  if (!s) return null;
  const maxes = [s.junior, s.mid, s.senior].flatMap((b) => (b ? [b.max] : []));
  return maxes.length ? Math.max(...maxes) : null;
}

export function buildCatalog(
  careers: Pick<Career, 'id' | 'cluster' | 'name' | 'hollandCode'>[],
  clusters: Cluster[],
  pageOf: (id: string) => CareerPage | undefined,
  trendOf: (industryId: string) => IndustryTrend | null,
): CatalogItem[] {
  const clusterName = new Map(clusters.map((c) => [c.id, c.name]));
  return careers.map((c) => {
    const page = pageOf(c.id);
    const top = salaryTopOf(page);
    return {
      id: c.id,
      cluster: c.cluster,
      clusterName: clusterName.get(c.cluster) ?? { en: c.cluster, ar: c.cluster },
      name: c.name,
      holland: c.hollandCode,
      depth: page ? page.depth : 'none',
      tracks: page?.pathEgypt?.thanaweyaTracks ?? null,
      trend: trendOf(page?.industryId ?? c.cluster),
      hasSalary: top !== null,
      salaryTop: top,
      studyYears: page?.pathEgypt?.studyYears ?? null,
    };
  });
}

/** Lowest and highest published monthly figure across all bands, or null when the page has no salary data. */
export function salarySpan(page: CareerPage | undefined): { min: number; max: number } | null {
  const s = page?.marketEgypt?.salaryMonthlyEgp;
  if (!s) return null;
  const bands = [s.junior, s.mid, s.senior].flatMap((b) => (b ? [b] : []));
  if (bands.length === 0) return null;
  return { min: Math.min(...bands.map((b) => b.min)), max: Math.max(...bands.map((b) => b.max)) };
}
