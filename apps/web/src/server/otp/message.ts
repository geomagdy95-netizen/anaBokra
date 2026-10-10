import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { OtpLocale } from './types';

/** WhatsApp text for adapters that send free-form messages (console, open-wa). Strings live in messages/*.json. */
export function otpText(code: string, locale: OtpLocale): string {
  const template = (locale === 'en' ? en : ar).Otp.body;
  return template.replaceAll('{code}', code);
}
