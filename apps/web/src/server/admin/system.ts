import { ASSESSMENT_VERSION, ENGINE_VERSION } from '@/server/assessment/config';

export type CheckStatus = 'ok' | 'warn' | 'missing';

export interface SystemCheck {
  key: string;
  status: CheckStatus;
  /** Non-secret detail (never a key or token value). */
  detail: string;
}

/** Variables the production deployment needs. Values are never displayed, only presence. */
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEND_SMS_HOOK_SECRETS',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
] as const;

export function systemChecks(env: NodeJS.ProcessEnv = process.env, dbReachable: boolean | null = null): SystemCheck[] {
  const prod = env.NODE_ENV === 'production';
  const checks: SystemCheck[] = REQUIRED.map((key) => ({
    key,
    status: env[key]?.trim() ? 'ok' : prod ? 'missing' : 'warn',
    detail: env[key]?.trim() ? 'set' : 'not set',
  }));

  const sender = env.OTP_SENDER?.trim() || 'console (default)';
  checks.push({
    key: 'OTP_SENDER',
    status: sender.startsWith('console') ? (prod ? 'missing' : 'warn') : 'ok',
    detail: sender,
  });

  const aiMode = env.ANABOKRA_AI_MODE === 'ai' ? 'ai' : 'template';
  checks.push({
    key: 'AI explanations',
    status: aiMode === 'ai' && !env.ANTHROPIC_API_KEY?.trim() ? 'missing' : 'ok',
    detail: aiMode === 'ai' ? `ai (${env.ANABOKRA_AI_MODEL || 'default model'})` : 'templates only',
  });

  checks.push({
    key: 'Data source',
    status: env.ASSESSMENT_REPO === 'memory' && !prod ? 'warn' : 'ok',
    detail: env.ASSESSMENT_REPO === 'memory' && !prod ? 'demo / mock mode' : 'Supabase',
  });

  if (dbReachable !== null) checks.push({ key: 'Database', status: dbReachable ? 'ok' : 'missing', detail: dbReachable ? 'reachable' : 'unreachable' });
  checks.push({ key: 'Versions', status: 'ok', detail: `assessment ${ASSESSMENT_VERSION} · engine ${ENGINE_VERSION}` });
  return checks;
}
