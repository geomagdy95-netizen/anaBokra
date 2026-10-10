'use client';

import { useLocale } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { shareOrDownload } from './share-actions';
import { DEFAULT_PRIVACY, privacyQuery, SHARE_FORMATS, type ShareFormat, type SharePrivacy } from './share';
import { card, h2, mutedP } from './ui';
import { useRT } from './use-rt';

/** E6: privacy toggles, a live preview of the server-rendered card, and Share / Download. */
export function SharePanel({ imageBase = '/api/assessment/share' }: { imageBase?: string }) {
  const rt = useRT();
  const locale = useLocale();
  const [privacy, setPrivacy] = useState<SharePrivacy>(DEFAULT_PRIVACY);
  const [format, setFormat] = useState<ShareFormat>('story');
  const [status, setStatus] = useState<'idle' | 'busy' | 'shared' | 'downloaded' | 'failed'>('idle');

  const src = `${imageBase}/${format}?${privacyQuery(privacy, locale)}`;
  const toggle = (k: keyof SharePrivacy) => setPrivacy((p) => ({ ...p, [k]: !p[k] }));

  const act = async (downloadOnly: boolean) => {
    setStatus('busy');
    try {
      const out = await shareOrDownload(src, `anabokra-${format}.png`, rt('share.shareText'), downloadOnly ? { nav: {} } : {});
      setStatus(out === 'cancelled' ? 'idle' : out);
    } catch {
      setStatus('failed');
    }
  };

  const dims = SHARE_FORMATS[format];
  const statusText =
    status === 'busy' ? rt('share.preparing') : status === 'shared' ? rt('share.shared') : status === 'downloaded' ? rt('share.downloaded') : status === 'failed' ? rt('share.failed') : '';

  return (
    <section aria-labelledby="share-h" className={`${card} flex flex-col gap-4`} data-testid="share-panel">
      <div>
        <h2 id="share-h" className={h2}>
          {rt('share.title')}
        </h2>
        <p className={mutedP}>{rt('share.intro')}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{rt('share.privacy')}</legend>
        {(['hideName', 'hideMatches'] as const).map((k) => (
          <label key={k} className="flex min-h-9 items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={privacy[k]} onChange={() => toggle(k)} data-testid={`toggle-${k}`} />
            <span>{rt(`share.${k}`)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-semibold">{rt('share.format')}</legend>
        {(Object.keys(SHARE_FORMATS) as ShareFormat[]).map((f) => (
          <label key={f} className="flex min-h-9 items-center gap-2">
            <input type="radio" name="share-format" className="size-4 accent-primary" checked={format === f} onChange={() => setFormat(f)} />
            <span>{rt(`share.${f}`)}</span>
          </label>
        ))}
      </fieldset>

      <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: `${dims.width} / ${dims.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered PNG that changes with the toggles */}
        <img key={src} src={src} alt={rt('share.previewAlt')} width={dims.width} height={dims.height} className="size-full object-contain" data-testid="share-preview" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => act(false)} disabled={status === 'busy'} data-testid="share-action">
          {rt('share.share')}
        </Button>
        <Button type="button" variant="outline" onClick={() => act(true)} disabled={status === 'busy'} data-testid="download-action">
          {rt('share.download')}
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {statusText}
        </p>
      </div>
    </section>
  );
}
