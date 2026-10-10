import type { AbilityDomain, BigFive, Riasec, WorkValue } from '@anabokra/engine';
import type { Gender, Locale } from './types';

/** Pick the right Arabic variant. Neutral uses the masculine default. */
export const g = (gender: Gender, male: string, female: string) => (gender === 'female' ? female : male);

export interface Label {
  en: string;
  ar: string;
}

/** What each RIASEC type is like, as an activity ("enjoy ..."). */
export const RIASEC_LABELS: Record<Riasec, Label> = {
  R: { en: 'hands-on, practical work', ar: 'العمل العملي واليدوي' },
  I: { en: 'investigating and figuring things out', ar: 'البحث والتحليل وفهم الأشياء' },
  A: { en: 'creating and expressing ideas', ar: 'الإبداع والتعبير عن الأفكار' },
  S: { en: 'helping, teaching and caring for people', ar: 'مساعدة الناس وتعليمهم' },
  E: { en: 'leading, persuading and starting things', ar: 'القيادة والإقناع وبدء المشاريع' },
  C: { en: 'organizing and working with details', ar: 'التنظيم والتعامل مع التفاصيل' },
};

/** Traits as strengths (noun phrases). */
export const TRAIT_LABELS: Record<BigFive, Label> = {
  extraversion: { en: 'your energy around people', ar: 'طاقتك في التعامل مع الناس' },
  agreeableness: { en: 'your cooperation and care for others', ar: 'تعاونك واهتمامك بالآخرين' },
  conscientiousness: { en: 'your organization and reliability', ar: 'تنظيمك والتزامك' },
  emotionalStability: { en: 'your calm under pressure', ar: 'هدوؤك تحت الضغط' },
  intellect: { en: 'your curiosity and love of ideas', ar: 'فضولك وحبك للأفكار' },
};

/** What the career offers (follows "offers ..." / "يوفّر ..."). */
export const VALUE_LABELS: Record<WorkValue, Label> = {
  achievement: { en: 'a chance to see your effort turn into results', ar: 'فرصة لترى جهدك يتحول إلى نتائج' },
  workingConditions: { en: 'a stable, comfortable workplace', ar: 'بيئة عمل مستقرة ومريحة' },
  recognition: { en: 'recognition for good work', ar: 'تقديرًا للعمل الجيد' },
  relationships: { en: 'good relationships with colleagues', ar: 'علاقات طيبة مع الزملاء' },
  support: { en: 'a supportive workplace', ar: 'بيئة داعمة' },
  independence: { en: 'the freedom to work in your own way', ar: 'حرية العمل بطريقتك' },
};

/** Abilities as areas ("good with ..."). */
export const ABILITY_LABELS: Record<AbilityDomain, Label> = {
  verbal: { en: 'words and language', ar: 'اللغة والكلمات' },
  numerical: { en: 'numbers', ar: 'الأرقام' },
  logical: { en: 'logical thinking', ar: 'التفكير المنطقي' },
  spatial: { en: 'picturing shapes and space', ar: 'تخيّل الأشكال والمساحات' },
  creative: { en: 'creative thinking', ar: 'التفكير الإبداعي' },
  manual: { en: 'working with your hands', ar: 'العمل بيديك' },
};

export const label = (l: Label, locale: Locale) => l[locale];

/**
 * Labels already contain "and"/"و" ("organizing and working with details"), so the last item is
 * joined with "as well as"/"وكذلك" to keep the list readable.
 */
export function joinList(items: string[], locale: Locale): string {
  if (items.length <= 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(locale === 'ar' ? '، ' : ', ');
  const last = items[items.length - 1];
  return locale === 'ar' ? `${head}، وكذلك ${last}` : `${head}, as well as ${last}`;
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
