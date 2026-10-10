import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Batched idempotent save. Body: { station, responses: [{ itemId, value, ms? }], cursor? }. */
export async function PUT(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return handleAssessment(request, {
    method: 'PUT',
    run: ({ service, userId, body }) => service.saveResponses(userId, { ...(body as object), sessionId }),
  });
}
