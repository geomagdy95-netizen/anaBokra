import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Mark a station done. Body (values station only): { valuesRanking?: WorkValue[] }. */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string; station: string }> }) {
  const { sessionId, station } = await params;
  return handleAssessment(request, {
    method: 'POST',
    run: async ({ service, userId, body }) => ({
      progress: await service.completeStation(userId, { ...(body as object), sessionId, station }),
    }),
  });
}
