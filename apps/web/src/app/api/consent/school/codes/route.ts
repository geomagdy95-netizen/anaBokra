import { handleConsent } from '@/server/consent/http';
import { ConsentError } from '@/server/consent/types';

export const runtime = 'nodejs';

/** School admin: create a class code (one per class / cohort). */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    run: async ({ runtime, body }) => {
      const view = await runtime.service.schoolView(runtime.userId);
      if (!view) throw new ConsentError('forbidden');
      return runtime.service.createJoinCode(runtime.userId, view.organizationId, body.cohort);
    },
  });
}
