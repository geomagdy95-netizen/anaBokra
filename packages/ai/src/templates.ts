import { POSITIVE_FLAGS, type CareerMatch, type ContextFlag, type Reason, type WatchOut } from '@anabokra/engine';
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
        ? `${g(gender, 'إنت مهتم', 'إنتي مهتمة')} بـ${list}، ودي بالظبط الحاجة اللي مهنة ${name} قايمة عليها.`
        : `You enjoy ${list}, and the ${name} career is built around exactly that.`;
    }
    case 'personality': {
      const trait = label(TRAIT_LABELS[reason.trait], locale);
      return locale === 'ar'
        ? `${trait} حاجة بتفرق بجد في مهنة ${name}.`
        : `${capitalize(trait)} is a real strength in the ${name} career.`;
    }
    case 'value': {
      const value = label(VALUE_LABELS[reason.value], locale);
      return locale === 'ar'
        ? `مهنة ${name} فيها ${value}، ودي حاجة تهمك.`
        : `The ${name} career offers ${value}, which matters to you.`;
    }
    case 'ability': {
      const ability = label(ABILITY_LABELS[reason.domain], locale);
      return locale === 'ar'
        ? `${g(gender, 'إنت شاطر', 'إنتي شاطرة')} في ${ability}، والمهنة دي بتعتمد عليها كتير.`
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
        ? g(gender, `مهنة ${name} محتاجة منك تكمّل تنمّي ${trait}، ودي حاجة بتكبر بالتمرين وإنت قادر عليها.`, `مهنة ${name} محتاجة منك تكمّلي تنمّي ${trait}، ودي حاجة بتكبر بالتمرين وإنتي قادرة عليها.`)
        : `The ${name} career asks you to keep building ${trait}, and that is a skill that grows with practice.`;
    }
    case 'abilityGap': {
      const ability = label(ABILITY_LABELS[w.domain], locale);
      return locale === 'ar'
        ? `مهنة ${name} محتاجة مستوى كويس في ${ability}، ودي مهارة بتتبني بالتمرين خطوة بخطوة.`
        : `The ${name} career needs a good level of ${ability}, and that is a skill you can build step by step with practice.`;
    }
  }
}

/** One practical, non-judgmental sentence for a context flag. */
export function flagLine(flag: ContextFlag, name: string, locale: Locale): string {
  switch (flag) {
    case 'trackMismatch':
      return locale === 'ar'
        ? `تنبيه: مهنة ${name} غالبًا بتبدأ من شعبة غير شعبتك في الثانوي، فمعرفة طرق الدخول ليها بدري هتفيد.`
        : `Heads-up: the ${name} career usually starts from a different secondary-school track than yours, so it is worth checking the entry routes early.`;
    case 'scoreReach':
      return locale === 'ar'
        ? 'المجموع المعتاد للطريق ده أعلى من مجموعك المتوقع، فده هدف طموح، ووجود طريق بديل جنبه فكرة كويسة.'
        : 'The usual admission score for this route is above the score you expect, so treat it as a stretch goal and keep a backup route in mind.';
    case 'costHigh':
      return locale === 'ar'
        ? 'تكلفة الدراسة للمهنة دي ممكن تكون أعلى من ميزانيتك، فمقارنة الاختيارات والتكاليف بدري هتفرق.'
        : 'Studying toward this career can cost more than your budget, so it is worth comparing options and costs early.';
    case 'fieldMatch':
      return locale === 'ar'
        ? `مجال دراستك من الطرق المعتادة لمهنة ${name}، يعني هتبني على اللي اتعلمته فعلًا.`
        : `Your field of study is one of the usual routes into the ${name} career, so it builds on what you already know.`;
    case 'fieldSwitch':
      return locale === 'ar'
        ? `أغلب اللي بيشتغلوا في مهنة ${name} جايين من مجال دراسة غير مجالك. الانتقال ليها ممكن، وغالبًا محتاج كورسات أو دراسة زيادة.`
        : `Most people come to the ${name} career from a different field of study than yours. Moving in is possible, usually with extra courses or further study.`;
  }
}

function opener(fit: number, name: string, locale: Locale): string {
  if (fit >= 75) {
    return locale === 'ar' ? `مهنة ${name} من أقوى المهن اللي تناسبك.` : `The ${name} career is one of your strongest matches.`;
  }
  if (fit >= 60) {
    return locale === 'ar' ? `مهنة ${name} شكلها مناسبة وواعدة بالنسبالك.` : `The ${name} career looks like a promising match for you.`;
  }
  return locale === 'ar' ? `مهنة ${name} تستاهل نستكشفها مع بعض.` : `The ${name} career is worth exploring.`;
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
  const good = match.flags.filter((f) => POSITIVE_FLAGS.includes(f));
  // Good-news flags (the field of study fits) read as reasons, first, since cards show only the top
  // few; the rest are cautions.
  const reasons = [...good.map((f) => flagLine(f, name, locale)), ...match.reasons.map((r) => reasonLine(r, name, locale, gender))];
  const watchOuts = match.watchOuts.map((w) => watchOutLine(w, name, locale, gender));
  const flags = match.flags.filter((f) => !good.includes(f)).map((f) => flagLine(f, name, locale));

  const ranked = byStrength.map((r) => reasonLine(r, name, locale, gender));
  const caution = watchOuts[0] ?? flags[0];
  const parts = [opener(match.fit, name, locale)];
  if (ranked.length === 0) {
    parts.push(locale === 'ar' ? 'وبتتوافق مع أكتر من جانب في ملفك.' : 'It fits several parts of your profile.');
  } else if (caution) {
    parts.push(ranked[0]!, caution);
  } else {
    parts.push(...ranked.slice(0, 2));
  }

  return { careerId: match.careerId, locale, text: parts.join(' '), reasons, watchOuts, flags, source: 'template' };
}
