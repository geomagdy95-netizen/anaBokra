import { clusters, careers } from '@anabokra/content';
import { rankCareers, type Riasec, type UserProfile } from '@anabokra/engine';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

// Dev-only page proving the engine + content packages work inside the Next build.
const sampleInterests: Record<Riasec, number> = { R: 0.2, I: 0.95, A: 0.5, S: 0.3, E: 0.2, C: 0.4 };
const profile: UserProfile = { interests: sampleInterests };

export default async function DevEnginePage({ params }: PageProps<'/[locale]/dev/engine'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('DevEngine');
  const tr = await getTranslations('Riasec');
  const lang = locale as Locale;

  const top = rankCareers(profile, careers).slice(0, 5);
  const byId = new Map(careers.map((c) => [c.id, c]));
  const clusterName = new Map(clusters.map((c) => [c.id, c.name[lang]]));
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('back')}
        </Link>
        <LocaleSwitcher />
      </header>
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('intro')}</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('profile')}</h2>
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(sampleInterests) as Riasec[]).map((k) => (
            <li key={k} className="rounded-full border bg-card px-3 py-1 text-sm">
              {tr(k)} <span className="ms-1 font-medium">{nf.format(sampleInterests[k] * 100)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('top')}</h2>
        <ol className="flex flex-col gap-3">
          {top.map((m, i) => {
            const career = byId.get(m.careerId);
            return (
              <li key={m.careerId} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                <span className="w-6 text-center text-muted-foreground">{nf.format(i + 1)}</span>
                <div className="flex-1">
                  <div className="font-medium">{career?.name[lang] ?? m.careerId}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('cluster')}: {clusterName.get(m.cluster) ?? m.cluster}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-lg font-semibold text-primary">{nf.format(m.fit)}</div>
                  <div className="text-xs text-muted-foreground">{t('fit')}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
