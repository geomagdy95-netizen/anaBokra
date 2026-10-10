import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { NoticeMessage, OtpLocale } from '../otp/types';

/**
 * WhatsApp notices of the consent flows. DRAFT wording from docs/legal/consent-texts.{en,ar}.md
 * (sections 1, 3.2, 5.2); the strings live in messages/*.json (Consent.notice.*).
 * `params` follow the order of the {{n}} variables of the Cloud API templates.
 */
type Vars = Record<string, string>;

const bundle = (locale: OtpLocale) => (locale === 'en' ? en : ar).Consent.notice;
const fill = (template: string, vars: Vars) => template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** Only the first name is shown to the guardian ("teen nickname"). */
export function nickname(fullName: string | null | undefined, locale: OtpLocale): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return first || bundle(locale).fallbackTeen;
}

export function inviteNotice(o: { phone: string; locale: OtpLocale; teen: string; link: string }): NoticeMessage {
  return { phone: o.phone, kind: 'consent_invite', locale: o.locale, params: [o.teen, o.link], text: fill(bundle(o.locale).invite, { teen: o.teen, link: o.link }) };
}

export function childClaimNotice(o: { phone: string; locale: OtpLocale; parent: string; link: string }): NoticeMessage {
  return { phone: o.phone, kind: 'child_claim', locale: o.locale, params: [o.parent, o.link], text: fill(bundle(o.locale).childClaim, { parent: o.parent, link: o.link }) };
}

export function grantedNotice(o: { phone: string; locale: OtpLocale; teen: string; date: string; link: string }): NoticeMessage {
  return {
    phone: o.phone,
    kind: 'consent_granted',
    locale: o.locale,
    params: [o.teen, o.date, o.link],
    text: fill(bundle(o.locale).granted, { teen: o.teen, date: o.date, link: o.link }),
  };
}

export function withdrawnNotice(o: { phone: string; locale: OtpLocale; teen: string; date: string }): NoticeMessage {
  return { phone: o.phone, kind: 'consent_withdrawn', locale: o.locale, params: [o.teen, o.date], text: fill(bundle(o.locale).withdrawn, { teen: o.teen, date: o.date }) };
}
