import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Decision-readiness pre/post. Body: { phase: 'pre'|'post', sessionId?, answers: { rd_01: 1..5, ... } }. */
export async function PUT(request: Request) {
  return handleAssessment(request, {
    method: 'PUT',
    run: async ({ service, userId, body }) => ({ readiness: await service.saveReadiness(userId, body) }),
  });
}
