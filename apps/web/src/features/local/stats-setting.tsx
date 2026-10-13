'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/runtime')]);

/** Settings switch for anonymous statistics (consent-texts §1.6), chosen by the user. */
export function StatsSetting() {
  const t = useTranslations('Local.stats');
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    void load().then(async ([{ deviceKv }, { DeviceStore }]) => {
      const device = new DeviceStore(await deviceKv());
      const id = await device.getActiveId();
      const p = id ? await device.getProfile(id) : null;
      setOn(Boolean(p?.consent?.stats));
    });
  }, []);

  const apply = async (next: boolean) => {
    const [{ deviceKv }, { DeviceStore }, { activeRuntime }] = await load();
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    const p = id ? await device.getProfile(id) : null;
    if (!id || !p?.consent) return;
    await device.updateProfile(id, { consent: { ...p.consent, stats: next } });
    setOn(next);
    if (next) {
      const rt = await activeRuntime();
      if (rt) void import('@/lib/local/stats').then(({ syncStats }) => syncStats(rt));
    }
  };

  if (on === null) return null;
  return (
    <div className="surface flex flex-col gap-2 text-sm" data-testid="stats-setting">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t(on ? 'on' : 'off')}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={t('title')}
          onClick={() => void apply(!on)}
          className={`switch ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          data-testid="stats-switch"
        >
          <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'start-7' : 'start-1'}`} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t('what')}</p>
    </div>
  );
}
