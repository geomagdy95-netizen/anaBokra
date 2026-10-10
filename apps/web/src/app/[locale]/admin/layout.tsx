import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { getAdminContext } from '@/server/admin/runtime';
import { canOpen, SECTION_ROLES, type AdminSection } from '@/server/admin/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LayoutProps<'/[locale]/admin'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin.meta' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const SECTIONS = Object.keys(SECTION_ROLES) as AdminSection[];
const HREF: Record<AdminSection, string> = {
  overview: '/admin',
  users: '/admin/users',
  assessment: '/admin/assessment',
  content: '/admin/content',
  flags: '/admin/flags',
  audit: '/admin/audit',
  system: '/admin/system',
};

/** K1 shell: only signed-in admins get past this; everyone else sees a 404. */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]/admin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getAdminContext();
  if (!ctx) notFound();
  const t = await getTranslations('Admin');

  return (
    <div className="min-h-dvh bg-background">
      {ctx.repo.demo ? (
        <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-900/50 dark:text-amber-50">
          {t('demo')}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-6">
        <nav aria-label={t('nav.label')} className="md:w-52 md:shrink-0">
          <div className="mb-4 font-bold">anaBokra · {t('nav.overview')}</div>
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {SECTIONS.filter((s) => canOpen(ctx.roles, s)).map((s) => (
              <li key={s}>
                <Link href={HREF[s]} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
                  {t(`nav.${s}`)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">{t('roles', { roles: ctx.roles.join(', ') })}</p>
          <Link href="/" className="mt-2 block text-xs underline">
            {t('nav.back')}
          </Link>
        </nav>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
