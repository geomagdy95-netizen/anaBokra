import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { HeroWorld } from '@/features/public/hero-world';
import { PublicShell } from '@/features/public/shell';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Public.landing' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { languages: { ar: '/ar', en: '/en', 'x-default': '/ar' } },
  };
}

const STEPS = ['discover', 'match', 'act'] as const;
const FAQ = ['science', 'time', 'cost', 'privacy', 'parents'] as const;

/** A1 landing page. */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Public.landing');

  return (
    <PublicShell>
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">{t('headline')}</h1>
          <p className="text-lg text-muted-foreground">{t('subhead')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/try">{t('ctaTry')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">{t('ctaLogin')}</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {(['proof1', 'proof2', 'proof3'] as const).map((k) => (
              <li key={k} className="rounded-full border px-3 py-1">
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <HeroWorld label={t('heroAlt')} />
      </section>

      <section className="mt-16" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-2xl font-semibold">
          {t('howTitle')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-lg border p-5">
              <div className="mb-2 text-sm font-semibold text-primary">{i + 1}</div>
              <h3 className="mb-1 font-semibold">{t(`steps.${s}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`steps.${s}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="mb-2 text-xl font-semibold">{t('parentsTitle')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('parentsBody')}</p>
          <Button asChild variant="outline">
            <Link href="/parents">{t('parentsCta')}</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="mb-2 text-xl font-semibold">{t('schoolsTitle')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('schoolsBody')}</p>
          <Button asChild variant="outline">
            <Link href="/schools">{t('schoolsCta')}</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="faq">
        <h2 id="faq" className="mb-4 text-2xl font-semibold">
          {t('faqTitle')}
        </h2>
        <div className="divide-y rounded-lg border">
          {FAQ.map((q) => (
            <details key={q} className="group p-4">
              <summary className="cursor-pointer font-medium">{t(`faq.${q}.q`)}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{t(`faq.${q}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
