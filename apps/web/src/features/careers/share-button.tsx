'use client';

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/** Web Share where available, otherwise copies the link. The outcome is announced politely. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('Careers.share');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return; // the user closed the share sheet
      setState('failed');
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={share}>
        <Share2 aria-hidden />
        {t('label')}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {state === 'copied' ? t('copied') : state === 'failed' ? t('failed') : ''}
      </p>
    </div>
  );
}
