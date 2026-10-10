import { otpText } from './message';
import { toWaDigits } from './phone';
import { OtpSendError, type NoticeMessage, type OtpMessage, type OtpSender } from './types';

export interface OpenWaConfig {
  /** Base URL of the open-wa EASY API server (a separate container), e.g. http://openwa:8002 */
  baseUrl: string;
  /** Optional `api_key` header (open-wa `--key`). */
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * open-wa EASY API adapter: POST {baseUrl}/sendText with { args: { to: "<digits>@c.us", content } }.
 * open-wa answers 200 with { success: false, error } for some failures, so the body is checked too.
 */
export function createOpenWaSender(config: OpenWaConfig): OtpSender {
  const doFetch = config.fetch ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, '')}/sendText`;
  async function post(phone: string, content: string): Promise<void> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { api_key: config.apiKey } : {}),
        },
        body: JSON.stringify({ args: { to: `${toWaDigits(phone)}@c.us`, content } }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 10_000),
      });
    } catch (err) {
      throw new OtpSendError('network', `open-wa unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) throw new OtpSendError('upstream', `open-wa responded ${res.status}`, res.status);
    const body = (await res.json().catch(() => null)) as { success?: boolean; error?: unknown } | null;
    if (body && body.success === false) {
      throw new OtpSendError('upstream', `open-wa rejected the message: ${JSON.stringify(body.error ?? '')}`, res.status);
    }
  }
  return {
    name: 'openwa',
    send: ({ phone, code, locale }: OtpMessage) => post(phone, otpText(code, locale)),
    sendNotice: ({ phone, text }: NoticeMessage) => post(phone, text),
  };
}
