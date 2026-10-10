import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, PageTitle, Td } from '@/features/admin/ui';
import { requireAdmin } from '@/server/admin/runtime';
import { systemChecks } from '@/server/admin/system';

/** K22 system health: configuration presence (never values) and database reachability. */
export default async function AdminSystemPage({ params }: PageProps<'/[locale]/admin/system'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('system');
  const t = await getTranslations('Admin.system');
  const checks = systemChecks(process.env, await repo.ping().catch(() => false));

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      <DataTable head={[t('check'), t('status'), t('detail')]}>
        {checks.map((c) => (
          <tr key={c.key}>
            <Td className="font-mono text-sm">{c.key}</Td>
            <Td>
              <Badge tone={c.status === 'ok' ? 'good' : c.status === 'warn' ? 'warn' : 'bad'}>{t(`status_${c.status}`)}</Badge>
            </Td>
            <Td>{c.detail}</Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
