import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Badge, DataTable, fmtDate, PageTitle, Td } from '@/features/admin/ui';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/server/admin/runtime';

const PAGE_SIZE = 25;
const ROLES = ['student', 'parent', 'counselor', 'school_admin'];

/** K3 users list: search by name or id, filter by role, paginated. */
export default async function AdminUsersPage({ params, searchParams }: PageProps<'/[locale]/admin/users'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('users');
  const t = await getTranslations('Admin.users');
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const role = typeof sp.role === 'string' && ROLES.includes(sp.role) ? sp.role : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await repo.listUsers({ q, role: role || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(p) })}`;

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('search')}</span>
          <input name="q" defaultValue={q} className="h-9 w-72 rounded-md border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('role')}</span>
          <select name="role" defaultValue={role} className="h-9 rounded-md border bg-background px-2">
            <option value="">{t('anyRole')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{t('submit')}</Button>
      </form>

      {rows.length ? (
        <DataTable head={[t('name'), t('role'), t('governorate'), t('curriculum'), t('consent'), t('result'), t('joined'), t('lastSeen')]} caption={t('title')}>
          {rows.map((u) => (
            <tr key={u.id}>
              <Td>
                <Link href={`/admin/users/${u.id}`} className="font-medium underline-offset-2 hover:underline">
                  {u.displayName}
                </Link>
              </Td>
              <Td>{u.role}</Td>
              <Td>{u.governorate ?? '—'}</Td>
              <Td>{u.curriculum ?? '—'}</Td>
              <Td>
                {u.role === 'student' ? (
                  <Badge tone={u.consent === 'active' ? 'good' : u.consent === 'withdrawn' ? 'warn' : 'neutral'}>{t(`consentState.${u.consent}`)}</Badge>
                ) : (
                  '—'
                )}
              </Td>
              <Td>{u.hasResult ? t('yes') : t('no')}</Td>
              <Td>{fmtDate(u.createdAt, locale)}</Td>
              <Td>{fmtDate(u.lastSeenAt, locale)}</Td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>{t('showing', { from, to, total })}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/users${qs(page - 1)}`}>{t('prev')}</Link>
            </Button>
          ) : null}
          {to < total ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/users${qs(page + 1)}`}>{t('next')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
