/**
 * Phone number normalization to E.164.
 *
 * Egyptian mobile numbers are the primary case: users type them as 010xxxxxxxx,
 * 10xxxxxxxx, +2010xxxxxxxx, 002010xxxxxxxx or with spaces/dashes/Arabic digits.
 * Egyptian mobiles are +20 1[0125]xxxxxxxx (operators: 10 Vodafone, 11 Etisalat, 12 Orange, 15 WE).
 * Any other country is accepted only when typed with an explicit "+" or "00" prefix.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

const EG_MOBILE = /^\+201[0125]\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/** Replace Arabic-Indic and Persian digits with ASCII digits. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : EXT_ARABIC_INDIC.indexOf(ch));
  });
}

/**
 * Normalize user input to E.164. Returns null when the input is not a plausible number.
 * `defaultCountry` only supports Egypt for now; extend here when other markets launch.
 */
export function normalizePhone(input: string, defaultCountry: 'EG' = 'EG'): string | null {
  void defaultCountry;
  if (typeof input !== 'string' || input.length > 40) return null;

  // Strip formatting (spaces, dashes, dots, parentheses, RTL/LTR marks, NBSP).
  let s = toAsciiDigits(input)
    .replace(/[\s\-().‎‏‪-‮ ]/g, '');
  if (!/^\+?\d+$/.test(s)) return null;

  let international = false;
  if (s.startsWith('+')) {
    international = true;
  } else if (s.startsWith('00')) {
    s = `+${s.slice(2)}`;
    international = true;
  }

  if (international) {
    if (s.startsWith('+20')) return EG_MOBILE.test(s) ? s : null;
    return E164.test(s) ? s : null;
  }

  // National Egyptian forms.
  let candidate: string | null = null;
  if (/^01[0125]\d{8}$/.test(s)) candidate = `+20${s.slice(1)}`; //  010xxxxxxxx
  else if (/^1[0125]\d{8}$/.test(s)) candidate = `+20${s}`; //        10xxxxxxxx
  else if (/^201[0125]\d{8}$/.test(s)) candidate = `+${s}`; //        2010xxxxxxxx
  else if (/^0201[0125]\d{8}$/.test(s)) candidate = `+${s.slice(1)}`; // 02010xxxxxxxx (common typo)
  return candidate && EG_MOBILE.test(candidate) ? candidate : null;
}

/**
 * Normalize a phone as stored by Supabase Auth (E.164 digits, usually WITHOUT the "+").
 * Used on the auth hook payload where the country is always already included.
 */
export function normalizeAuthPhone(phone: string): string | null {
  if (typeof phone !== 'string') return null;
  const s = phone.trim();
  const withPlus = s.startsWith('+') ? s : `+${s}`;
  if (withPlus.startsWith('+20')) return EG_MOBILE.test(withPlus) ? withPlus : null;
  return E164.test(withPlus) ? withPlus : null;
}

/** Digits only (no "+"), the form WhatsApp Cloud API expects for `to`. */
export const toWaDigits = (e164: string): string => e164.replace(/^\+/, '');

/** "+20 10• ••• 5678" style mask for display. */
export function maskPhone(e164: string): string {
  if (e164.length <= 6) return e164;
  return `${e164.slice(0, 4)}${'•'.repeat(Math.max(e164.length - 8, 1))}${e164.slice(-4)}`;
}
