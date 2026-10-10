'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/** Flips one feature flag through the admin API and shows the saved state. */
export function FlagToggle({ flagKey, initial }: { flagKey: string; initial: boolean }) {
  const t = useTranslations('Admin.flags');
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      setError(false);
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: flagKey, enabled: !enabled }),
      }).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { flag?: { enabled: boolean } }) : null;
      if (body?.flag) setEnabled(body.flag.enabled);
      else setError(true);
    });

  return (
    <div className="flex items-center gap-3">
      <span aria-live="polite" className={enabled ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
        {enabled ? t('on') : t('off')}
      </span>
      <Button size="sm" variant="outline" onClick={toggle} disabled={pending} aria-pressed={enabled}>
        {enabled ? t('turnOff') : t('turnOn')}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {t('error')}
        </span>
      ) : null}
    </div>
  );
}
