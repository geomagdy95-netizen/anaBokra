import { toWaDigits } from './phone';
import { OtpSendError, type NoticeKind, type NoticeMessage, type OtpMessage, type OtpSender } from './types';

export interface WhatsAppCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Name of the approved AUTHENTICATION template (body {{1}} = code, with a copy-code button). */
  templateName: string;
  apiVersion?: string;
  /** Approved UTILITY templates for transactional notices (body {{1}}.. = NoticeMessage.params), per kind and language. */
  noticeTemplates?: Partial<Record<NoticeKind, string>>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Meta WhatsApp Business Cloud API adapter using an authentication template.
 * The template must be approved in both `ar` and `en`. Authentication templates carry the
 * code in the body AND in the copy-code (URL-type) button parameter.
 */
export function createWhatsAppCloudSender(config: WhatsAppCloudConfig): OtpSender {
  const doFetch = config.fetch ?? fetch;
  const url = `https://graph.facebook.com/${config.apiVersion ?? 'v23.0'}/${config.phoneNumberId}/messages`;
  async function post(payload: Record<string, unknown>): Promise<void> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeoutMs ?? 10_000),
      });
    } catch (err) {
      throw new OtpSendError('network', `WhatsApp Cloud API unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
      throw new OtpSendError(
        'upstream',
        `WhatsApp Cloud API ${res.status}: ${detail?.error?.message ?? 'unknown error'} (code ${detail?.error?.code ?? '-'})`,
        res.status,
      );
    }
  }
  return {
    name: 'whatsappCloud',
    send: ({ phone, code, locale }: OtpMessage) =>
      post({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWaDigits(phone),
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: locale },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    sendNotice: ({ phone, kind, locale, params }: NoticeMessage) => {
      const name = config.noticeTemplates?.[kind];
      if (!name) return Promise.reject(new OtpSendError('config', `No WhatsApp template configured for notice "${kind}"`));
      return post({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWaDigits(phone),
        type: 'template',
        template: {
          name,
          language: { code: locale },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      });
    },
  };
}
