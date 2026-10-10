import { handleConsent, localeOf } from '@/server/consent/http';

export const runtime = 'nodejs';

/** B8: resend (max 3 per rolling day). Issues a fresh link; the earlier one stops working. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleConsent(request, {
    method: 'POST',
    roles: ['student'],
    run: async ({ runtime, body }) => ({ invite: await runtime.service.resend(runtime.userId, id, localeOf(body.locale)) }),
  });
}
