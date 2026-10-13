'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const field = 'field';
const ERRORS = ['wrong_secret', 'not_a_backup', 'unsupported_version'];

/** "Restore my data" on a new phone (consent-texts §1.5): from a backup file and its passphrase. */
export function RestoreData({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations('Local.restore');
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState('');
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
      const bundle = await transfer.openWithPassphrase(transfer.parseSealed(await file!.text()), pass);
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

  return (
    <section className="flex flex-col gap-4" data-testid="restore">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <label className="flex flex-col gap-1 text-sm">
        {t('file')}
        <input
          type="file"
          accept=".anabokra,application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:me-3 file:h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:font-semibold file:text-secondary-foreground"
          data-testid="restore-file"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('passphrase')}
        <input className={field} type="password" value={pass} onChange={(e) => setPass(e.target.value)} data-testid="restore-pass" />
      </label>

      <p className="text-xs text-muted-foreground">{t('replaces')}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="lg" disabled={!file || pass.length === 0 || busy} onClick={() => void restore()} data-testid="restore-go">
          {t('restore')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('back')}
        </Button>
      </div>
    </section>
  );
}
