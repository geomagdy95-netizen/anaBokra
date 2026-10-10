import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge, DataTable, PageTitle, Td } from '@/features/admin/ui';
import { requireAdmin } from '@/server/admin/runtime';

/** K21 audit log: ids and changed field names only (see migration 09). */
export default async function AdminAuditPage({ params }: PageProps<'/[locale]/admin/audit'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { repo } = await requireAdmin('audit');
  const t = await getTranslations('Admin.audit');
  const entries = await repo.auditLog({ limit: 200 });
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <PageTitle title={t('title')} intro={t('intro')} />
      {entries.length ? (
        <DataTable head={[t('when'), t('actor'), t('action'), t('entity'), t('fields')]}>
          {entries.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{fmt.format(new Date(e.createdAt))}</Td>
              <Td>
                <div className="font-mono text-xs">{e.actorId ?? t('system')}</div>
                <div className="text-xs text-muted-foreground">{e.actorRole ?? ''}</div>
              </Td>
              <Td>
                <Badge>{e.action}</Badge>
              </Td>
              <Td>
                <div>{e.entityType}</div>
                <div className="font-mono text-xs text-muted-foreground">{e.entityId ?? ''}</div>
              </Td>
              <Td>{e.changedFields.join(', ') || '—'}</Td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}
    </>
  );
}
