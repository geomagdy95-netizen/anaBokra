import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Score on the server and store the result. Idempotent. Body: {}. */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return handleAssessment(request, {
    method: 'POST',
    run: async ({ service, userId }) => ({ result: await service.finalize(userId, { sessionId }) }),
  });
}
