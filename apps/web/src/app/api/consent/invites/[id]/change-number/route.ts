import { handleConsent, localeOf } from '@/server/consent/http';

export const runtime = 'nodejs';

/** B8: wrong number. Revokes this invite and invites the new number. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleConsent(request, {
    method: 'POST',
    roles: ['student'],
    run: async ({ runtime, body }) => ({ invite: await runtime.service.changeNumber(runtime.userId, id, { phone: body.phone, locale: localeOf(body.locale) }) }),
  });
}
