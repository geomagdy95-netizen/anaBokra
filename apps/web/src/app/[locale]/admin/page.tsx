import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Bar, PageTitle, Section, StatTile } from '@/features/admin/ui';
import { requireAdmin } from '@/server/admin/runtime';

/** K2 overview: KPI tiles and the assessment funnel. */
export default async function AdminOverviewPage({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('overview');
  const t = await getTranslations('Admin.overview');
  const o = await repo.overview();
  const top = o.funnel[0]?.count ?? 0;

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('users')} value={o.users.total} hint={t('newLast7d', { n: o.users.newLast7d })} />
        <StatTile label={t('students')} value={o.users.students} hint={`${t('parents')}: ${o.users.parents}`} />
        <StatTile label={t('sessions')} value={o.sessions.started} hint={t('inProgress', { n: o.sessions.inProgress })} />
        <StatTile label={t('results')} value={o.results} hint={`${t('completed')}: ${o.sessions.completed}`} />
        <StatTile label={t('consents')} value={o.consents.active} hint={t('withdrawn', { n: o.consents.withdrawn })} />
      </div>
      <Section title={t('funnel')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('funnelIntro')}</p>
        <ol className="space-y-3">
          {o.funnel.map((step, i) => {
            const prev = i === 0 ? null : o.funnel[i - 1]!.count;
            const pct = prev ? Math.round((step.count / prev) * 100) : null;
            const label = t(`steps.${step.step}` as 'steps.students');
            return (
              <li key={step.step} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
                <span>{label}</span>
                <Bar value={step.count} max={top} label={`${label}: ${step.count}`} />
                <span className="text-end tabular-nums">
                  {step.count}
                  {pct !== null ? <span className="ms-1 text-muted-foreground">({pct}%)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>
    </>
  );
}
