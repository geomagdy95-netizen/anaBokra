'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const field = 'field';
const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/transfer')]);

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
 * "Move to a new phone" (consent-texts §1.5): a backup file locked with a passphrase the user chooses.
 * It never passes through anaBokra; the user carries it to the new phone themselves.
 */
export function MoveData() {
  const t = useTranslations('Local.move');
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const makeFile = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const [{ deviceKv }, { DeviceStore }, { exportProfile, sealWithPassphrase }] = await load();
      const kv = await deviceKv();
      const id = await new DeviceStore(kv).getActiveId();
      if (!id) throw new Error('no_profile');
      const sealed = await sealWithPassphrase(await exportProfile(kv, id), pass);
      await saveFile(`anabokra-backup-${new Date().toISOString().slice(0, 10)}.anabokra`, JSON.stringify(sealed));
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => {
          setOpen(true);
          setSaved(false);
          setFailed(false);
        }}
        className="tap-link"
        data-testid="move-data"
      >
        {t('open')}
      </button>
    );

  const passOk = pass.length >= 8 && pass === pass2;

  return (
    <section aria-labelledby="move-title" className="surface flex w-full flex-col gap-3" data-testid="move-panel">
      <h2 id="move-title" className="font-semibold">
        {t('title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      {saved ? (
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
          <Button disabled={busy || !passOk} onClick={() => void makeFile()} data-testid="save-backup">
            {t('saveFile')}
          </Button>
        </>
      )}

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('failed')}
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
