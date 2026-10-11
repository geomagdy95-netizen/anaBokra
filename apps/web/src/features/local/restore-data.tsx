'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const field = 'w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const ERRORS = ['wrong_secret', 'not_a_backup', 'unsupported_version', 'not_found', 'rate_limited', 'network'];

/** "Restore my data" on a new phone (consent-texts §1.5): from a backup file or a transfer code. */
export function RestoreData({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations('Local.restore');
  const [mode, setMode] = useState<'file' | 'code'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ deviceKv }, transfer, { forgetActiveRuntime }] = await Promise.all([
        import('@/lib/local/kv'),
        import('@/lib/local/transfer'),
        import('@/lib/local/runtime'),
      ]);
      let bundle;
      if (mode === 'file') {
        bundle = await transfer.openWithPassphrase(transfer.parseSealed(await file!.text()), pass);
      } else {
        let res: Response;
        try {
          res = await fetch('/api/transfer/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
        } catch {
          throw new Error('network');
        }
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; payload?: string } | null;
        if (!res.ok || !json?.ok || !json.payload) throw new Error(json?.error ?? 'network');
        bundle = await transfer.openTransfer(transfer.parseSealed(json.payload), key);
      }
      await transfer.importProfile(await deviceKv(), bundle);
      forgetActiveRuntime();
      onDone();
    } catch (e) {
      const c = (e as { code?: string; message?: string }).code ?? (e as Error).message;
      setError(ERRORS.includes(c) ? c : 'generic');
    } finally {
      setBusy(false);
    }
  };

  const ready = mode === 'file' ? Boolean(file) && pass.length > 0 : code.replace(/[\s-]/g, '').length === 8 && key.replace(/[\s-]/g, '').length === 16;

  return (
    <section className="flex flex-col gap-4" data-testid="restore">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="flex rounded-full bg-muted p-1 text-sm" role="tablist">
        {(['file', 'code'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`min-h-9 flex-1 rounded-full px-3 ${mode === m ? 'bg-background font-semibold shadow-sm' : ''}`}>
            {t(`modes.${m}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t(`intro.${mode}`)}</p>

      {mode === 'file' ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {t('file')}
            <input type="file" accept=".anabokra,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="restore-file" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('passphrase')}
            <input className={field} type="password" value={pass} onChange={(e) => setPass(e.target.value)} data-testid="restore-pass" />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {t('code')}
            <input className={`${field} font-mono uppercase tracking-widest`} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" autoComplete="off" data-testid="restore-code" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('key')}
            <input className={`${field} font-mono uppercase tracking-widest`} dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" data-testid="restore-key" />
          </label>
        </>
      )}

      <p className="text-xs text-muted-foreground">{t('replaces')}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="lg" disabled={!ready || busy} onClick={() => void restore()} data-testid="restore-go">
          {t('restore')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('back')}
        </Button>
      </div>
    </section>
  );
}
