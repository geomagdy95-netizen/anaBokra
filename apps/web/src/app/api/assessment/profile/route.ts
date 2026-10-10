import { isGovernorate } from '@/features/assessment/governorates';
import { AssessmentError } from '@/server/assessment/errors';
import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** D7 helper: the governorate lives on the profile, not in the assessment context. Body: { governorate: string | null }. */
export async function PUT(request: Request) {
  return handleAssessment(request, {
    method: 'PUT',
    run: async ({ runtime, body }) => {
      const value = (body as { governorate?: unknown }).governorate;
      if (value !== null && !isGovernorate(value)) throw new AssessmentError('invalid_input', 'Unknown governorate');
      await runtime.saveGovernorate(value);
      return {};
    },
  });
}
