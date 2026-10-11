'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/** Records the research choice on the active profile; on yes, starts sending. */
export async function setResearch(yes: boolean) {
  const [{ deviceKv }, { DeviceStore }, { activeRuntime }] = await Promise.all([
    import('@/lib/local/kv'),
    import('@/lib/local/device'),
    import('@/lib/local/runtime'),
  ]);
  const device = new DeviceStore(await deviceKv());
  const id = await device.getActiveId();
  const p = id ? await device.getProfile(id) : null;
  if (!id || !p?.consent) return;
  await device.updateProfile(id, { consent: { ...p.consent, research: yes, ...(yes ? { researchConfirmedAt: new Date().toISOString() } : {}) } });
  if (yes) {
    const rt = await activeRuntime();
    if (rt) void import('@/lib/local/research').then(({ syncResearch }) => syncResearch(rt));
  }
}

/** "Help us check the Arabic questions?" (consent-texts §2.3): adults at a session that offers it. */
export function ResearchConsent({ onAnswered, heading = true }: { onAnswered: (yes: boolean) => void; heading?: boolean }) {
  const t = useTranslations('Local.research');
  const [busy, setBusy] = useState(false);
  const answer = async (yes: boolean) => {
    setBusy(true);
    await setResearch(yes);
    setBusy(false);
    onAnswered(yes);
  };
  return (
    <section className="flex flex-col gap-3" data-testid="research-consent">
      {heading ? <h1 className="text-2xl font-semibold">{t('title')}</h1> : <p className="font-medium">{t('title')}</p>}
      <ul className="list-disc space-y-1.5 ps-5 text-sm">
        {(['p1', 'p2', 'p3', 'p4'] as const).map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={busy} onClick={() => void answer(true)} data-testid="research-yes">
          {t('yes')}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => void answer(false)} data-testid="research-no">
          {t('no')}
        </Button>
      </div>
    </section>
  );
}
