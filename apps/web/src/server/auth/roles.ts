/** Self-service roles. counselor / school_admin / admin are assigned by back-office only. */
export const SELF_SERVICE_ROLES = ['student', 'parent'] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export function parseRole(value: unknown): SelfServiceRole {
  return value === 'parent' ? 'parent' : 'student';
}

export function parseLocale(value: unknown): 'ar' | 'en' {
  return value === 'en' ? 'en' : 'ar';
}

/** Only allow same-site relative paths ("/account"), never "//evil.com" or "https://...". */
export function safeNextPath(value: unknown, fallback = '/account'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f]/.test(value) || value.startsWith('/api')) return fallback;
  return value;
}
