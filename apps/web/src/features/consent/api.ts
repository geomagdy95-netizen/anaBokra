export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; details?: { retryAfterSec?: number } };

/** POST JSON to a consent route. Never throws: network failures become { ok: false, error: 'network' }. */
export async function postJson<T = Record<string, never>>(url: string, body: unknown = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Localised message for an error code of the consent API (falls back to the generic one). */
export function errorText(t: { has: (k: string) => boolean; (k: string): string }, code: string): string {
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.server_error');
}
