import type { CareerPage } from '@/features/careers/types';

import { RAW_CAREER_PAGES } from './pages.generated';

const pages = RAW_CAREER_PAGES as unknown as Record<string, CareerPage>;

/** The authored page for a career, or undefined while the career has no page yet. */
export const getCareerPage = (id: string): CareerPage | undefined => pages[id];

export const careerPageIds = (): string[] => Object.keys(pages);
