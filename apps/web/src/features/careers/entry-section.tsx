import { Clock, Coins, FileCheck, GraduationCap, HeartPulse, IdCard, Lightbulb, MapPin, MessagesSquare, PenLine, ShieldCheck, Users, Hourglass, BadgeCheck, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { SituationCard } from '@/features/journey/situation-card';
import { cn } from '@/lib/utils';

import type { EntryView, Hurdle } from './entry';
import { linkClass } from './ui';
import type { EntryLevel, HurdleKind, Locale } from './types';

const ICONS: Record<HurdleKind, LucideIcon> = {
  grades: GraduationCap,
  exam: PenLine,
  interview: MessagesSquare,
  vetting: ShieldCheck,
  age: Hourglass,
  physical: HeartPulse,
  license: FileCheck,
  membership: IdCard,
  cost: Coins,
  time: Clock,
  experience: BadgeCheck,
  gender: Users,
  location: MapPin,
};

/** Colours for the overall level: calm for open routes, warm for the hardest. */
export const LEVEL_TONE: Record<EntryLevel, string> = {
  open: 'bg-brand-success/15 text-brand-success',
  moderate: 'bg-secondary text-secondary-foreground',
  competitive: 'bg-brand-orange-soft/30 text-brand-ink',
  very_competitive: 'bg-brand-orange text-brand-ink',
};

/** Three small bars: how hard one hurdle is. */
function Meter({ level, label }: { level: 1 | 2 | 3; label: string }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('h-1.5 w-4 rounded-full', i <= level ? (level === 3 ? 'bg-brand-orange' : 'bg-primary') : 'bg-border')} />
      ))}
    </span>
  );
}

function HurdleCard({ h }: { h: Hurdle }) {
  const t = useTranslations('Careers.entry');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const Icon = ICONS[h.kind];
  let text: string;
  let tip: string | null;
  if (h.derived) {
    const v = h.values;
    text =
      h.kind === 'grades'
        ? t('derived.grades', { min: nf.format(v.min!), max: nf.format(v.max!), year: String(v.year) })
        : h.kind === 'cost'
          ? t('derived.cost', { min: nf.format(v.min!), max: nf.format(v.max!) })
          : t('derived.time', { years: nf.format(v.years!) });
    tip = t(`derived.${h.kind}Tip`);
  } else {
    text = h.text[locale];
    tip = h.tip ? h.tip[locale] : null;
  }
  return (
    <li className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid="hurdle" data-kind={h.kind}>
      <div className="flex items-center gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', h.level === 3 ? 'bg-brand-orange-soft/30 text-brand-ink' : 'bg-secondary text-primary')}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 font-bold">{t(`kinds.${h.kind}`)}</span>
        <Meter level={h.level} label={t(`levels3.${h.level}`)} />
      </div>
      <p className="leading-relaxed">{text}</p>
      {tip ? (
        <p className="flex gap-2 rounded-xl bg-brand-lavender/60 p-3 text-sm text-brand-ink dark:bg-secondary dark:text-secondary-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">{t('tip')}: </span>
            {tip}
          </span>
        </p>
      ) : null}
      {h.source ? (
        <a href={h.source} target="_blank" rel="noopener noreferrer" className={cn(linkClass, 'text-xs')}>
          {t('source')}
        </a>
      ) : null}
    </li>
  );
}

/**
 * "What could stand in your way": the hurdles between a student and the career (grades, exams,
 * interviews, background checks, cost, years...), hardest first, each with what helps and a source.
 * `personal` (phase 1, on the phone) adds the optional circumstances card that marks which weigh more.
 */
export function EntrySection({ entry, personal = false }: { entry: EntryView; personal?: boolean }) {
  const t = useTranslations('Careers.entry');
  return (
    <div className="space-y-4" data-testid="entry">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground">{t('overall')}:</span>
        <span className={cn('rounded-full px-3 py-1 text-sm font-bold', LEVEL_TONE[entry.level])} data-testid="entry-level">
          {t(`levels.${entry.level}`)}
        </span>
      </div>
      <p className="max-w-prose text-muted-foreground">{t('intro')}</p>
      {personal ? <SituationCard hurdles={entry.hurdles.map((h) => ({ kind: h.kind, level: h.level }))} /> : null}
      <ul className="grid gap-3 @2xl:grid-cols-2">
        {entry.hurdles.map((h, i) => (
          <HurdleCard key={`${h.kind}-${i}`} h={h} />
        ))}
      </ul>
    </div>
  );
}
