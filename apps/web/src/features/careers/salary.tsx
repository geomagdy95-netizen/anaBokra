import { useLocale, useTranslations } from 'next-intl';

import { BulletList, pick, SubHeading } from './common';
import { linkClass } from './ui';
import type { CareerPage, Locale, SalaryBand } from './types';

const BANDS = ['junior', 'mid', 'senior'] as const;

/**
 * Monthly gross salary bands from a cited source, or, when no citable figure exists, the page's own
 * explanation (never an invented number).
 */
export function SalaryBands({ market }: { market: NonNullable<CareerPage['marketEgypt']> }) {
  const t = useTranslations('Careers.salary');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const salary = market.salaryMonthlyEgp ?? null;

  if (!salary) {
    return (
      <div data-testid="salary-empty" className="space-y-2 rounded-lg border border-dashed p-4">
        <p className="font-medium">{t('noneTitle')}</p>
        <p className="text-muted-foreground">{market.salaryNote ? pick(market.salaryNote, locale) : t('noneDefault')}</p>
      </div>
    );
  }

  const range = (b: SalaryBand) => t('range', { min: nf.format(b.min), max: nf.format(b.max) });
  return (
    <div data-testid="salary-bands" className="space-y-3">
      <table className="w-full border-collapse text-sm">
        <caption className="mb-2 text-start text-sm text-muted-foreground">{t('caption', { year: String(salary.year) })}</caption>
        <thead>
          <tr className="border-b text-start">
            <th scope="col" className="py-2 pe-4 text-start font-medium">
              {t('level')}
            </th>
            <th scope="col" className="py-2 text-start font-medium">
              {t('monthly')}
            </th>
          </tr>
        </thead>
        <tbody>
          {BANDS.map((key) => {
            const band = salary[key];
            return (
              <tr key={key} className="border-b last:border-0">
                <th scope="row" className="py-2 pe-4 text-start font-normal">
                  {t(`levels.${key}`)}
                </th>
                <td className="py-2 tabular-nums">{band ? <bdi>{range(band)}</bdi> : <span className="text-muted-foreground">{t('notPublished')}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {salary.note ? <p className="text-sm text-muted-foreground">{pick(salary.note, locale)}</p> : null}
      <p className="text-sm">
        <a href={salary.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t('source')}
        </a>
      </p>
    </div>
  );
}

export function MarketSection({ market }: { market: NonNullable<CareerPage['marketEgypt']> }) {
  const t = useTranslations('Careers.market');
  const locale = useLocale() as Locale;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SubHeading>{t('salary')}</SubHeading>
        <SalaryBands market={market} />
      </div>
      {market.demand ? (
        <p>
          <span className="font-medium">{t('demand')}: </span>
          {t(`demandLevels.${market.demand}`)}
        </p>
      ) : null}
      {market.employers?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('employers')}</SubHeading>
          <BulletList items={market.employers} locale={locale} />
        </div>
      ) : null}
      {market.regions?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('regions')}</SubHeading>
          <BulletList items={market.regions} locale={locale} />
        </div>
      ) : null}
      {market.freelanceRemote ? (
        <div className="space-y-2">
          <SubHeading>{t('freelance')}</SubHeading>
          <p>{pick(market.freelanceRemote, locale)}</p>
        </div>
      ) : null}
    </div>
  );
}
