import { handleConsent, localeOf } from '@/server/consent/http';
import { ipHashFor } from '@/server/consent/runtime';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleConsent(request, {
    method: 'GET',
    roles: ['parent'],
    run: async ({ runtime }) => ({ children: await runtime.service.listChildren(runtime.userId) }),
  });
}

/** J3 (route B): the signed-in parent adds a child; the consent is recorded at creation (route parent_account). */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    roles: ['parent'],
    run: async ({ runtime, body }) => {
      const created = await runtime.service.addChild(
        { userId: runtime.userId, phone: runtime.phone },
        {
          name: body.name,
          dob: body.dob,
          school: body.school,
          teenPhone: body.teenPhone,
          relation: body.relation,
          guardianName: body.guardianName,
          checks: body.checks,
          locale: localeOf(body.locale),
        },
        { userAgent: request.headers.get('user-agent') ?? undefined, ipHash: ipHashFor(request) },
      );
      return { studentId: created.studentId, consentId: created.consent.id };
    },
  });
}
