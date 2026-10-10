import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { PublicShell } from '@/features/public/shell';
import { routing } from '@/i18n/routing';
import { SUPPORT_EMAIL } from '@/lib/site';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/schools'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Public.schools' });
  return { title: t('title'), description: t('intro') };
}

const BENEFITS = ['free', 'report', 'counselor', 'privacy'] as const;

/** A6 for schools: pilot offer and a demo request (email until a CRM/lead form exists). */
export default async function SchoolsPage({ params }: PageProps<'/[locale]/schools'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Public.schools');
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('mailSubject'))}&body=${encodeURIComponent(t('mailBody'))}`;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">{t('intro')}</p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((k) => (
            <li key={k} className="rounded-lg border p-5">
              <h2 className="mb-1 font-semibold">{t(`benefits.${k}.title`)}</h2>
              <p className="text-sm text-muted-foreground">{t(`benefits.${k}.body`)}</p>
            </li>
          ))}
        </ul>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t('howTitle')}</h2>
          <p className="text-muted-foreground">{t('howBody')}</p>
        </section>
        <Button asChild size="lg">
          <a href={mailto}>{t('cta')}</a>
        </Button>
      </div>
    </PublicShell>
  );
}
