'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { PinHash } from '@/lib/local/pin';

const field = 'w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/transfer'), import('@/lib/local/pin')]);

type Mode = 'file' | 'code';
type Code = { code: string; key: string; expiresInSec: number };

async function saveFile(name: string, text: string) {
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch {
      // Cancelled or unsupported: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Move to a new phone" (consent-texts §1.5): a passphrase-protected backup file, or a one-time
 * transfer code. Data is sealed here first; 15–17 profiles need the parent PIN.
 */
export function MoveData() {
  const t = useTranslations('Local.move');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('file');
  const [pinHash, setPinHash] = useState<PinHash | null>(null);
  const [pin, setPin] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [transfer, setTransfer] = useState<Code | null>(null);

  const start = async () => {
    const [{ deviceKv }, { DeviceStore }] = await load();
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    setPinHash((id && (await device.getProfile(id))?.guardian?.pin) || null);
    setOpen(true);
    setError(null);
    setSaved(false);
    setTransfer(null);
  };

  /** Checks the parent PIN if needed and returns the sealed-ready bundle. */
  const bundle = async () => {
    const [{ deviceKv }, { DeviceStore }, { exportProfile }, { verifyPin }] = await load();
    if (pinHash && !(await verifyPin(pin, pinHash))) throw new Error('pin');
    const kv = await deviceKv();
    const id = await new DeviceStore(kv).getActiveId();
    if (!id) throw new Error('no_profile');
    return exportProfile(kv, id);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const makeFile = () =>
    run(async () => {
      const [, , { sealWithPassphrase }] = await load();
      const sealed = await sealWithPassphrase(await bundle(), pass);
      await saveFile(`anabokra-backup-${new Date().toISOString().slice(0, 10)}.anabokra`, JSON.stringify(sealed));
      setSaved(true);
    });

  const makeCode = () =>
    run(async () => {
      const [, , { sealForTransfer }] = await load();
      const { sealed, key } = await sealForTransfer(await bundle());
      let res: Response;
      try {
        res = await fetch('/api/transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: JSON.stringify(sealed) }) });
      } catch {
        throw new Error('network');
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string; expiresInSec?: number } | null;
      if (!res.ok || !json?.ok || !json.code) throw new Error(json?.error ?? 'network');
      setTransfer({ code: json.code, key, expiresInSec: json.expiresInSec ?? 600 });
    });

  if (!open)
    return (
      <button onClick={() => void start()} className="text-sm text-primary underline underline-offset-4" data-testid="move-data">
        {t('open')}
      </button>
    );

  const passOk = pass.length >= 8 && pass === pass2;
  const pinOk = !pinHash || pin.length >= 4;
  const group = (s: string) => s.match(/.{1,4}/g)!.join('-');

  return (
    <section aria-labelledby="move-title" className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="move-panel">
      <h2 id="move-title" className="font-semibold">
        {t('title')}
      </h2>
      <div className="flex rounded-full bg-muted p-1 text-sm" role="tablist">
        {(['file', 'code'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`min-h-9 flex-1 rounded-full px-3 ${mode === m ? 'bg-background font-semibold shadow-sm' : ''}`}>
            {t(`modes.${m}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t(`intro.${mode}`)}</p>

      {pinHash && (
        <label className="flex flex-col gap-1 text-sm">
          {t('pin')}
          <input className={`${field} w-40 tracking-[0.3em]`} type="password" inputMode="numeric" maxLength={6} dir="ltr" value={pin} onChange={(e) => setPin(e.target.value)} data-testid="move-pin" />
        </label>
      )}

      {mode === 'file' &&
        (saved ? (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              {t('passphrase')}
              <input className={field} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" data-testid="pass" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('passphraseAgain')}
              <input className={field} type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" data-testid="pass2" />
              <span className="text-xs text-muted-foreground">{t('passphraseHelp')}</span>
            </label>
            <Button disabled={busy || !passOk || !pinOk} onClick={() => void makeFile()} data-testid="save-backup">
              {t('saveFile')}
            </Button>
          </>
        ))}

      {mode === 'code' &&
        (transfer ? (
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-3" data-testid="transfer-code">
            <p className="text-sm">{t('codeIntro', { minutes: Math.round(transfer.expiresInSec / 60) })}</p>
            <p className="text-sm">
              {t('code')}: <span className="font-mono text-lg font-bold" dir="ltr" data-testid="code-value">{group(transfer.code)}</span>
            </p>
            <p className="text-sm">
              {t('key')}: <span className="font-mono text-lg font-bold" dir="ltr" data-testid="key-value">{group(transfer.key)}</span>
            </p>
          </div>
        ) : (
          <Button disabled={busy || !pinOk} onClick={() => void makeCode()} data-testid="make-code">
            {t('makeCode')}
          </Button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${['pin', 'network', 'too_large', 'rate_limited'].includes(error) ? error : 'generic'}`)}
        </p>
      )}
      <div>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('close')}
        </Button>
      </div>
    </section>
  );
}
