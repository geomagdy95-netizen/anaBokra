import { instruments } from '@anabokra/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, fmtNum, PageTitle, Section, Td } from '@/features/admin/ui';
import { Link } from '@/i18n/navigation';
import { flagItem, instrumentStats, MIN_CASES_FOR_ALPHA } from '@/server/admin/analytics';
import { requireAdmin } from '@/server/admin/runtime';

const LIKERT = { interests: instruments.interests, personality: instruments.personality, readiness: instruments.readiness } as const;
type LikertId = keyof typeof LIKERT;

/** K8 assessment analytics: per-item distributions, skips, timing, item–total r; alpha per scale. */
export default async function AdminAssessmentPage({ params, searchParams }: PageProps<'/[locale]/admin/assessment'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('assessment');
  const t = await getTranslations('Admin.assessment');
  const sp = await searchParams;
  const id: LikertId = typeof sp.i === 'string' && sp.i in LIKERT ? (sp.i as LikertId) : 'interests';
  const instrument = LIKERT[id];
  const stats = instrumentStats(instrument, await repo.responsesFor(id));
  const lang = locale === 'ar' ? 'ar' : 'en';
  const itemText = new Map(instrument.items.map((i) => [i.id, i.text[lang]]));
  const scaleName = new Map(instrument.scales.map((s) => [s.id, s.name[lang]]));

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro', { min: MIN_CASES_FOR_ALPHA })} />
      <nav className="mb-6 flex gap-2" aria-label={t('title')}>
        {(Object.keys(LIKERT) as LikertId[]).map((key) => (
          <Link
            key={key}
            href={`/admin/assessment?i=${key}`}
            aria-current={key === id ? 'page' : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${key === id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            {LIKERT[key].name[lang]}
          </Link>
        ))}
      </nav>

      {stats.sessions === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{t('sessions', { n: stats.sessions })}</p>
          <Section title={t('scales')}>
            <DataTable head={[t('scale'), t('items'), t('completeCases'), t('alpha')]}>
              {stats.scales.map((s) => (
                <tr key={s.scale}>
                  <Td>{scaleName.get(s.scale) ?? s.scale}</Td>
                  <Td numeric>{s.items}</Td>
                  <Td numeric>{s.completeCases}</Td>
                  <Td numeric>
                    {s.alpha === null ? (
                      '—'
                    ) : (
                      <Badge tone={s.alpha >= 0.7 ? 'good' : s.alpha >= 0.6 ? 'warn' : 'bad'}>{fmtNum(s.alpha)}</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </DataTable>
          </Section>

          <Section title={t('itemTable')}>
            <DataTable head={[t('item'), t('scale'), t('n'), t('missing'), t('mean'), t('sd'), t('itemTotal'), t('time'), t('distribution'), t('flags')]}>
              {stats.items.map((s) => {
                const flags = flagItem(s);
                const max = Math.max(1, ...s.distribution);
                return (
                  <tr key={s.itemId}>
                    <Td className="min-w-64">
                      <div className="font-mono text-xs text-muted-foreground">{s.itemId}</div>
                      <div>{itemText.get(s.itemId)}</div>
                      {s.keyed === -1 ? <Badge>{t('reverse')}</Badge> : null}
                      {s.attentionCheck ? <Badge>{t('check')}</Badge> : null}
                    </Td>
                    <Td>{s.scale ? (scaleName.get(s.scale) ?? s.scale) : '—'}</Td>
                    <Td numeric>{s.n}</Td>
                    <Td numeric>{Math.round(s.missing * 100)}%</Td>
                    <Td numeric>{fmtNum(s.mean)}</Td>
                    <Td numeric>{fmtNum(s.sd)}</Td>
                    <Td numeric>{s.attentionCheck ? t('passRate', { pct: `${Math.round((s.passRate ?? 0) * 100)}%` }) : fmtNum(s.itemTotal)}</Td>
                    <Td numeric>{s.medianMs === null ? '—' : `${(s.medianMs / 1000).toFixed(1)}s`}</Td>
                    <Td>
                      <div className="flex h-8 items-end gap-0.5" role="img" aria-label={s.distribution.join(' / ')}>
                        {s.distribution.map((c, i) => (
                          <div key={i} className="w-3 rounded-t bg-primary/70" style={{ blockSize: `${Math.max(4, (c / max) * 100)}%` }} />
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {flags.map((f) => (
                          <Badge key={f} tone="warn">
                            {t(`flag.${f}` as 'flag.weakItem')}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
          </Section>
        </>
      )}
    </>
  );
}
