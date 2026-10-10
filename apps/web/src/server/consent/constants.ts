/**
 * DRAFT legal content (MX-13). The wording and checkbox set come from docs/legal/consent-texts.{en,ar}.md,
 * which is NOT legal advice and must be reviewed by Egyptian counsel before launch. Changing a checkbox or
 * text means bumping CONSENT_TEXT_VERSION: it is stored with every consent record.
 */
export const CONSENT_TEXT_VERSION = 'consent-0.1-draft';
/** Privacy policy version shown with the consent; stored in consents.policy_version. */
export const POLICY_VERSION = CONSENT_TEXT_VERSION;

export const INVITE_TTL_DAYS = 7;
/** 1 first send + 3 resends per rolling 24h (enforced atomically in consent_invite_register_send). */
export const MAX_RESENDS_PER_DAY = 3;
export const MAX_INVITES_PER_DAY = 6;

export const RELATIONS = ['mother', 'father', 'legal_guardian', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * Checkbox ids of the guardian screen (consent-texts section 2, step 3). All unticked by default.
 * `required` ones must all be ticked; `analytics` is optional and never blocks anything.
 */
export const CONSENT_CHECKS = ['guardian', 'sensitive', 'ai', 'transfer', 'summary', 'read', 'analytics'] as const;
export type ConsentCheck = (typeof CONSENT_CHECKS)[number];
export const REQUIRED_CHECKS: readonly ConsentCheck[] = ['guardian', 'sensitive', 'ai', 'transfer', 'summary', 'read'];
/** Route B adds a family-account checkbox (consent-texts 3.3, box 8). */
export const FAMILY_CHECK = 'family' as const;

export const MIN_CHILD_AGE = 10;
export const MAX_CHILD_AGE = 17;

/** Mock mode only: the parent's one-time code (never accepted outside ASSESSMENT_REPO=memory). */
export const MOCK_OTP = '123456';
