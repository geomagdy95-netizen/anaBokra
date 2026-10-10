'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/** "Delete all my data" (consent-texts §1.4): removes the active profile and everything stored for it. */
export function DeleteMyData({ onDeleted }: { onDeleted: () => void }) {
  const t = useTranslations('Local.deleteData');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await Promise.all([
      import('@/lib/local/kv'),
      import('@/lib/local/device'),
      import('@/lib/local/runtime'),
    ]);
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    if (id) await device.deleteProfile(id);
    forgetActiveRuntime();
    setBusy(false);
    setOpen(false);
    onDeleted();
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-destructive" data-testid="delete-data">
        {t('open')}
      </button>
    );
  return (
    <section role="alertdialog" aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-4">
      <h2 id="delete-title" className="font-semibold">
        {t('title')}
      </h2>
      <p className="text-sm">{t('body')}</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={busy} onClick={remove} data-testid="delete-confirm">
          {t('confirm')}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </section>
  );
}
