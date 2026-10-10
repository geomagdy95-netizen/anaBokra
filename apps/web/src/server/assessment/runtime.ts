import { createClient, getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/server/supabase-admin';

import { getMockProfile, getMockRepo, isMockMode, MOCK_USER_ID } from './mock';
import { createAssessmentService, type AssessmentService } from './service';
import { SupabaseAssessmentRepo } from './supabase-repo';

export interface StudentProfile {
  gender: 'female' | 'male' | null;
  governorate: string | null;
  displayName: string | null;
}

export interface AssessmentRuntime {
  userId: string;
  service: AssessmentService;
  mock: boolean;
  profile(): Promise<StudentProfile>;
  saveGovernorate(value: string | null): Promise<void>;
}

/**
 * Who is calling and which backing store to use. Signed-in user + Supabase repo normally;
 * in dev mock mode (`ASSESSMENT_REPO=memory`, never in production) a fake student + memory repo.
 * Returns null when nobody is signed in.
 */
export async function getAssessmentRuntime(): Promise<AssessmentRuntime | null> {
  if (isMockMode()) {
    const mock = getMockProfile();
    return {
      userId: MOCK_USER_ID,
      service: createAssessmentService({ repo: getMockRepo() }),
      mock: true,
      profile: async () => ({ ...getMockProfile(), displayName: process.env.ASSESSMENT_MOCK_NAME ?? 'Sara' }),
      saveGovernorate: async (value) => {
        mock.governorate = value;
      },
    };
  }
  if (process.env.ASSESSMENT_REPO === 'memory') {
    console.warn('[assessment] ASSESSMENT_REPO=memory is ignored in production');
  }

  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  return {
    userId: user.id,
    service: createAssessmentService({ repo: new SupabaseAssessmentRepo(supabase, createAdminClient()) }),
    mock: false,
    profile: async () => {
      const { data } = await supabase.from('profiles').select('gender, governorate, display_name').eq('id', user.id).maybeSingle();
      return {
        gender: data?.gender === 'female' || data?.gender === 'male' ? data.gender : null,
        governorate: typeof data?.governorate === 'string' ? data.governorate : null,
        displayName: typeof data?.display_name === 'string' && data.display_name.trim() ? data.display_name.trim() : null,
      };
    },
    saveGovernorate: async (value) => {
      const { error } = await supabase.from('profiles').update({ governorate: value }).eq('id', user.id);
      if (error) throw error;
    },
  };
}
