'use client';

import { useLocale } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { BandBar } from './band-bar';
import { card, chip, h2, linkCls, mutedP } from './ui';
import { useRT } from './use-rt';
import { SECTIONS, type Section, type SectionItem } from './view';

export function SectionDetail({
  section,
  items,
  suits,
}: {
  section: Section;
  items: SectionItem[];
  suits: { careerId: string; name: string; fit: number }[];
}) {
  const rt = useRT();
  const nf = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 0 });
  return (
    <div className="flex flex-col gap-5" data-testid="section-detail">
      <h1 className="text-3xl font-semibold">{rt(`sections.${section}`)}</h1>
      {items.length === 0 ? <p>{rt('detail.notAvailable')}</p> : null}
      <ul className="flex flex-col gap-4">
        {items.map((it) => (
          <li key={it.id} className={card} data-testid="detail-item">
            <h2 className={h2}>{rt(`items.${it.id}.name`)}</h2>
            <dl className="mt-3 flex flex-col gap-3">
              <div>
                <dt className="text-sm font-semibold">{rt('detail.meaning')}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{rt(`items.${it.id}.meaning`)}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold">{rt('detail.yourBand')}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <BandBar band={it.band} />
                  {it.selfReported ? <span className={chip}>{rt('overview.selfReported')}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold">{rt('detail.shows')}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{rt(`items.${it.id}.shows`)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <section aria-labelledby="suits-h" className={card}>
        <h2 id="suits-h" className={h2}>
          {rt('detail.suits')}
        </h2>
        {suits.length === 0 ? (
          <p className={mutedP}>{rt('detail.noSuits')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {suits.map((c) => (
              <li key={c.careerId} className="flex items-center justify-between gap-3">
                <Link href={`/careers/${c.careerId}`} className={linkCls}>
                  {c.name}
                </Link>
                <span className="text-sm tabular-nums text-muted-foreground">{rt('matches.fit', { n: nf.format(c.fit) })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={mutedP} data-testid="guidance-note">
        {rt('detail.guidance')}
      </p>

      <nav aria-label={rt('detail.others')} className="flex flex-wrap gap-2">
        {SECTIONS.filter((s) => s !== section).map((s) => (
          <Link key={s} href={`/assessment/result/${s}`} className={`${chip} hover:bg-accent`}>
            {rt(`sections.${s}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
