'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { JoinedEvent } from '@/lib/local/device';
import { normalizeEventCode } from '@/lib/research';

const field = 'w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const ERRORS = ['invalid', 'unknown_event', 'event_closed', 'rate_limited', 'network'];

/** Checks a session code with the server and saves it on the active profile. */
async function join(raw: string): Promise<JoinedEvent> {
  const code = normalizeEventCode(raw);
  if (!code) throw new Error('invalid');
  let res: Response;
  try {
    res = await fetch('/api/events/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  } catch {
    throw new Error('network');
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string; research?: boolean } | null;
  if (!res.ok || !json?.ok || !json.code) throw new Error(json?.error ?? 'network');
  const event: JoinedEvent = { code: json.code, research: Boolean(json.research), joinedAt: new Date().toISOString() };
  const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await Promise.all([
    import('@/lib/local/kv'),
    import('@/lib/local/device'),
    import('@/lib/local/runtime'),
  ]);
  const device = new DeviceStore(await deviceKv());
  const id = await device.getActiveId();
  if (!id) throw new Error('generic');
  await device.updateProfile(id, { event });
  forgetActiveRuntime();
  return event;
}

/** "Joining a session?" (consent-texts §2.2). The app works without one. */
export function JoinSession({ onJoined, onSkip, heading = true }: { onJoined: (e: JoinedEvent) => void; onSkip: () => void; heading?: boolean }) {
  const t = useTranslations('Local.session');
  const id = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onJoined(await join(code));
    } catch (e) {
      const c = (e as Error).message;
      setError(ERRORS.includes(c) ? c : 'generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      data-testid="join-session"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {heading && <h1 className="text-2xl font-semibold">{t('title')}</h1>}
      <p className="text-sm">{t('intro')}</p>
      <label htmlFor={id} className="text-sm font-medium">
        {t('field')}
      </label>
      <input
        id={id}
        className={`${field} font-mono uppercase tracking-widest`}
        dir="ltr"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        placeholder="CU-FCI-1"
        autoComplete="off"
        autoCapitalize="characters"
        aria-invalid={Boolean(error)}
        data-testid="session-code"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={busy || code.trim().length < 3} data-testid="session-join">
          {busy ? t('joining') : t('join')}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onSkip}>
          {heading ? t('skip') : t('cancel')}
        </Button>
      </div>
    </form>
  );
}
