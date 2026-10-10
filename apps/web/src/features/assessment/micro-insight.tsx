'use client';

import { Dialog } from 'radix-ui';

import { Button } from '@/components/ui/button';

import { useNumberFormat } from './primitives';
import { useAT } from './ui-context';

/**
 * D8: a short, neutral pause every 8 to 10 items. Never shows a score or a hint about the result,
 * only encouragement and how far along the student is.
 */
export function MicroInsight({
  open,
  ordinal,
  answered,
  total,
  onContinue,
}: {
  open: boolean;
  /** n-th insight of this station; picks a line from the pool. */
  ordinal: number;
  answered: number;
  total: number;
  onContinue: () => void;
}) {
  const at = useAT();
  const nf = useNumberFormat();
  const pool = Number(at('insight.count'));
  const line = at(`insight.lines.${ordinal % pool}`);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onContinue()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/50 motion-safe:animate-in motion-safe:fade-in" />
        <Dialog.Content
          data-testid="micro-insight"
          className="fixed inset-x-0 top-1/2 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm -translate-y-1/2 rounded-2xl border bg-card p-6 text-card-foreground shadow-lg outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        >
          <Dialog.Title className="text-lg font-semibold">{at('insight.title')}</Dialog.Title>
          <Dialog.Description className="mt-2 text-base">{line}</Dialog.Description>
          <p className="mt-3 text-sm text-muted-foreground">{at('insight.progress', { answered: nf.format(answered), total: nf.format(total) })}</p>
          <div className="mt-5">
            <Dialog.Close asChild>
              <Button size="lg" className="w-full">
                {at('insight.continue')}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
