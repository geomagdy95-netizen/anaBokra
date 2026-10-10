import { handleConsent, localeOf } from '@/server/consent/http';
import { ConsentError } from '@/server/consent/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleConsent(request, {
    method: 'GET',
    run: async ({ runtime }) => {
      const view = await runtime.service.schoolView(runtime.userId);
      if (!view) throw new ConsentError('forbidden');
      return { school: view };
    },
  });
}

/** B9 (route C): school staff record that the school holds the guardian's written consent for one student. */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    run: async ({ runtime, body }) => {
      const view = await runtime.service.schoolView(runtime.userId);
      if (!view || typeof body.studentId !== 'string') throw new ConsentError('forbidden');
      const consent = await runtime.service.recordSchoolConsent(runtime.userId, {
        organizationId: view.organizationId,
        studentId: body.studentId,
        method: body.method,
        representativeName: body.representativeName,
        confirmed: body.confirmed,
        locale: localeOf(body.locale),
      });
      return { consentId: consent.id };
    },
  });
}
