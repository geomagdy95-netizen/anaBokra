'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { PinHash } from '@/lib/local/pin';

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/pin'), import('@/lib/local/runtime')]);

/** Settings switch for anonymous statistics (consent-texts §1.6). For 15–17, the parent PIN is needed. */
export function StatsSetting() {
  const t = useTranslations('Local.stats');
  const [on, setOn] = useState<boolean | null>(null);
  const [pinHash, setPinHash] = useState<PinHash | null>(null);
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    void load().then(async ([{ deviceKv }, { DeviceStore }]) => {
      const device = new DeviceStore(await deviceKv());
      const id = await device.getActiveId();
      const p = id ? await device.getProfile(id) : null;
      setOn(Boolean(p?.consent?.stats));
      setPinHash(p?.guardian?.pin ?? null);
    });
  }, []);

  const apply = async (next: boolean) => {
    const [{ deviceKv }, { DeviceStore }, { verifyPin }, { activeRuntime }] = await load();
    if (pinHash && !(await verifyPin(pin, pinHash))) {
      setWrong(true);
      return;
    }
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    const p = id ? await device.getProfile(id) : null;
    if (!id || !p?.consent) return;
    await device.updateProfile(id, { consent: { ...p.consent, stats: next } });
    setOn(next);
    setAsking(false);
    setPin('');
    if (next) {
      const rt = await activeRuntime();
      if (rt) void import('@/lib/local/stats').then(({ syncStats }) => syncStats(rt));
    }
  };

  if (on === null) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3 text-sm" data-testid="stats-setting">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t(on ? 'on' : 'off')}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={t('title')}
          onClick={() => (pinHash ? setAsking(true) : void apply(!on))}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          data-testid="stats-switch"
        >
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? 'start-6' : 'start-1'}`} />
        </button>
      </div>
      {asking && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            {t('pin')}
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              dir="ltr"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setWrong(false);
              }}
              className="w-32 rounded-xl border bg-background px-3 py-2 tracking-[0.3em]"
            />
          </label>
          <button onClick={() => void apply(!on)} className="min-h-10 rounded-xl bg-primary px-3 text-primary-foreground" disabled={pin.length < 4}>
            {t('confirm')}
          </button>
          {wrong && (
            <span role="alert" className="text-xs text-destructive">
              {t('pinWrong')}
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('what')}</p>
    </div>
  );
}
