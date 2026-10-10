import { clusters } from '@anabokra/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, fmtDate, PageTitle, Section, StatTile, Td } from '@/features/admin/ui';
import { Link } from '@/i18n/navigation';
import { contentHealth, type ContentIssue } from '@/server/admin/content-health';
import { requireAdmin } from '@/server/admin/runtime';

const ISSUES: ContentIssue[] = ['noPage', 'litePage', 'proxyProfile', 'imputedData', 'noSalary', 'noPrograms', 'fewSources', 'stale'];

/** Content health: what must be reviewed before publishing (editors come in MX-27b). */
export default async function AdminContentPage({ params, searchParams }: PageProps<'/[locale]/admin/content'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin('content');
  const t = await getTranslations('Admin.content');
  const sp = await searchParams;
  const issue = typeof sp.issue === 'string' && (ISSUES as string[]).includes(sp.issue) ? (sp.issue as ContentIssue) : null;
  const health = contentHealth();
  const lang = locale === 'ar' ? 'ar' : 'en';
  const clusterName = new Map(clusters.map((c) => [c.id, c.name[lang]]));
  const rows = issue ? health.careers.filter((c) => c.issues.includes(issue)) : health.careers;
  const n = health.totals;

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('careers')} value={n.careers} hint={`${t('fullPages')}: ${n.fullPages} · ${t('litePages')}: ${n.litePages}`} />
        <StatTile label={t('withSalary')} value={`${n.withSalary} / ${n.fullPages}`} />
        <StatTile label={t('programs')} value={n.programs} hint={`${t('withScores', { n: n.programsWithScores })} · ${t('withFees', { n: n.programsWithFees })}`} />
        <StatTile label={t('universities')} value={n.universities} hint={`${t('providers')}: ${n.providers} · ${t('withCost', { n: n.providersWithCost })}`} />
      </div>

      <Section title={t('careers')}>
        <nav aria-label={t('filter')} className="mb-3 flex flex-wrap gap-2">
          <Link href="/admin/content" aria-current={!issue ? 'page' : undefined} className={`rounded-md border px-2.5 py-1 text-xs ${!issue ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            {t('all')} ({health.careers.length})
          </Link>
          {ISSUES.map((k) => (
            <Link
              key={k}
              href={`/admin/content?issue=${k}`}
              aria-current={issue === k ? 'page' : undefined}
              className={`rounded-md border px-2.5 py-1 text-xs ${issue === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              {t(`issue.${k}`)} ({health.issueCounts[k]})
            </Link>
          ))}
        </nav>
        <DataTable head={[t('career'), t('cluster'), t('depth'), t('reviewed'), t('sources'), t('issues')]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/careers/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                  {c.name[lang]}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{c.id}</div>
              </Td>
              <Td>{clusterName.get(c.cluster) ?? c.cluster}</Td>
              <Td>{c.depth ?? '—'}</Td>
              <Td>{fmtDate(c.lastReviewedAt, locale)}</Td>
              <Td numeric>{c.sources}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.issues.length ? c.issues.map((i) => <Badge key={i} tone={i === 'noPage' || i === 'stale' ? 'bad' : 'warn'}>{t(`issue.${i}`)}</Badge>) : <Badge tone="good">✓</Badge>}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Section>
    </>
  );
}
