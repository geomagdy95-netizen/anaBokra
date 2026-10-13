import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { HeroWorld } from '@/features/public/hero-world';
import { PublicShell } from '@/features/public/shell';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { DATA_MODE } from '@/lib/data-mode';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: DATA_MODE === 'local' ? 'Public.start' : 'Public.landing' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { languages: { ar: '/ar', en: '/en', 'x-default': '/ar' } },
  };
}

const STEPS = ['discover', 'match', 'act'] as const;
const FAQ = ['science', 'time', 'cost', 'privacy', 'parents'] as const;

const START_STEPS = ['discover', 'verify', 'careers'] as const;
const START_FAQ = ['time', 'privacy', 'who', 'science', 'cost'] as const;

/** A1 landing page. */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE === 'local') return <StartPage />;
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
        <div className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-border/70">
          <HeroWorld label={t('heroAlt')} />
        </div>
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

/** A1 in phase 1: one column for the phone and one way in, the app (`/journey`). */
async function StartPage() {
  const t = await getTranslations('Public.start');
  return (
    <PublicShell>
      <section className="flex flex-col gap-5 pt-2">
        <h1 className="text-3xl font-bold leading-tight text-brand-ink">{t('headline')}</h1>
        <p className="text-lg text-muted-foreground">{t('subhead')}</p>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="w-full" data-testid="start">
            <Link href="/journey">{t('cta')}</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">{t('ctaHint')}</p>
        </div>
        <div className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-border/70">
          <HeroWorld label={t('heroAlt')} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="mb-4 text-xl font-bold">
          {t('howTitle')}
        </h2>
        <ol className="flex flex-col gap-3">
          {START_STEPS.map((s, i) => (
            <li key={s} className="surface flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">{i + 1}</span>
              <div>
                <h3 className="font-bold">{t(`steps.${s}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`steps.${s}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="mb-4 text-xl font-bold">
          {t('faqTitle')}
        </h2>
        <div className="surface divide-y divide-border p-0">
          {START_FAQ.map((q) => (
            <details key={q} className="group px-4">
              <summary className="flex min-h-14 cursor-pointer items-center font-semibold">{t(`faq.${q}.q`)}</summary>
              <p className="pb-4 text-sm text-muted-foreground">{t(`faq.${q}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10">
        <Button asChild size="lg" className="w-full">
          <Link href="/journey">{t('cta')}</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
