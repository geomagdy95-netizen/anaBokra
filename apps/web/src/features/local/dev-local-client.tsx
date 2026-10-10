'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface Snapshot {
  persistent: boolean;
  profiles: number;
  latest: { createdAt: string; coverage: number; top: { careerId: string; fit: number }[] } | null;
}

interface RunReport {
  loadMs: number;
  answerMs: number;
  scoreMs: number;
  matches: number;
}

type Matches = { careerId: string; fit: number }[];

/** Loaded on demand: the engine, the career library and the service only reach the browser when used. */
const load = () => Promise.all([import('@/lib/local/runtime'), import('@/lib/local/device'), import('@/lib/local/kv'), import('@/lib/local/demo-answers')]);

async function snapshot(): Promise<Snapshot> {
  const [{ openLocalRuntime }, { DeviceStore }, { deviceKv }] = await load();
  const kv = await deviceKv();
  const profiles = (await new DeviceStore(kv).listProfiles()).length;
  const rt = await openLocalRuntime();
  const r = rt ? await rt.service.getLatestResult(rt.userId) : null;
  return {
    persistent: kv.persistent,
    profiles,
    latest: r ? { createdAt: r.createdAt, coverage: r.coverage, top: (r.matches as Matches).slice(0, 5) } : null,
  };
}

export function DevLocalClient() {
  const t = useTranslations('DevLocal');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    snapshot().then(setSnap, (e: unknown) => setError(String(e)));
  }, []);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const t0 = performance.now();
      const [{ localRuntimeFor }, { DeviceStore }, { deviceKv }, { demoStations }] = await load();
      const kv = await deviceKv();
      const device = new DeviceStore(kv);
      let profile = await device.createProfile({ mode: 'phone', ageBand: '18plus' });
      profile = await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 'consent-0.2-draft', policyVersion: '0.2' });
      await device.setActiveId(profile.id);
      const rt = localRuntimeFor(kv, profile);
      const t1 = performance.now();
      const { session } = await rt.service.startSession(rt.userId, {});
      for (const [station, responses] of demoStations()) {
        await rt.service.saveResponses(rt.userId, { sessionId: session.id, station, responses });
        await rt.service.completeStation(rt.userId, { sessionId: session.id, station });
      }
      const t2 = performance.now();
      const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
      const t3 = performance.now();
      setReport({ loadMs: t1 - t0, answerMs: t2 - t1, scoreMs: t3 - t2, matches: result.matches.length });
      setSnap(await snapshot());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const [, { DeviceStore }, { deviceKv }] = await load();
    await new DeviceStore(await deviceKv()).wipeAll();
    setReport(null);
    setSnap(await snapshot());
  };

  const ms = (n: number) => `${Math.round(n)} ms`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {snap && (
        <dl className="grid grid-cols-2 gap-2 rounded-xl border p-4 text-sm" data-testid="snapshot">
          <dt>{t('persistent')}</dt>
          <dd data-testid="persistent">{snap.persistent ? t('yes') : t('no')}</dd>
          <dt>{t('profiles')}</dt>
          <dd data-testid="profiles">{snap.profiles}</dd>
          <dt>{t('latest')}</dt>
          <dd data-testid="latest">{snap.latest ? `${snap.latest.createdAt} · ${Math.round(snap.latest.coverage * 100)}%` : t('none')}</dd>
        </dl>
      )}
      {snap?.latest && (
        <ol className="list-decimal ps-6 text-sm" data-testid="top">
          {snap.latest.top.map((m) => (
            <li key={m.careerId}>
              {m.careerId} · {Math.round(m.fit)}
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <button onClick={run} disabled={busy} className="min-h-10 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">
          {busy ? t('running') : t('run')}
        </button>
        <button onClick={wipe} disabled={busy} className="min-h-10 rounded-lg border px-4">
          {t('wipe')}
        </button>
      </div>
      {report && (
        <p className="text-sm" data-testid="report">
          {t('report', { load: ms(report.loadMs), answer: ms(report.answerMs), score: ms(report.scoreMs), matches: report.matches })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
