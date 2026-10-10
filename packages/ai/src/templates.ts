import type { CareerMatch, ContextFlag, Reason, WatchOut } from '@anabokra/engine';
import {
  ABILITY_LABELS,
  RIASEC_LABELS,
  TRAIT_LABELS,
  VALUE_LABELS,
  capitalize,
  g,
  joinList,
  label,
} from './labels';
import type { CareerExplanation, ExplainCareer, Gender, Locale } from './types';

/** Display name of a career in the requested language (falls back to the id). */
export function careerName(career: ExplainCareer | undefined, id: string, locale: Locale): string {
  return career?.name?.[locale] || career?.name?.en || id;
}

/** One warm sentence for a structured reason. */
export function reasonLine(reason: Reason, name: string, locale: Locale, gender: Gender): string {
  switch (reason.kind) {
    case 'interest': {
      const list = joinList(
        reason.types.map((t) => label(RIASEC_LABELS[t], locale)),
        locale,
      );
      return locale === 'ar'
        ? `${g(gender, 'أنت مهتم', 'أنتِ مهتمة')} ب${list}، وهذا ما تقوم عليه مهنة ${name}.`
        : `You enjoy ${list}, and the ${name} career is built around exactly that.`;
    }
    case 'personality': {
      const trait = label(TRAIT_LABELS[reason.trait], locale);
      return locale === 'ar'
        ? `${trait} ميزة حقيقية في مهنة ${name}.`
        : `${capitalize(trait)} is a real strength in the ${name} career.`;
    }
    case 'value': {
      const value = label(VALUE_LABELS[reason.value], locale);
      return locale === 'ar'
        ? `توفّر مهنة ${name} ${value}، وهذا مهم بالنسبة لك.`
        : `The ${name} career offers ${value}, which matters to you.`;
    }
    case 'ability': {
      const ability = label(ABILITY_LABELS[reason.domain], locale);
      return locale === 'ar'
        ? `لديك قدرة جيدة في ${ability}، وهذه المهنة تعتمد عليها كثيرًا.`
        : `You have a good head for ${ability}, and this career uses it a lot.`;
    }
  }
}

/** One gentle, growth-framed sentence for a watch-out. */
export function watchOutLine(w: WatchOut, name: string, locale: Locale, gender: Gender): string {
  switch (w.kind) {
    case 'personalityStretch': {
      const trait = label(TRAIT_LABELS[w.trait], locale);
      return locale === 'ar'
        ? `تتطلب مهنة ${name} أن تواصل تنمية ${trait}، وهي مهارة تنمو بالتدريب وأنت ${g(gender, 'قادر', 'قادرة')} على تطويرها.`
        : `The ${name} career asks you to keep building ${trait}, and that is a skill that grows with practice.`;
    }
    case 'abilityGap': {
      const ability = label(ABILITY_LABELS[w.domain], locale);
      return locale === 'ar'
        ? `تحتاج مهنة ${name} إلى قدر جيد من ${ability}، وهي مهارة يمكن تنميتها بالتدريب خطوة بخطوة.`
        : `The ${name} career needs a good level of ${ability}, and that is a skill you can build step by step with practice.`;
    }
  }
}

/** One practical, non-judgmental sentence for a context flag. */
export function flagLine(flag: ContextFlag, name: string, locale: Locale): string {
  switch (flag) {
    case 'trackMismatch':
      return locale === 'ar'
        ? `تنبيه: مهنة ${name} تبدأ عادةً من شعبة مختلفة عن شعبتك في الثانوية، فمن الجيد أن تتعرف مبكرًا على طرق الالتحاق بها.`
        : `Heads-up: the ${name} career usually starts from a different secondary-school track than yours, so it is worth checking the entry routes early.`;
    case 'scoreReach':
      return locale === 'ar'
        ? 'مجموع القبول المعتاد لهذا المسار أعلى من مجموعك المتوقع، فاعتبره هدفًا طموحًا وضع أمامك مسارًا بديلًا.'
        : 'The usual admission score for this route is above the score you expect, so treat it as a stretch goal and keep a backup route in mind.';
    case 'costHigh':
      return locale === 'ar'
        ? 'قد تكون تكلفة الدراسة لهذه المهنة أعلى من ميزانيتك، فقارن بين الخيارات والتكاليف مبكرًا.'
        : 'Studying toward this career can cost more than your budget, so it is worth comparing options and costs early.';
  }
}

function opener(fit: number, name: string, locale: Locale): string {
  if (fit >= 75) {
    return locale === 'ar' ? `مهنة ${name} من أقوى المهن المناسبة لك.` : `The ${name} career is one of your strongest matches.`;
  }
  if (fit >= 60) {
    return locale === 'ar' ? `تبدو مهنة ${name} مناسبة لك وواعدة.` : `The ${name} career looks like a promising match for you.`;
  }
  return locale === 'ar' ? `مهنة ${name} تستحق أن تستكشفها.` : `The ${name} career is worth exploring.`;
}

/** Deterministic explanation for one match. Never uses or changes the numeric scores beyond a coarse opener. */
export function templateExplanation(
  match: CareerMatch,
  career: ExplainCareer | undefined,
  locale: Locale,
  gender: Gender,
): CareerExplanation {
  const name = careerName(career, match.careerId, locale);
  const byStrength = [...match.reasons].sort((a, b) => b.strength - a.strength);
  const reasons = match.reasons.map((r) => reasonLine(r, name, locale, gender));
  const watchOuts = match.watchOuts.map((w) => watchOutLine(w, name, locale, gender));
  const flags = match.flags.map((f) => flagLine(f, name, locale));

  const ranked = byStrength.map((r) => reasonLine(r, name, locale, gender));
  const caution = watchOuts[0] ?? flags[0];
  const parts = [opener(match.fit, name, locale)];
  if (ranked.length === 0) {
    parts.push(locale === 'ar' ? 'وهي تتوافق مع أكثر من جانب في ملفك.' : 'It fits several parts of your profile.');
  } else if (caution) {
    parts.push(ranked[0]!, caution);
  } else {
    parts.push(...ranked.slice(0, 2));
  }

  return { careerId: match.careerId, locale, text: parts.join(' '), reasons, watchOuts, flags, source: 'template' };
}
