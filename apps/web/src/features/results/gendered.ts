type Values = Record<string, string | number>;

/** Picks `<key>F` for a female student in Arabic when it exists. Shared by server pages and client components. */
export function genderedT(
  t: { (key: string, values?: Values): string; has(key: string): boolean },
  locale: string,
  gender: 'female' | 'male' | null,
  key: string,
  values?: Values,
): string {
  return locale === 'ar' && gender === 'female' && t.has(`${key}F`) ? t(`${key}F`, values) : t(key, values);
}

