import type { Industry } from '@anabokra/content';
import { useLocale, useTranslations } from 'next-intl';

import { SubHeading } from './common';
import { badgeClass, linkClass } from './ui';
import type { Locale } from './types';

/** Industry outlook for the career's cluster: trend, confidence, 5-year demand, suggested skill changes and sources. */
export function OutlookSection({ industry }: { industry: Industry }) {
  const t = useTranslations('Careers.future');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const o = industry.outlook;
  const d = o.demand5y;
  const hasRange = d.low !== null && d.high !== null;

  return (
    <div className="space-y-5">
      <ul className="flex flex-wrap gap-2" aria-label={t('summary')}>
        <li className={badgeClass}>
          {t('trend')}: {t(`trends.${o.trend}`)}
        </li>
        <li className={badgeClass}>
          {t('confidence')}: {t(`confidenceLevels.${o.confidence}`)}
        </li>
      </ul>
      <p>{industry.name[locale]}</p>
      <div className="space-y-1">
        <SubHeading>{t('demand')}</SubHeading>
        <p>
          {hasRange ? (
            <bdi className="tabular-nums">
              {nf.format(d.low!)}% – {nf.format(d.high!)}%{' '}
            </bdi>
          ) : null}
          {d.band[locale]}
        </p>
      </div>
      <div className="space-y-1">
        <SubHeading>{t('rationale')}</SubHeading>
        <p>{o.rationale[locale]}</p>
      </div>
      {industry.suggestedChanges?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('changes')}</SubHeading>
          <ul className="space-y-1">
            {industry.suggestedChanges.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span>{c.name[locale]}</span>
                <span className={badgeClass}>{t(`momentum.${c.momentum}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {industry.sources?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('sources')}</SubHeading>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {industry.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {s.title}
                </a>
                {s.publisher ? <span className="text-muted-foreground"> - {s.publisher}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
