'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { CORE_PHASES, type DemoProfile, type PhaseStatus } from './scenarios';
import { GROUP_ORDER, type GroupId, type IslandState } from './types';

const STATUS_STYLE: Record<PhaseStatus, { dot: string; card: string }> = {
  done: { dot: 'bg-[#7025B5] text-white', card: 'border-[#7025B5]/20 bg-[#F6F0FD]' },
  current: { dot: 'bg-[#FFA366] text-[#291137]', card: 'border-[#FFA366] bg-[#FFF5EC]' },
  todo: { dot: 'bg-[#291137]/10 text-[#291137]/50', card: 'border-[#291137]/10 bg-white' },
};

function Chips({ items, tone = 'violet' }: { items: string[]; tone?: 'violet' | 'apricot' }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((label) => (
        <li
          key={label}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium',
            tone === 'violet' ? 'bg-[#F1EBFA] text-[#5A1F93]' : 'bg-[#FFF0E4] text-[#8A4A1C]',
          )}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {aside && <span className="text-xs text-[#291137]/60">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** The core island's details page: who the student is and what they have discovered so far. */
export function ProfileSheet({
  profile,
  states,
  shortName,
  onClose,
  onPick,
}: {
  profile: DemoProfile;
  states: Record<GroupId, IslandState>;
  shortName: (id: GroupId) => string;
  onClose: () => void;
  onPick: (id: GroupId) => void;
}) {
  const t = useTranslations('DevWorld.profile');
  const tr = useTranslations('Riasec');
  const done = CORE_PHASES.filter((p) => profile.phases[p] === 'done').length;
  const allDone = done === CORE_PHASES.length;
  const suggested = GROUP_ORDER.filter((id) => states[id].relation === 'suggested');
  const added = GROUP_ORDER.filter((id) => states[id].relation === 'added');

  return (
    <section
      aria-label={t('title')}
      className="absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[80%] max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-[0_-12px_40px_rgba(41,17,55,0.18)]"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#291137]/15" aria-hidden />

      <header className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#FFA366] text-2xl font-bold text-[#291137]" aria-hidden>
          {t('demoName').charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#7025B5]">{t('title')}</p>
          <h2 className="truncate text-2xl font-bold">{t('demoName')}</h2>
          <p className="text-sm text-[#291137]/65">
            {t('meta', { grade: t(`grades.${profile.grade}`), track: t(`tracks.${profile.track}`) })}
          </p>
        </div>
        <button onClick={onClose} aria-label={t('close')} className="grid size-9 place-items-center self-start rounded-full text-xl hover:bg-[#291137]/5">
          ×
        </button>
      </header>

      <Section title={t('discovery')} aside={t('phasesDone', { done, total: CORE_PHASES.length })}>
        <ol className="grid grid-cols-2 gap-2">
          {CORE_PHASES.map((p) => {
            const status = profile.phases[p];
            return (
              <li key={p} className={cn('flex items-center gap-2 rounded-2xl border p-3', STATUS_STYLE[status].card)}>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', STATUS_STYLE[status].dot)} aria-hidden>
                  {status === 'done' ? '✓' : CORE_PHASES.indexOf(p) + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{t(`phases.${p}`)}</span>
                  <span className="block text-xs text-[#291137]/60">{t(`phaseStatus.${status}`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {profile.interests.length > 0 && (
        <Section title={t('interests')}>
          <Chips items={profile.interests.map((c) => tr(c))} />
        </Section>
      )}
      {profile.values.length > 0 && (
        <Section title={t('values')}>
          <Chips items={profile.values.map((k) => t(`valueNames.${k}`))} />
        </Section>
      )}
      {profile.strengths.length > 0 && (
        <Section title={t('strengths')}>
          <Chips items={profile.strengths.map((k) => t(`strengthNames.${k}`))} />
        </Section>
      )}

      <Section title={t('myIslands')}>
        {suggested.length + added.length === 0 ? (
          <p className="text-sm text-[#291137]/60">{t(profile.phases.interests === 'done' ? 'islandsUpdating' : 'emptyIslands')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[...suggested.map((id) => [id, 'suggested'] as const), ...added.map((id) => [id, 'added'] as const)].map(([id, kind]) => (
              <li key={id}>
                <button
                  onClick={() => onPick(id)}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-full border-2 px-3 text-sm font-bold transition-colors',
                    kind === 'suggested' ? 'border-[#7025B5] text-[#7025B5] hover:bg-[#7025B5]/5' : 'border-[#FF9A55] text-[#8A4A1C] hover:bg-[#FF9A55]/10',
                  )}
                >
                  {shortName(id)}
                  <span className="text-[11px] font-medium opacity-70">{t(kind === 'suggested' ? 'suggestedTag' : 'addedTag')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mt-6 grid gap-2">
        <button className="min-h-12 rounded-2xl bg-[#7025B5] font-bold text-white shadow-sm hover:brightness-110">
          {allDone ? t('review') : t('continue')}
        </button>
        <button className="min-h-11 rounded-2xl border-2 border-[#7025B5]/30 font-bold text-[#7025B5] hover:bg-[#7025B5]/5">{t('edit')}</button>
      </div>
      <p className="mt-3 text-center text-xs text-[#291137]/55">{t('note')}</p>
    </section>
  );
}
