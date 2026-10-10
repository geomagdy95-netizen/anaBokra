import type { Locale } from './types';

/** Terms that must never appear in generated text (diagnosis, clinical, negative labels, promises, money). */
export const BANNED_EN: RegExp[] = [
  /\bdisorders?\b/i,
  /\bdiagnos(?:e|es|ed|is|ing|tic)\b/i,
  /\bclinical(?:ly)?\b/i,
  /\b(?:syndrome|pathology|pathological|symptoms?|illness|disease|mental health)\b/i,
  /\b(?:adhd|autis(?:m|tic)|dyslex\w*|depress\w*|anxi(?:ety|ous)|neurotic\w*|bipolar|ocd)\b/i,
  /\bIQ\b/,
  /\bintelligence quotient\b/i,
  /\byou(?:'ll| will| are going to| are bound to) fail\b/i,
  /\b(?:weak|stupid|dumb|lazy|incapable|unfit|hopeless|useless|loser|failure|untalented)\b/i,
  /\b(?:not (?:smart|clever|good) enough|bad at|too (?:dumb|slow))\b/i,
  /\b(?:impossible|never succeed|no chance)\b/i,
  /\bsalar(?:y|ies)\b/i,
  /\b(?:egp|usd|pounds?|income of|earn \w+)\b/i,
  /\bguarantee[sd]?\b/i,
  /\b(?:you(?:'ll| will) (?:be accepted|get in|be admitted)|certain(?:ly)? (?:to )?(?:get in|be accepted))\b/i,
];

export const BANNED_AR: string[] = [
  'اضطراب',
  'تشخيص',
  'تشخيصي',
  'مرض',
  'عيادي',
  'إكلينيكي',
  'اكلينيكي',
  'علاج نفسي',
  'اكتئاب',
  'قلق مرضي',
  'توحد',
  'فرط الحركة',
  'نسبة الذكاء',
  'معدل الذكاء',
  'ستفشل',
  'سوف تفشل',
  'حتما ستفشل',
  'فاشل',
  'ضعيف',
  'ضعيفة',
  'غبي',
  'غبية',
  'كسول',
  'كسولة',
  'عاجز',
  'عاجزة',
  'ميؤوس',
  'مستحيل',
  'لا أمل',
  'راتب',
  'رواتب',
  'جنيه',
  'دولار',
  'نضمن',
  'مضمونة',
  'ضمان',
  'سيتم قبولك',
  'قبولك مؤكد',
  'ستحصل على مقعد',
  'امراض',
];

export const TEXT_LIMITS = { minChars: 40, maxChars: 650, minSentences: 2, maxSentences: 4 } as const;

/** Strip Arabic diacritics/tatweel and unify alef/yaa/taa-marbuta forms so list matching is robust. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

const BANNED_AR_NORMALIZED = BANNED_AR.map(normalizeArabic);

export function countSentences(text: string): number {
  return text
    .split(/[.!?؟…]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

/** Post-check on model output for one career. Templates pass the same check (tested). */
export function checkText(text: string, locale: Locale, allowedNames: string[] = []): GuardrailResult {
  const t = text.trim();
  if (t.length < TEXT_LIMITS.minChars) return { ok: false, reason: 'too_short' };
  if (t.length > TEXT_LIMITS.maxChars) return { ok: false, reason: 'too_long' };

  // Career names are provided by us and may legitimately contain banned words, digits or symbols
  // (e.g. "Clinical Psychologist", "Animator / 3D Artist"), so they are masked before the content checks.
  let scan = t;
  for (const name of [...allowedNames].sort((a, b) => b.length - a.length)) {
    if (name) scan = scan.split(name).join('x');
  }

  const sentences = countSentences(scan);
  if (sentences < TEXT_LIMITS.minSentences || sentences > TEXT_LIMITS.maxSentences) {
    return { ok: false, reason: 'sentence_count' };
  }
  if (/[0-9\u0660-\u0669\u06F0-\u06F9]/.test(scan)) return { ok: false, reason: 'contains_number' };
  if (/[<>{}\[\]]|https?:/i.test(scan)) return { ok: false, reason: 'markup' };

  const hasArabic = /[\u0600-\u06FF]/.test(scan);
  if (locale === 'ar' && !hasArabic) return { ok: false, reason: 'wrong_language' };
  if (locale === 'en' && hasArabic) return { ok: false, reason: 'wrong_language' };

  // Banned terms are checked in both languages: a mixed-language answer is also suspect.
  for (const re of BANNED_EN) {
    if (re.test(scan)) return { ok: false, reason: `banned:${re.source}` };
  }
  const n = normalizeArabic(scan);
  for (const term of BANNED_AR_NORMALIZED) {
    if (n.includes(term)) return { ok: false, reason: `banned:${term}` };
  }
  return { ok: true };
}
