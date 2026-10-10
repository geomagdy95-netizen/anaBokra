/**
 * Search normalisation for Arabic and English career names.
 * Arabic: strips diacritics (tashkeel, dagger alef), tatweel and Quranic marks; folds alef variants,
 * ya/alef maqsura and ta marbuta, hamza carriers; maps Arabic-Indic digits to ASCII.
 */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ؤ/g, 'و') // ؤ -> و
    .replace(/ئ/g, 'ي') // ئ -> ي
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every whitespace-separated term of the query must appear in the haystack (after normalising both). */
export function matchesQuery(query: string, ...haystacks: string[]): boolean {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const hay = normalizeText(haystacks.join(' '));
  return terms.every((t) => hay.includes(t));
}
