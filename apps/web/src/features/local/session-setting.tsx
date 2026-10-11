'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { LocalProfile } from '@/lib/local/device';

import { JoinSession } from './join-session';
import { ResearchConsent } from './research-consent';

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/runtime'), import('@/lib/local/research')]);

async function readProfile(): Promise<LocalProfile | null> {
  const [{ deviceKv }, { DeviceStore }] = await load();
  const device = new DeviceStore(await deviceKv());
  const id = await device.getActiveId();
  return id ? device.getProfile(id) : null;
}

type Note = 'stopped' | 'stoppedNone' | 'deleteFailed' | null;

/** Stops research uploads and deletes the readiness records sent from this phone. */
async function stop(): Promise<Note> {
  const [, , { activeRuntime }, { stopResearch }] = await load();
  const rt = await activeRuntime();
  if (!rt) return 'deleteFailed';
  const { deleted, hadReadiness } = await stopResearch(rt);
  return !deleted ? 'deleteFailed' : hadReadiness ? 'stopped' : 'stoppedNone';
}

/**
 * Settings for the university pilot (consent-texts §2.2–2.3), adults only: join or leave a session,
 * and turn the research opt-in on or off. Turning it off deletes the readiness records sent from
 * this phone.
 */
export function SessionSetting() {
  const t = useTranslations('Local.session');
  const tr = useTranslations('Local.research');
  const [profile, setProfile] = useState<LocalProfile | null | undefined>(undefined);
  const [mode, setMode] = useState<'view' | 'join' | 'ask'>('view');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setProfile(await readProfile());
  useEffect(() => {
    void readProfile().then(setProfile);
  }, []);

  if (!profile || profile.consent?.basis !== 'adult_self') return null;
  const event = profile.event ?? null;
  const researchOn = Boolean(profile.consent.research && event?.research);

  const turnOff = async () => {
    setBusy(true);
    setNote(await stop());
    setBusy(false);
    await refresh();
  };

  const leave = async () => {
    setBusy(true);
    if (researchOn) setNote(await stop());
    const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await load();
    await new DeviceStore(await deviceKv()).updateProfile(profile.id, { event: null });
    forgetActiveRuntime();
    setBusy(false);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3 text-sm" data-testid="session-setting">
      <div>
        <p className="font-medium">{t('settingTitle')}</p>
        <p className="text-xs text-muted-foreground" data-testid="session-current">
          {event ? t('current', { code: `⁦${event.code}⁩` }) : t('none')}
        </p>
      </div>

      {!event && mode === 'view' && (
        <button className="self-start text-primary underline underline-offset-4" onClick={() => setMode('join')} data-testid="session-open">
          {t('open')}
        </button>
      )}
      {!event && mode === 'join' && (
        <JoinSession
          heading={false}
          onSkip={() => setMode('view')}
          onJoined={async (e) => {
            await refresh();
            setNote(null);
            setMode(e.research ? 'ask' : 'view');
          }}
        />
      )}

      {event?.research && mode === 'ask' && (
        <ResearchConsent
          heading={false}
          onAnswered={async () => {
            setMode('view');
            await refresh();
          }}
        />
      )}

      {event?.research && mode === 'view' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{tr(researchOn ? 'settingOn' : 'settingOff')}</p>
          <button
            role="switch"
            aria-checked={researchOn}
            aria-label={tr('switchLabel')}
            disabled={busy}
            onClick={() => (researchOn ? void turnOff() : setMode('ask'))}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${researchOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            data-testid="research-switch"
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${researchOn ? 'start-6' : 'start-1'}`} />
          </button>
        </div>
      )}

      {note && (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted p-2 text-xs" data-testid="research-note">
          <p>{tr(note)}</p>
          {note === 'deleteFailed' && (
            <button className="self-start text-primary underline underline-offset-4" disabled={busy} onClick={() => void turnOff()}>
              {tr('retry')}
            </button>
          )}
        </div>
      )}

      {event && mode === 'view' && (
        <button className="self-start text-xs text-muted-foreground underline underline-offset-4" disabled={busy} onClick={() => void leave()} data-testid="session-leave">
          {t('leave')}
        </button>
      )}
    </div>
  );
}
