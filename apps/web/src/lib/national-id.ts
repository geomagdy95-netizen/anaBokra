/**
 * Egyptian national ID number (14 digits): C YYMMDD GG SSSS K
 *   C     century: 2 = 1900s, 3 = 2000s
 *   YYMMDD date of birth
 *   GG    governorate of birth registration (88 = born abroad)
 *   SSSS  sequence; its last digit is odd for males, even for females
 *   K     check digit
 *
 * The check-digit rule is not officially published, so it is NOT enforced here (consent-texts §1.3:
 * confirm against an official source before relying on it). Everything else is checked.
 * Runs on the device only: the number is never sent anywhere.
 */

export const GOVERNORATES: Readonly<Record<string, { en: string; ar: string }>> = {
  '01': { en: 'Cairo', ar: 'القاهرة' },
  '02': { en: 'Alexandria', ar: 'الإسكندرية' },
  '03': { en: 'Port Said', ar: 'بورسعيد' },
  '04': { en: 'Suez', ar: 'السويس' },
  '11': { en: 'Damietta', ar: 'دمياط' },
  '12': { en: 'Dakahlia', ar: 'الدقهلية' },
  '13': { en: 'Sharqia', ar: 'الشرقية' },
  '14': { en: 'Qalyubia', ar: 'القليوبية' },
  '15': { en: 'Kafr El Sheikh', ar: 'كفر الشيخ' },
  '16': { en: 'Gharbia', ar: 'الغربية' },
  '17': { en: 'Monufia', ar: 'المنوفية' },
  '18': { en: 'Beheira', ar: 'البحيرة' },
  '19': { en: 'Ismailia', ar: 'الإسماعيلية' },
  '21': { en: 'Giza', ar: 'الجيزة' },
  '22': { en: 'Beni Suef', ar: 'بني سويف' },
  '23': { en: 'Fayoum', ar: 'الفيوم' },
  '24': { en: 'Minya', ar: 'المنيا' },
  '25': { en: 'Asyut', ar: 'أسيوط' },
  '26': { en: 'Sohag', ar: 'سوهاج' },
  '27': { en: 'Qena', ar: 'قنا' },
  '28': { en: 'Aswan', ar: 'أسوان' },
  '29': { en: 'Luxor', ar: 'الأقصر' },
  '31': { en: 'Red Sea', ar: 'البحر الأحمر' },
  '32': { en: 'New Valley', ar: 'الوادي الجديد' },
  '33': { en: 'Matrouh', ar: 'مطروح' },
  '34': { en: 'North Sinai', ar: 'شمال سيناء' },
  '35': { en: 'South Sinai', ar: 'جنوب سيناء' },
  '88': { en: 'Born abroad', ar: 'مواليد الخارج' },
};

export type NationalIdError = 'format' | 'century' | 'birth_date' | 'governorate' | 'future';

export interface NationalIdInfo {
  birthDate: Date;
  governorate: string;
  sex: 'male' | 'female';
}

const ARABIC_DIGITS = /[٠-٩]/g;

/** Accepts Arabic-Indic digits, spaces and dashes, as people type them. */
export function normalizeNationalId(raw: string): string {
  return raw.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\s-]/g, '');
}

export function parseNationalId(raw: string, today: Date = new Date()): { ok: true; info: NationalIdInfo } | { ok: false; error: NationalIdError } {
  const id = normalizeNationalId(raw);
  if (!/^\d{14}$/.test(id)) return { ok: false, error: 'format' };
  const century = id[0] === '2' ? 1900 : id[0] === '3' ? 2000 : null;
  if (!century) return { ok: false, error: 'century' };
  const year = century + Number(id.slice(1, 3));
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || birthDate.getUTCMonth() !== month - 1 || birthDate.getUTCDate() !== day) return { ok: false, error: 'birth_date' };
  if (birthDate.getTime() > today.getTime()) return { ok: false, error: 'future' };
  const governorate = id.slice(7, 9);
  if (!GOVERNORATES[governorate]) return { ok: false, error: 'governorate' };
  return { ok: true, info: { birthDate, governorate, sex: Number(id[12]) % 2 === 1 ? 'male' : 'female' } };
}

/** Whole years between a birth date and today. */
export function ageOn(birthDate: Date, today: Date = new Date()): number {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type GuardianRelation = 'mother' | 'father' | 'legal_guardian';

export type GuardianCheckError = NationalIdError | 'too_young' | 'gap';

export interface GuardianRules {
  /** Minimum age of the parent or guardian (consent-texts §1.3: [21], lawyer to confirm). */
  minAge: number;
  /** Mothers and fathers must be at least this much older than the youngest possible child. */
  minGap: number;
  /** Youngest age allowed for the young person (15). */
  childMinAge: number;
}

export const DEFAULT_GUARDIAN_RULES: GuardianRules = { minAge: 21, minGap: 15, childMinAge: 15 };

/**
 * Checks a parent's or guardian's ID against the consent rules. A legal guardian can be a younger
 * adult relative, so the age-gap rule applies only to mothers and fathers.
 */
export function checkGuardianId(
  raw: string,
  relation: GuardianRelation,
  rules: GuardianRules = DEFAULT_GUARDIAN_RULES,
  today: Date = new Date(),
): { ok: true; info: NationalIdInfo; age: number } | { ok: false; error: GuardianCheckError } {
  const parsed = parseNationalId(raw, today);
  if (!parsed.ok) return parsed;
  const age = ageOn(parsed.info.birthDate, today);
  if (age < rules.minAge) return { ok: false, error: 'too_young' };
  if (relation !== 'legal_guardian' && age < rules.childMinAge + rules.minGap) return { ok: false, error: 'gap' };
  return { ok: true, info: parsed.info, age };
}
