'use client';

import { useLocale } from 'next-intl';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { card, chip, h2, linkCls, mutedP } from './ui';
import { useRT } from './use-rt';
import type { MatchView } from './view';

function useNf() {
  return new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 0 });
}

export function MatchCard({ m, index }: { m: MatchView; index?: number }) {
  const rt = useRT();
  const nf = useNf();
  const id = useId();
  const cautions = [...m.watchOuts, ...m.flags];
  return (
    <article aria-labelledby={id} className={`${card} flex h-full flex-col gap-3`} data-testid="match-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="text-lg font-semibold leading-snug">
            {index !== undefined ? <span className="tabular-nums">{nf.format(index + 1)}. </span> : null}
            <Link href={`/careers/${m.careerId}`} className="underline-offset-4 hover:underline focus-visible:underline">
              {m.name}
            </Link>
          </h3>
          <p className={mutedP}>{m.cluster}</p>
        </div>
        <p className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-semibold tabular-nums text-primary-foreground" data-testid="fit">
          {rt('matches.fit', { n: nf.format(m.fit) })}
        </p>
      </header>
      {m.reasons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">{rt('matches.why')}</h4>
          <ul className="mt-1 list-disc ps-5 text-sm text-muted-foreground">
            {m.reasons.slice(0, 3).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {cautions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">{rt('matches.watch')}</h4>
          <ul className="mt-1 list-disc ps-5 text-sm text-muted-foreground" data-testid="watch-outs">
            {cautions.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/careers/${m.careerId}`} className="tap-link mt-auto">
        {rt('matches.view')}
        <span className="sr-only"> {m.name}</span>
      </Link>
    </article>
  );
}

function Carousel({ items }: { items: MatchView[] }) {
  const rt = useRT();
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  return (
    <section aria-roledescription="carousel" aria-labelledby="surprise-h" className="flex flex-col gap-3" data-testid="surprising">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="surprise-h" className={h2}>
            {rt('matches.surpriseTitle')}
          </h2>
          <p className={mutedP}>{rt('matches.surpriseIntro')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => scroll(-1)}>
            {rt('matches.prev')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => scroll(1)}>
            {rt('matches.next')}
          </Button>
        </div>
      </div>
      <ul
        ref={ref}
        tabIndex={0}
        aria-label={rt('matches.carousel')}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {items.map((m) => (
          <li key={m.careerId} className="w-[85%] shrink-0 snap-start" aria-roledescription="slide">
            <span className={`${chip} mb-2`}>{rt('matches.surpriseBadge')}</span>
            <MatchCard m={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Matches({ top, more, surprising }: { top: MatchView[]; more: MatchView[]; surprising: MatchView[] }) {
  const rt = useRT();
  const nf = useNf();
  const [open, setOpen] = useState(false);
  const moreId = useId();
  return (
    <div className="flex flex-col gap-6" data-testid="matches">
      <section aria-labelledby="top-h" className="flex flex-col gap-3">
        <h2 id="top-h" className={h2}>
          {rt('matches.title')}
        </h2>
        <p className={mutedP}>{rt('matches.intro')}</p>
        {top.length === 0 ? (
          <p>{rt('matches.empty')}</p>
        ) : (
          <ol className="grid gap-3">
            {top.map((m, i) => (
              <li key={m.careerId}>
                <MatchCard m={m} index={i} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {more.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <Button type="button" variant="outline" aria-expanded={open} aria-controls={moreId} onClick={() => setOpen((o) => !o)} data-testid="explore-more">
              {open ? rt('matches.hideMore') : rt('matches.exploreMore', { n: nf.format(more.length) })}
            </Button>
          </div>
          <div id={moreId} hidden={!open}>
            <h2 className={h2}>{rt('matches.moreTitle')}</h2>
            <ol className="mt-3 flex flex-col gap-2" start={top.length + 1}>
              {more.map((m, i) => (
                <li key={m.careerId} className="surface flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/careers/${m.careerId}`} className={linkCls}>
                      <span className="tabular-nums">{nf.format(top.length + i + 1)}. </span>
                      {m.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{m.cluster}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{rt('matches.fit', { n: nf.format(m.fit) })}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {surprising.length > 0 && <Carousel items={surprising} />}
    </div>
  );
}
