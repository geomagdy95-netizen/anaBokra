'use client';

import { cn } from '@/lib/utils';

import { choiceBase, choiceIdle, choiceOn, useNumberFormat } from './primitives';
import type { PuzzlePayload } from './types';
import { useAT, useText } from './ui-context';

/**
 * Performance item (D6): a prompt, optional media, and answer options. The stored value is the
 * chosen option index (0-based), which is what the server validates and scores. The answer key
 * never reaches the browser.
 */
export function PuzzleItem({
  puzzle,
  value,
  onSelect,
}: {
  puzzle: PuzzlePayload;
  value?: number;
  onSelect: (optionIndex: number) => void;
}) {
  const text = useText();
  const at = useAT();
  const nf = useNumberFormat();
  return (
    <div className="flex flex-col gap-4" data-testid="puzzle-item">
      <p className="text-xl font-semibold leading-snug">{text(puzzle.prompt)}</p>
      {puzzle.media && (
        <div
          role="img"
          aria-label={at('puzzle.mediaLabel')}
          data-media={puzzle.media}
          className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted text-sm text-muted-foreground"
        >
          {at('puzzle.mediaPlaceholder')}
        </div>
      )}
      <fieldset className="min-w-0">
        <legend className="sr-only">{at('puzzle.options')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {puzzle.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={value === i}
              onClick={() => onSelect(i)}
              className={cn(choiceBase, 'justify-start text-start', value === i ? choiceOn : choiceIdle)}
            >
              <span className="min-w-6 font-semibold tabular-nums">{nf.format(i + 1)}</span>
              <span>{text(opt)}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Renders nothing when the instrument has no performance items yet. */
export function PuzzleItemOrNothing({ puzzle, ...rest }: { puzzle?: PuzzlePayload; value?: number; onSelect: (i: number) => void }) {
  return puzzle ? <PuzzleItem puzzle={puzzle} {...rest} /> : null;
}
