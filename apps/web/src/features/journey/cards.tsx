import type { ReactNode } from 'react';

import type { VerifyBand } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';

/**
 * The app's two signature cards (first used on My results):
 * - HeroCard: the soft lavender gradient with a small purple eyebrow, a big bold title, quiet text and
 *   white pill stats. It opens a screen or presents a result.
 * - PromptCard: the warm bordered card with an emoji, a bold title, one line of why and one clear action.
 */

export type HeroTone = 'lavender' | 'success' | 'warm';

const TONES: Record<HeroTone, string> = {
  lavender: 'from-brand-lavender via-[#F6EFFA] to-accent',
  success: 'from-brand-success/20 via-[#EEF7F2] to-accent',
  warm: 'from-brand-orange-soft/35 via-[#FFF3E8] to-brand-lavender',
};

/** A fit result's band as a hero tone and emoji (field check and career quest). */
export const BAND_TONE: Record<VerifyBand, HeroTone> = { fitsWell: 'success', fitsPartly: 'lavender', rethink: 'warm' };
export const BAND_ICON: Record<VerifyBand, string> = { fitsWell: '🌟', fitsPartly: '🧭', rethink: '🤔' };

export function HeroCard({
  eyebrow,
  title,
  icon,
  art,
  tone = 'lavender',
  titleAs: Title = 'h2',
  titleTestId,
  testId,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** An emoji or small element before the title. */
  icon?: ReactNode;
  /** A picture across the top of the card (e.g. TaskArt); the parent gives it no height. */
  art?: ReactNode;
  tone?: HeroTone;
  titleAs?: 'h1' | 'h2' | 'h3';
  titleTestId?: string;
  testId?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('overflow-hidden rounded-3xl bg-gradient-to-br text-brand-ink', TONES[tone], className)} data-testid={testId}>
      {art ? <div className="relative h-40">{art}</div> : null}
      <div className="flex flex-col gap-3 p-5">
        {eyebrow ? <p className="text-xs font-semibold text-primary">{eyebrow}</p> : null}
        {title || icon ? (
          <div className="flex items-start gap-3">
            {icon ? (
              <span aria-hidden="true" className="shrink-0 text-4xl leading-none">
                {icon}
              </span>
            ) : null}
            {title ? (
              <Title className="min-w-0 text-2xl font-bold leading-snug" data-testid={titleTestId}>
                {title}
              </Title>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Quiet body text inside a HeroCard. */
export function HeroText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm leading-relaxed opacity-80', className)}>{children}</p>;
}

/** White stat pills inside a HeroCard; empty items are dropped. */
export function HeroPills({ items, testId }: { items: (ReactNode | null | false | undefined)[]; testId?: string }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid={testId}>
      {shown.map((item, i) => (
        <li key={i} className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold tabular-nums">
          {item}
        </li>
      ))}
    </ul>
  );
}

export type PromptTone = 'warm' | 'lavender';

const PROMPT_TONES: Record<PromptTone, string> = {
  warm: 'border-brand-orange-soft bg-accent',
  lavender: 'border-brand-lavender bg-card',
};

/**
 * One thing to do now: emoji, title, one line of why, and the action. With `action` the action sits at
 * the end of the row; with `children` the actions go under the text (several buttons, a list).
 */
export function PromptCard({
  icon,
  title,
  body,
  action,
  tone = 'warm',
  testId,
  className,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: PromptTone;
  testId?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-3xl border-2 p-4 text-foreground', PROMPT_TONES[tone], className)} data-testid={testId}>
      <div className="flex items-center gap-3">
        {icon ? (
          <span aria-hidden="true" className="shrink-0 text-2xl">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-bold">{title}</p>
          {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
