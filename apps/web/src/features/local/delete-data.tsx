'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { PinHash } from '@/lib/local/pin';

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/runtime'), import('@/lib/local/pin')]);

/**
 * "Delete all my data" (consent-texts §1.4): removes the active profile and everything stored for it.
 * A 15–17 profile needs the parent PIN.
 */
export function DeleteMyData({ onDeleted }: { onDeleted: () => void }) {
  const t = useTranslations('Local.deleteData');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinHash, setPinHash] = useState<PinHash | null>(null);
  const [pin, setPin] = useState('');
  const [wrongPin, setWrongPin] = useState(false);

  const start = async () => {
    const [{ deviceKv }, { DeviceStore }] = await load();
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    const profile = id ? await device.getProfile(id) : null;
    setPinHash(profile?.guardian?.pin ?? null);
    setPin('');
    setWrongPin(false);
    setOpen(true);
  };

  const remove = async () => {
    setBusy(true);
    const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }, { verifyPin }] = await load();
    if (pinHash && !(await verifyPin(pin, pinHash))) {
      setWrongPin(true);
      setBusy(false);
      return;
    }
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
      <button onClick={() => void start()} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-destructive" data-testid="delete-data">
        {t('open')}
      </button>
    );
  return (
    <section role="alertdialog" aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-4">
      <h2 id="delete-title" className="font-semibold">
        {t('title')}
      </h2>
      <p className="text-sm">{t('body')}</p>
      {pinHash && (
        <label className="flex flex-col gap-1 text-sm">
          {t('pinPrompt')}
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setWrongPin(false);
            }}
            className="w-40 rounded-xl border bg-background px-3 py-2 tracking-[0.3em]"
            data-testid="delete-pin"
          />
          {wrongPin && (
            <span role="alert" className="text-xs text-destructive">
              {t('pinWrong')}
            </span>
          )}
        </label>
      )}
      <div className="flex gap-2">
        <Button variant="destructive" disabled={busy || (pinHash !== null && pin.length < 4)} onClick={() => void remove()} data-testid="delete-confirm">
          {t('confirm')}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </section>
  );
}
