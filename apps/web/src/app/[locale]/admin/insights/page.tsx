import { careerById, clusters } from '@anabokra/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, PageTitle, Section, StatTile, Td } from '@/features/admin/ui';
import type { Locale } from '@/i18n/routing';
import { STEPS, USAGE_ACTIONS } from '@/lib/stats-summary';
import { requireAdmin } from '@/server/admin/runtime';
import { getStatsService } from '@/server/stats/service';

export const dynamic = 'force-dynamic';

/**
 * Insights (docs/product/analytics.md): what the anonymous, opt-in records say about the journey.
 * Totals only (no record can be traced to a person), plus the latest feedback notes.
 */
export default async function AdminInsightsPage({ params, searchParams }: PageProps<'/[locale]/admin/insights'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin('insights');
  const t = await getTranslations('Admin.insights');
  const sp = await searchParams;
  const event = typeof sp.event === 'string' && /^[A-Z0-9-]{3,20}$/.test(sp.event.toUpperCase()) ? sp.event.toUpperCase() : null;
  const data = await (await getStatsService()).insights(event);
  const lang = locale as Locale;
  const careerName = (id: string) => careerById(id)?.name[lang] ?? id;
  const fieldName = (id: string) => clusters.find((c) => c.id === id)?.name[lang] ?? id;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

  // The funnel: tasks 1–10, then the later milestones; each step as a share of those who did task 1.
  const funnel: [string, number][] = [
    ...Array.from({ length: 10 }, (_, i) => [t('step.task', { n: i + 1 }), data.steps[`discover_task:${i + 1}`] ?? 0] as [string, number]),
    ...STEPS.filter((s) => s !== 'discover_task').map((s) => [t(`step.${s}`), data.steps[s] ?? 0] as [string, number]),
  ];
  const base = data.steps['discover_task:1'] ?? 0;
  const ratingTotal = data.ratings.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      <form className="mb-6 flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-sm">
          {t('event')}
          <input name="event" defaultValue={event ?? ''} placeholder="UNI-CAIRO-01" className="h-9 rounded-md border bg-background px-3" />
        </label>
        <button className="h-9 rounded-md border px-3 text-sm">{t('filter')}</button>
        {event ? <Badge tone="warn">{event}</Badge> : null}
      </form>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <StatTile label={t('tiles.started')} value={base} />
        <StatTile label={t('tiles.results')} value={data.results} />
        <StatTile label={t('tiles.rating')} value={ratingTotal ? (data.ratings.reduce((a, n, i) => a + n * (i + 1), 0) / ratingTotal).toFixed(1) : '–'} hint={t('tiles.ratingHint', { n: ratingTotal })} />
        <StatTile label={t('tiles.feedback')} value={data.feedback.count} />
      </div>

      <Section title={t('funnel')}>
        <DataTable head={[t('step.name'), t('count'), t('share')]}>
          {funnel.map(([label, n]) => (
            <tr key={label}>
              <Td>{label}</Td>
              <Td className="tabular-nums">{n}</Td>
              <Td className="tabular-nums">{pct(n, base)}</Td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title={t('views')}>
        <DataTable head={[t('career'), t('count')]}>
          {data.views.slice(0, 30).map((v) => (
            <tr key={v.career}>
              <Td>{careerName(v.career)}</Td>
              <Td className="tabular-nums">{v.n}</Td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title={t('paths')}>
        <DataTable head={[t('field'), t('bands.fitsWell'), t('bands.fitsPartly'), t('bands.rethink')]}>
          {Object.entries(data.paths).map(([g, b]) => (
            <tr key={g}>
              <Td>{fieldName(g)}</Td>
              <Td className="tabular-nums">{b.fitsWell ?? 0}</Td>
              <Td className="tabular-nums">{b.fitsPartly ?? 0}</Td>
              <Td className="tabular-nums">{b.rethink ?? 0}</Td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title={t('usage')}>
        <DataTable head={[t('action'), t('count')]}>
          {USAGE_ACTIONS.map((a) => (
            <tr key={a}>
              <Td>{t(`actions.${a}`)}</Td>
              <Td className="tabular-nums">{data.usage[a] ?? 0}</Td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title={t('feedbackTitle')}>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <StatTile label={t('liked')} value={Object.entries(data.feedback.liked).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${t(`parts.${k}`)} (${n})`).join(' · ') || '–'} />
          <StatTile label={t('confusing')} value={Object.entries(data.feedback.confusing).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${t(`parts.${k}`)} (${n})`).join(' · ') || '–'} />
        </div>
        <DataTable head={[t('week'), t('screen'), t('ratingCol'), t('note')]}>
          {data.feedback.latest.map((f, i) => (
            <tr key={i}>
              <Td className="whitespace-nowrap tabular-nums">{f.week}</Td>
              <Td>{f.career ? `${f.screen} · ${careerName(f.career)}` : f.screen}</Td>
              <Td className="tabular-nums">{f.rating ?? '–'}</Td>
              <Td>
                <span dir="auto">{f.text ?? ''}</span>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Section>
    </>
  );
}
