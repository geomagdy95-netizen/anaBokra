'use client';

import { industriesAsOf, industryById, type Industry } from '@anabokra/content';
import { Briefcase, ChevronDown, Compass, Globe, Laptop, Sparkles, Sun, TrendingUp, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

/**
 * What a field (career group) is about, for the island sheet. The intro is short and friendly; the
 * details come from the sourced sector profile (packages/content/industries) and fold away.
 */

type Locale = 'ar' | 'en';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-secondary text-primary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

/** Three short lines under the field's name: what it is, a day in it, who tends to enjoy it. */
export function FieldIntro({ id }: { id: string }) {
  const jt = useJT();
  const locale = useLocale() as Locale;
  const industry = industryById(id);
  if (!industry?.intro) return null;
  const { what, day, suits } = industry.intro;
  return (
    <div className="mt-4 space-y-3" data-testid="field-intro">
      <Row icon={<Compass className="size-4" />} label={jt('explore.about.what')}>
        {what[locale]}
      </Row>
      <Row icon={<Sun className="size-4" />} label={jt('explore.about.day')}>
        {day[locale]}
      </Row>
      <Row icon={<Users className="size-4" />} label={jt('explore.about.suits')}>
        {suits[locale]}
      </Row>
    </div>
  );
}

function Fold({ title, icon, children, testId }: { title: string; icon: ReactNode; children: ReactNode; testId: string }) {
  return (
    <details className="group rounded-2xl bg-background ring-1 ring-border/70" data-testid={testId}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="text-primary" aria-hidden>
          {icon}
        </span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}

const pill = 'inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground';

/** The field in Egypt and how AI is changing it, folded; sources at the end. */
export function FieldDetails({ id }: { id: string }) {
  const jt = useJT();
  const t = useTranslations('Careers.future');
  const locale = useLocale() as Locale;
  const industry: Industry | undefined = industryById(id);
  if (!industry) return null;
  const { outlook, business, technology } = industry;
  return (
    <section className="mt-6 space-y-2" aria-label={jt('explore.about.title')}>
      <h3 className="text-sm font-semibold">{jt('explore.about.title')}</h3>
      <Fold title={jt('explore.about.egypt')} icon={<TrendingUp className="size-5" />} testId="field-egypt">
        <div className="flex flex-wrap gap-2">
          <span className={pill}>
            {t('trend')}: {t(`trends.${outlook.trend}`)}
          </span>
          <span className={pill}>
            {t('confidence')}: {t(`confidenceLevels.${outlook.confidence}`)}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{outlook.demand5y.band[locale]}</p>
        <Row icon={<Briefcase className="size-4" />} label={jt('explore.about.employers')}>
          {business.employers[locale]}
        </Row>
        <Row icon={<Laptop className="size-4" />} label={jt('explore.about.freelance')}>
          {business.startupFreelance[locale]}
        </Row>
        <Row icon={<Globe className="size-4" />} label={jt('explore.about.abroad')}>
          {business.remoteGcc[locale]}
        </Row>
      </Fold>
      <Fold title={jt('explore.about.ai')} icon={<Sparkles className="size-5" />} testId="field-ai">
        <span className={cn(pill, technology.exposure === 'high' ? 'bg-brand-orange-soft/30' : '')}>{jt(`explore.about.exposure.${technology.exposure}`)}</span>
        <p className="text-sm leading-relaxed">{technology.summary[locale]}</p>
        <p className="text-sm leading-relaxed">{technology.howChanging[locale]}</p>
      </Fold>
      {industry.sources.length > 0 && (
        <details className="px-1 text-xs text-muted-foreground">
          <summary className="min-h-10 cursor-pointer py-2">{jt('explore.about.sources', { count: industry.sources.length })}</summary>
          <ul className="list-disc space-y-1 ps-5">
            {industry.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {s.title}
                </a>
                {s.publisher ? ` · ${s.publisher}` : ''}
                {s.year ? ` · ${s.year}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2">{jt('explore.about.asOf', { date: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(industriesAsOf)) })}</p>
        </details>
      )}
    </section>
  );
}
