import { handleConsent, localeOf } from '@/server/consent/http';
import { ConsentError } from '@/server/consent/types';

export const runtime = 'nodejs';

/**
 * J8: withdraw a consent (the granting parent, the student, or school admins for school-route consent).
 * The DB pauses the open full session and locks engagement features; `effects` tells the UI.
 */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    run: async ({ runtime, body }) => {
      if (typeof body.consentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.consentId)) throw new ConsentError('invalid_input', 'consentId');
      const { effects, consent } = await runtime.service.withdraw({ userId: runtime.userId, phone: runtime.phone, locale: localeOf(body.locale) }, body.consentId, body.reason);
      return { effects, withdrawnAt: consent.withdrawnAt };
    },
  });
}
