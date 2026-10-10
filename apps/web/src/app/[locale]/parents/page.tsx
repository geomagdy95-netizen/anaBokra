import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { PublicShell } from '@/features/public/shell';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/parents'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Public.parents' });
  return { title: t('title'), description: t('intro') };
}

const SEES = ['strengths', 'careers', 'roadmap', 'progress'] as const;
const PRIVATE = ['answers', 'scores'] as const;

/** A5 for parents: what anaBokra does, what parents see, and the family-account route (consent route B). */
export default async function ParentsPage({ params }: PageProps<'/[locale]/parents'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Public.parents');

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">{t('intro')}</p>
        </header>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t('scienceTitle')}</h2>
          <p className="text-muted-foreground">{t('scienceBody')}</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-5">
            <h2 className="mb-2 font-semibold">{t('seesTitle')}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {SEES.map((k) => (
                <li key={k}>{t(`sees.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-5">
            <h2 className="mb-2 font-semibold">{t('privateTitle')}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {PRIVATE.map((k) => (
                <li key={k}>{t(`private.${k}`)}</li>
              ))}
            </ul>
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t('consentTitle')}</h2>
          <p className="text-muted-foreground">{t('consentBody')}</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login?next=/family">{t('cta')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/legal/privacy-policy">{t('privacyCta')}</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
      </div>
    </PublicShell>
  );
}
