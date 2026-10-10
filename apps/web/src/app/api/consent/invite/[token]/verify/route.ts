import { getGuardianAuth } from '@/server/consent/guardian-auth';
import { handlePublic, localeOf } from '@/server/consent/http';
import { hashToken } from '@/server/consent/token';

export const runtime = 'nodejs';

/** J1: check the code; on success the guardian is signed in (parent account created or reused). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handlePublic(request, {
    run: async ({ service, body }) => {
      const phone = await service.invitedPhone(token);
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      await getGuardianAuth().verifyCode(phone, code, hashToken(token), localeOf(body.locale), request.headers);
      return { verified: true };
    },
  });
}
