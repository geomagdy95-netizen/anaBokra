import { handleConsent, localeOf } from '@/server/consent/http';

export const runtime = 'nodejs';

/** Teen screen: consent gate state + the latest invite (sent / opened / ...). */
export async function GET(request: Request) {
  return handleConsent(request, {
    method: 'GET',
    roles: ['student'],
    run: async ({ runtime }) => ({ status: await runtime.service.teenStatus(runtime.userId), mock: runtime.mock }),
  });
}

/** B7: the teen enters the parent's WhatsApp number (+ who it is): creates the invite and sends the link. */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    roles: ['student'],
    run: async ({ runtime, body }) => ({
      invite: await runtime.service.askParent(runtime.userId, { phone: body.phone, hint: body.hint, locale: localeOf(body.locale) }),
    }),
  });
}
