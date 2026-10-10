import { careers, programs, providers, universities, type Career } from '@anabokra/content';

import { getCareerPage } from '@/server/content/career-pages';

export type ContentIssue =
  | 'noPage'
  | 'litePage'
  | 'proxyProfile'
  | 'imputedData'
  | 'noSalary'
  | 'noPrograms'
  | 'fewSources'
  | 'stale';

export interface CareerHealth {
  id: string;
  name: { en: string; ar: string };
  cluster: string;
  depth: 'full' | 'lite' | null;
  lastReviewedAt: string | null;
  sources: number;
  issues: ContentIssue[];
}

export interface ContentHealth {
  careers: CareerHealth[];
  totals: {
    careers: number;
    fullPages: number;
    litePages: number;
    withSalary: number;
    universities: number;
    programs: number;
    programsWithScores: number;
    programsWithFees: number;
    providers: number;
    providersWithCost: number;
  };
  /** Count of careers per issue, for the summary chips. */
  issueCounts: Record<ContentIssue, number>;
}

/** Content older than this is flagged for re-review (spec: careers yearly, Tansik scores each summer). */
export const STALE_AFTER_DAYS = 365;

type PageLike = {
  depth?: 'full' | 'lite';
  lastReviewedAt?: string;
  sources?: unknown[];
  marketEgypt?: { salaryMonthlyEgp?: unknown | null };
  pathEgypt?: { programIds?: string[] };
};

export function careerHealth(career: Career, page: PageLike | undefined, now = new Date()): CareerHealth {
  const issues: ContentIssue[] = [];
  if (!page) issues.push('noPage');
  else if (page.depth === 'lite') issues.push('litePage');
  if (career.proxy) issues.push('proxyProfile');
  if (career.onet.some((o) => o.imputedFromRelated?.length)) issues.push('imputedData');
  if (page?.depth === 'full' && !page.marketEgypt?.salaryMonthlyEgp) issues.push('noSalary');
  if (page && !(page.pathEgypt?.programIds?.length)) issues.push('noPrograms');
  const sources = page?.sources?.length ?? 0;
  if (page && sources < 3) issues.push('fewSources');
  if (page?.lastReviewedAt) {
    const age = (now.getTime() - new Date(page.lastReviewedAt).getTime()) / 86_400_000;
    if (age > STALE_AFTER_DAYS) issues.push('stale');
  }
  return {
    id: career.id,
    name: career.name,
    cluster: career.cluster,
    depth: page?.depth ?? null,
    lastReviewedAt: page?.lastReviewedAt ?? null,
    sources,
    issues,
  };
}

export function contentHealth(now = new Date()): ContentHealth {
  const rows = careers.map((c) => careerHealth(c, getCareerPage(c.id) as PageLike | undefined, now));
  const issueCounts = Object.fromEntries(
    (['noPage', 'litePage', 'proxyProfile', 'imputedData', 'noSalary', 'noPrograms', 'fewSources', 'stale'] as ContentIssue[]).map((k) => [
      k,
      rows.filter((r) => r.issues.includes(k)).length,
    ]),
  ) as Record<ContentIssue, number>;
  return {
    careers: rows,
    issueCounts,
    totals: {
      careers: careers.length,
      fullPages: rows.filter((r) => r.depth === 'full').length,
      litePages: rows.filter((r) => r.depth === 'lite').length,
      withSalary: rows.filter((r) => r.depth === 'full' && !r.issues.includes('noSalary')).length,
      universities: universities.length,
      programs: programs.length,
      programsWithScores: programs.filter((p) => p.minScores.some((m) => m.kind === 'tansik-phase1-cutoff')).length,
      programsWithFees: programs.filter((p) => p.feesEgpPerYear?.value != null).length,
      providers: providers.length,
      providersWithCost: providers.filter((p) => (p as { cost?: unknown }).cost != null).length,
    },
  };
}
