import { careerById } from '@anabokra/content';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, fmtDate, PageTitle, Section, Td } from '@/features/admin/ui';
import { requireAdmin } from '@/server/admin/runtime';
import { canSeeAnswers } from '@/server/admin/types';

/** K4 user detail: profile, consent records, sessions, latest result summary. No raw answers. */
export default async function AdminUserPage({ params }: PageProps<'/[locale]/admin/users/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { repo, roles } = await requireAdmin('users');
  const t = await getTranslations('Admin.user');
  const tu = await getTranslations('Admin.users');
  const user = await repo.getUser(id);
  if (!user) notFound();
  const p = user.profile;
  const lang = locale === 'ar' ? 'ar' : 'en';
  const fullResult = canSeeAnswers(roles);

  const facts: [string, string][] = [
    [tu('role'), p.role],
    [tu('governorate'), p.governorate ?? '—'],
    [tu('curriculum'), p.curriculum ?? '—'],
    [t('gender'), p.gender ?? '—'],
    [t('grade'), p.grade?.toString() ?? '—'],
    [t('dob'), fmtDate(p.dateOfBirth, locale)],
    [t('phone'), p.phoneMasked ?? '—'],
    [tu('joined'), fmtDate(p.createdAt, locale)],
    [tu('lastSeen'), fmtDate(p.lastSeenAt, locale)],
  ];

  return (
    <>
      <PageTitle title={p.displayName} intro={p.id} />
      <Section title={t('profile')}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t('consents')}>
        {user.consents.length ? (
          <DataTable head={[t('route'), t('method'), t('policy'), t('granted'), t('withdrawnAt')]}>
            {user.consents.map((c) => (
              <tr key={c.id}>
                <Td>{c.route}</Td>
                <Td>{c.method}</Td>
                <Td>{c.policyVersion}</Td>
                <Td>{fmtDate(c.grantedAt, locale)}</Td>
                <Td>{c.withdrawnAt ? <Badge tone="warn">{fmtDate(c.withdrawnAt, locale)}</Badge> : '—'}</Td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noConsents')}</p>
        )}
      </Section>

      <Section title={t('sessions')}>
        {user.sessions.length ? (
          <DataTable head={[t('status'), t('stations'), t('started'), t('finished')]}>
            {user.sessions.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Badge tone={s.status === 'completed' ? 'good' : 'neutral'}>{s.status}</Badge>
                </Td>
                <Td>{s.stationsDone.join(', ') || '—'}</Td>
                <Td>{fmtDate(s.startedAt, locale)}</Td>
                <Td>{fmtDate(s.completedAt, locale)}</Td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noSessions')}</p>
        )}
      </Section>

      <Section title={t('result')}>
        {user.latestResult ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('holland')}</dt>
              <dd className="font-mono">{user.latestResult.hollandCode ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('coverage')}</dt>
              <dd>{user.latestResult.coverage === null ? '—' : `${Math.round(user.latestResult.coverage * 100)}%`}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('quality')}</dt>
              <dd>{user.latestResult.quality.length ? user.latestResult.quality.map((f) => <Badge key={f} tone="warn">{f}</Badge>) : t('none')}</dd>
            </div>
            {fullResult ? (
              <div>
                <dt className="text-muted-foreground">{t('topCareers')}</dt>
                <dd>{user.latestResult.topCareerIds.map((cid) => careerById(cid)?.name[lang] ?? cid).join(lang === 'ar' ? '، ' : ', ')}</dd>
              </div>
            ) : (
              <p className="text-muted-foreground">{t('summaryOnly')}</p>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noResult')}</p>
        )}
      </Section>
    </>
  );
}
