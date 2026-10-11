'use client';

import { POSITIVE_FLAGS, type ContextFlag } from '@anabokra/engine';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { FitBadge } from './career-card';
import { usePersonal } from './personal-context';
import { reasonText, watchOutText, type ReasonLike } from './reasons';

/** The signed-in student's fit for this career with the top "why it fits" reasons; a prompt to take the assessment otherwise. */
export function FitPanel({ careerId }: { careerId: string }) {
  const t = useTranslations('Careers.fit');
  const tr = useTranslations('Careers');
  const { data, ready } = usePersonal();
  if (!ready) return null;

  const mine = data.fits[careerId];
  if (!mine) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4" data-testid="fit-cta">
        <p className="text-sm">{data.signedIn ? t('noResult') : t('signedOut')}</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/assessment">{t('cta')}</Link>
        </Button>
      </div>
    );
  }

  const tt = (key: string, values?: Record<string, string | number>) => tr(key, values);
  const reasons = (mine.reasons as ReasonLike[]).flatMap((r) => reasonText(r, tt) ?? []).slice(0, 3);
  const watch = (mine.watchOuts as ReasonLike[]).flatMap((w) => watchOutText(w, tt) ?? []).slice(0, 2);
  // A matching field of study is good news: it goes with the reasons, not the cautions.
  const isGood = (f: string) => POSITIVE_FLAGS.includes(f as ContextFlag);
  const goodFlags = mine.flags.filter(isGood);
  const cautionFlags = mine.flags.filter((f) => !isGood(f));

  return (
    <section aria-labelledby="fit-title" className="space-y-3 rounded-lg border bg-card p-4" data-testid="fit-panel">
      <div className="flex items-center gap-3">
        <h2 id="fit-title" className="text-base font-semibold">
          {t('title')}
        </h2>
        <FitBadge fit={mine.fit} />
      </div>
      {reasons.length || goodFlags.length ? (
        <div>
          <p className="text-sm font-medium">{t('why')}</p>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {goodFlags.map((f) => (
              <li key={f}>{tr(`flags.${f}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {watch.length || cautionFlags.length ? (
        <div>
          <p className="text-sm font-medium">{t('watch')}</p>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {watch.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {cautionFlags.map((f) => (
              <li key={f}>{tr(`flags.${f}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
