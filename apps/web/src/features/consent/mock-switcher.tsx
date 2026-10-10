import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';

/** Dev-only (mock mode): act as student / parent / school admin without Supabase. Rendered only when ASSESSMENT_REPO=memory. */
export async function MockSwitcher({ next }: { next: string }) {
  const t = await getTranslations('Consent.nav');
  const roles = [
    ['student', t('devStudent')],
    ['parent', t('devParent')],
    ['school_admin', t('devSchool')],
  ] as const;
  return (
    <form action="/api/consent/dev/mock" method="post" className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3 text-xs" data-testid="mock-switcher">
      <input type="hidden" name="next" value={next} />
      <span>{t('devTitle')}</span>
      {roles.map(([role, label]) => (
        <Button key={role} type="submit" name="role" value={role} size="sm" variant="outline">
          {label}
        </Button>
      ))}
      <Button type="submit" name="reset" value="1" size="sm" variant="ghost">
        {t('devReset')}
      </Button>
    </form>
  );
}
