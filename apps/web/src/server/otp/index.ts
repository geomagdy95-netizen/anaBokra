import { createConsoleSender } from './console';
import { createOpenWaSender } from './openwa';
import { OtpSendError, type OtpSender } from './types';
import { createWhatsAppCloudSender } from './whatsapp-cloud';

export type { ConsentMessenger, NoticeKind, NoticeMessage, OtpLocale, OtpMessage, OtpSender } from './types';
export { OtpSendError } from './types';

export const OTP_SENDERS = ['console', 'openwa', 'whatsappCloud'] as const;
export type OtpSenderName = (typeof OTP_SENDERS)[number];

/** Build the sender selected by `OTP_SENDER` (default: console in dev, required in production). */
export function createOtpSender(env: NodeJS.ProcessEnv = process.env): OtpSender {
  const need = (name: string): string => {
    const v = env[name]?.trim();
    if (!v) throw new OtpSendError('config', `Missing ${name} (required by OTP_SENDER=${selected})`);
    return v;
  };
  const selected = env.OTP_SENDER?.trim() || (env.NODE_ENV === 'production' ? '' : 'console');

  switch (selected) {
    case 'console':
      return createConsoleSender({ production: env.NODE_ENV === 'production' });
    case 'openwa':
      return createOpenWaSender({ baseUrl: need('OPENWA_URL'), apiKey: env.OPENWA_API_KEY?.trim() || undefined });
    case 'whatsappCloud':
      return createWhatsAppCloudSender({
        accessToken: need('WHATSAPP_CLOUD_TOKEN'),
        phoneNumberId: need('WHATSAPP_CLOUD_PHONE_NUMBER_ID'),
        templateName: need('WHATSAPP_CLOUD_TEMPLATE_NAME'),
        apiVersion: env.WHATSAPP_CLOUD_API_VERSION?.trim() || undefined,
        noticeTemplates: {
          consent_invite: env.WHATSAPP_CLOUD_TEMPLATE_CONSENT_INVITE?.trim() || undefined,
          child_claim: env.WHATSAPP_CLOUD_TEMPLATE_CHILD_CLAIM?.trim() || undefined,
          consent_granted: env.WHATSAPP_CLOUD_TEMPLATE_CONSENT_GRANTED?.trim() || undefined,
          consent_withdrawn: env.WHATSAPP_CLOUD_TEMPLATE_CONSENT_WITHDRAWN?.trim() || undefined,
        },
      });
    default:
      throw new OtpSendError('config', `OTP_SENDER must be one of ${OTP_SENDERS.join(', ')} (got "${selected}")`);
  }
}

let cached: { key: string; sender: OtpSender } | undefined;

/** Process-wide sender (re-created if OTP_SENDER changes, e.g. in tests). */
export function getOtpSender(): OtpSender {
  const key = process.env.OTP_SENDER ?? '';
  if (!cached || cached.key !== key) cached = { key, sender: createOtpSender() };
  return cached.sender;
}
