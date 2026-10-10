import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Per-station progress and the current station. */
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return handleAssessment(request, {
    method: 'GET',
    run: async ({ service, userId }) => ({ progress: await service.getProgress(userId, { sessionId }) }),
  });
}
