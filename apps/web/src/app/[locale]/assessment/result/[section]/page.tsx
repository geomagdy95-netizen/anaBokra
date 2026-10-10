import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { SectionDetail } from '@/features/results/section-detail';
import { genderedT } from '@/features/results/gendered';
import { buildProfileView, careersForSection, isSection, sectionItems } from '@/features/results/view';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { requireRuntime } from '@/server/assessment/page-data';

export const dynamic = 'force-dynamic';

/** E4: one page per dimension (holland, bigFive, values, abilities). */
export default async function ResultSectionPage({ params }: PageProps<'/[locale]/assessment/result/[section]'>) {
  const { locale, section } = await params;
  setRequestLocale(locale);
  if (!isSection(section)) notFound();
  const lang = locale as Locale;
  const t = await getTranslations('Results');

  const runtime = await requireRuntime(lang, `/assessment/result/${section}`);
  const [profile, result] = await Promise.all([runtime.profile(), runtime.service.getLatestResult(runtime.userId)]);
  const tr = (key: string) => genderedT(t as never, lang, profile.gender, key);

  return (
    <AssessmentProvider gender={profile.gender}>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/assessment/result" className="text-sm text-primary underline-offset-4 hover:underline">
            {tr('backToResults')}
          </Link>
          <LocaleSwitcher />
        </header>
        {result ? (
          <SectionDetail
            section={section}
            items={sectionItems(buildProfileView(result.scores), section)}
            suits={careersForSection(result.matches, section, lang)}
          />
        ) : (
          <p>{tr('notReady')}</p>
        )}
      </main>
    </AssessmentProvider>
  );
}
