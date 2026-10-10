import { getTranslations, setRequestLocale } from 'next-intl/server';

import { FlagToggle } from '@/features/admin/flag-toggle';
import { DataTable, fmtDate, PageTitle, Td } from '@/features/admin/ui';
import { requireAdmin } from '@/server/admin/runtime';

/** K18 feature flags (super_admin). */
export default async function AdminFlagsPage({ params }: PageProps<'/[locale]/admin/flags'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('flags');
  const t = await getTranslations('Admin.flags');
  const flags = await repo.listFlags();

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      {flags.length ? (
        <DataTable head={['Key', '', '']}>
          {flags.map((f) => (
            <tr key={f.key}>
              <Td>
                <div className="font-mono text-sm">{f.key}</div>
                {f.description ? <div className="text-xs text-muted-foreground">{f.description}</div> : null}
              </Td>
              <Td>
                <FlagToggle flagKey={f.key} initial={f.enabled} />
              </Td>
              <Td className="text-xs text-muted-foreground">{t('updated', { date: fmtDate(f.updatedAt, locale) })}</Td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}
    </>
  );
}
