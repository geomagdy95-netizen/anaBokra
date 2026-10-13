'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { BandBar } from './band-bar';
import { card, chip, h2, mutedP } from './ui';
import { useRT } from './use-rt';
import type { ProfileView } from './view';

const SECTION_HREF = {
  holland: '/assessment/result/holland',
  bigFive: '/assessment/result/bigFive',
  values: '/assessment/result/values',
  abilities: '/assessment/result/abilities',
} as const;

export function ProfileOverview({ view, summary, partial }: { view: ProfileView; summary: string; partial?: boolean }) {
  const rt = useRT();
  const tr = useTranslations('Riasec');
  const detail = (k: keyof typeof SECTION_HREF) => (
    <Link href={SECTION_HREF[k]} className="tap-link">
      {rt('overview.seeDetail')}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5" data-testid="profile-overview">
      {partial ? <p className={mutedP}>{rt('overview.partial')}</p> : null}

      <section aria-labelledby="sum-h" className={card}>
        <h2 id="sum-h" className={h2}>
          {rt('overview.summaryTitle')}
        </h2>
        <p className="mt-2 leading-relaxed" data-testid="summary">
          {summary || rt('overview.summaryEmpty')}
        </p>
      </section>

      {view.types.length > 0 && (
        <section aria-labelledby="holland-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="holland-h" className={h2}>
              {rt('overview.hollandTitle')}
            </h2>
            {detail('holland')}
          </div>
          <p className={mutedP}>{rt('overview.hollandIntro')}</p>
          <p className="text-3xl font-semibold tracking-widest" dir="ltr" aria-label={rt('overview.hollandCode', { code: view.hollandCode.split('').join(' ') })}>
            {view.hollandCode}
          </p>
          <ol className="grid gap-3">
            {view.types.map((t) => (
              <li key={t.id} className={card} data-testid="type-card">
                <p className="flex items-center gap-2">
                  <span className={chip} dir="ltr">
                    {t.id}
                  </span>
                  <span className="font-semibold">{tr(t.id)}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{rt(`items.${t.id}.meaning`)}</p>
                <div className="mt-3">
                  <BandBar band={t.band} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.bigFive.length > 0 && (
        <section aria-labelledby="b5-h" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="b5-h" className={h2}>
              {rt('overview.bigFiveTitle')}
            </h2>
            {detail('bigFive')}
          </div>
          <p className={mutedP}>{rt('overview.bigFiveIntro')}</p>
          <ul className="mt-3 flex flex-col gap-3" data-testid="big-five">
            {view.bigFive.map((b) => (
              <li key={b.trait} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{rt(`items.${b.trait}.name`)}</span>
                <BandBar band={b.band} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.values.length > 0 && (
        <section aria-labelledby="val-h" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="val-h" className={h2}>
              {rt('overview.valuesTitle')}
            </h2>
            {detail('values')}
          </div>
          <p className={mutedP}>{rt('overview.valuesIntro')}</p>
          <ol className="mt-3 flex flex-col gap-2" data-testid="top-values">
            {view.values.map((v, i) => (
              <li key={v.value} className="flex items-baseline gap-2">
                <span className={chip}>{rt('overview.valueRank', { n: i + 1 })}</span>
                <span className="font-medium">{rt(`items.${v.value}.name`)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.abilities.length > 0 && (
        <section aria-labelledby="abl-h" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="abl-h" className={h2}>
              {rt('overview.abilitiesTitle')}
            </h2>
            {detail('abilities')}
          </div>
          <p className={mutedP}>{rt('overview.abilitiesIntro')}</p>
          <ul className="mt-3 flex flex-col gap-3" data-testid="abilities">
            {view.abilities.map((a) => (
              <li key={a.domain} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {rt(`items.${a.domain}.name`)}
                  {a.selfReported ? (
                    <span className={chip} title={rt('overview.selfReportedHint')}>
                      {rt('overview.selfReported')}
                    </span>
                  ) : null}
                </span>
                <BandBar band={a.band} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={mutedP} data-testid="guidance-note">
        {rt('overview.guidance')}
      </p>
    </div>
  );
}
