import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AppShell } from '@/features/journey/app-shell';
import { markdownToHtml } from '@/features/public/markdown';
import { LEGAL_DOCS, PublicShell, type LegalDoc } from '@/features/public/shell';
import { routing } from '@/i18n/routing';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_DOCS.map((doc) => ({ locale, doc })));
}

const isDoc = (d: string): d is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(d);

/** Read at build time only (static pages), so the server never needs the docs folder at runtime. */
async function load(doc: LegalDoc, locale: string) {
  const file = path.join(process.cwd(), '../../docs/legal', `${doc}.${locale === 'en' ? 'en' : 'ar'}.md`);
  return markdownToHtml(await readFile(file, 'utf8'));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/legal/[doc]'>): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations({ locale, namespace: 'Public.shell' });
  return { title: t(`docs.${doc}`), robots: { index: false } };
}

/**
 * A8 legal pages, rendered from docs/legal (drafts until counsel review). Phase 1 opens them from
 * Account, so they sit in the app shell; back returns to the screen they were opened from.
 */
export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[doc]'>) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Public.shell');
  const html = await load(doc, locale);

  if (DATA_MODE === 'local')
    return (
      <AppShell tab="account" title={t(`docs.${doc}`)} back="/journey/account" backToPrevious testId="legal">
        {/* markdownToHtml escapes all text and only allows http(s)/mailto/# links. */}
        <article className="legal surface break-words" dangerouslySetInnerHTML={{ __html: html }} />
      </AppShell>
    );

  return (
    <PublicShell>
      <article className="legal mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold">{t(`docs.${doc}`)}</h1>
        {/* markdownToHtml escapes all text and only allows http(s)/mailto/# links. */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </PublicShell>
  );
}
