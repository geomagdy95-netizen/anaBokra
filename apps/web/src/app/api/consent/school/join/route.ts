import { handleConsent } from '@/server/consent/http';

export const runtime = 'nodejs';

/** B9: a student joins their school with a class code (this does NOT grant consent). */
export async function POST(request: Request) {
  return handleConsent(request, {
    method: 'POST',
    roles: ['student'],
    run: async ({ runtime, body }) => ({ school: await runtime.service.joinClass(runtime.userId, body.code) }),
  });
}
