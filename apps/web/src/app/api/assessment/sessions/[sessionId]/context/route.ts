import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Context station. Body: { context: { curriculum?, track?, expectedScorePct?, budget? } } (null clears a field). */
export async function PUT(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return handleAssessment(request, {
    method: 'PUT',
    run: ({ service, userId, body }) => service.saveContext(userId, { ...(body as object), sessionId }),
  });
}
