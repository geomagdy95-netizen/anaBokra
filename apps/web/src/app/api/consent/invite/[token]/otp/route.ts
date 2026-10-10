import { getGuardianAuth } from '@/server/consent/guardian-auth';
import { handlePublic, localeOf } from '@/server/consent/http';
import { maskPhone } from '@/server/otp/phone';

export const runtime = 'nodejs';

/** J1: send the one-time code to the number the invite was addressed to (never to a number the browser supplies). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handlePublic(request, {
    run: async ({ service, body }) => {
      const phone = await service.invitedPhone(token);
      await getGuardianAuth().sendCode(phone, localeOf(body.locale), request.headers);
      return { masked: maskPhone(phone) };
    },
  });
}
