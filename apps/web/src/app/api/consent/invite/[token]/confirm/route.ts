import { getGuardianAuth } from '@/server/consent/guardian-auth';
import { handlePublic, localeOf } from '@/server/consent/http';
import { ipHashFor } from '@/server/consent/runtime';
import { hashToken } from '@/server/consent/token';
import { ConsentError } from '@/server/consent/types';

export const runtime = 'nodejs';

/** J2: create the consent record (route teen_invite) + parent link; the invite is marked used. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handlePublic(request, {
    run: async ({ service, body }) => {
      const phone = await service.invitedPhone(token);
      const guardian = await getGuardianAuth().current(phone, hashToken(token));
      if (!guardian) throw new ConsentError('unauthenticated', 'verify the number first');
      const consent = await service.confirm(
        token,
        guardian,
        { name: body.name as string, relation: body.relation as never, checks: body.checks as string[] },
        { locale: localeOf(body.locale), userAgent: request.headers.get('user-agent') ?? undefined, ipHash: ipHashFor(request) },
      );
      return { consentId: consent.id, grantedAt: consent.grantedAt };
    },
  });
}
