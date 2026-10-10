import { SaveFailure } from './save-queue';

export interface ResponseItem {
  itemId: string;
  value: number;
  ms?: number;
}

async function call<T>(method: 'PUT' | 'POST', url: string, body: unknown, init: { keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: init.keepalive,
    });
  } catch {
    throw new SaveFailure('network', true, 'network');
  }
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Record<string, unknown>) | null;
  if (res.ok && json?.ok) return json as T;
  const code = json?.error ?? 'server_error';
  // 5xx, 429 and 408 are worth retrying; everything else is a definite answer from the server.
  const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
  throw new SaveFailure(code, retryable, code);
}

const base = (sessionId: string) => `/api/assessment/sessions/${sessionId}`;

export const assessmentApi = {
  saveResponses: (sessionId: string, station: string, responses: ResponseItem[], cursor?: Record<string, unknown>, keepalive = false) =>
    call('PUT', `${base(sessionId)}/responses`, { station, responses, ...(cursor ? { cursor } : {}) }, { keepalive }),
  saveContext: (sessionId: string, context: Record<string, unknown>) => call('PUT', `${base(sessionId)}/context`, { context }),
  saveGovernorate: (governorate: string | null) => call('PUT', '/api/assessment/profile', { governorate }),
  completeStation: (sessionId: string, station: string, valuesRanking?: string[]) =>
    call('POST', `${base(sessionId)}/stations/${station}/complete`, valuesRanking ? { valuesRanking } : {}),
  saveReadiness: (sessionId: string, answers: Record<string, number>) => call('PUT', '/api/assessment/readiness', { phase: 'post', sessionId, answers }),
  finalize: (sessionId: string) => call('POST', `${base(sessionId)}/finalize`, {}),
};
