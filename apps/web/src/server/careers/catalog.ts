import { careers, clusters, industryById, type IndustryTrend } from '@anabokra/content';

import { buildCatalog, type CatalogItem } from '@/features/careers/catalog';
import { getCareerPage } from '@/server/content/career-pages';

let cached: CatalogItem[] | undefined;

const trendOf = (industryId: string): IndustryTrend | null => industryById(industryId)?.outlook.trend ?? null;

/** Every career in the catalog with the facts the browser needs. Pure content, computed once per process. */
export function getCatalog(): CatalogItem[] {
  return (cached ??= buildCatalog(careers, clusters, getCareerPage, trendOf));
}
