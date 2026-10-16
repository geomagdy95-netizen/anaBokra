export const ADMIN_ROLES = ['super_admin', 'content_editor', 'data_curator', 'assessment_lead', 'support', 'analyst'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Which admin sections each role may open. super_admin sees everything. */
export const SECTION_ROLES = {
  overview: ADMIN_ROLES,
  users: ['super_admin', 'support', 'analyst'],
  assessment: ['super_admin', 'assessment_lead', 'analyst'],
  content: ['super_admin', 'content_editor', 'data_curator', 'assessment_lead'],
  flags: ['super_admin'],
  audit: ['super_admin'],
  system: ['super_admin'],
  insights: ['super_admin', 'analyst', 'assessment_lead'],
} as const satisfies Record<string, readonly AdminRole[]>;
export type AdminSection = keyof typeof SECTION_ROLES;

export const canOpen = (roles: readonly AdminRole[], section: AdminSection) =>
  roles.some((r) => (SECTION_ROLES[section] as readonly AdminRole[]).includes(r));

/** Raw assessment answers and full results are visible to these roles only; support sees a summary. */
export const canSeeAnswers = (roles: readonly AdminRole[]) =>
  roles.includes('super_admin') || roles.includes('assessment_lead');

export interface Overview {
  users: { total: number; students: number; parents: number; newLast7d: number };
  sessions: { started: number; inProgress: number; completed: number };
  results: number;
  consents: { active: number; withdrawn: number };
  /** Students → started → finished each station → result. */
  funnel: { step: string; count: number }[];
}

export interface UserRow {
  id: string;
  displayName: string;
  role: string;
  governorate: string | null;
  curriculum: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  consent: 'active' | 'withdrawn' | 'none';
  hasResult: boolean;
}

export interface UserDetail {
  profile: UserRow & { gender: string | null; grade: number | null; dateOfBirth: string | null; phoneMasked: string | null };
  consents: { id: string; route: string; method: string; policyVersion: string; grantedAt: string; withdrawnAt: string | null }[];
  sessions: { id: string; status: string; stationsDone: string[]; startedAt: string; completedAt: string | null }[];
  latestResult: { createdAt: string; hollandCode: string | null; topCareerIds: string[]; quality: string[]; coverage: number | null } | null;
}

export interface ResponseSample {
  sessionId: string;
  itemId: string;
  value: number;
  ms: number | null;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  description: string | null;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changedFields: string[];
  createdAt: string;
}

/**
 * Read model for the back office. The Supabase implementation runs with the service role,
 * so every caller must pass the admin guard first (see runtime.ts).
 */
export interface AdminRepo {
  readonly demo: boolean;
  getAdminRoles(userId: string): Promise<AdminRole[]>;
  overview(): Promise<Overview>;
  listUsers(query: { q?: string; role?: string; limit: number; offset: number }): Promise<{ rows: UserRow[]; total: number }>;
  getUser(id: string): Promise<UserDetail | null>;
  /** All saved answers for one instrument (used for item analytics). */
  responsesFor(instrumentId: string): Promise<ResponseSample[]>;
  listFlags(): Promise<FeatureFlag[]>;
  setFlag(key: string, enabled: boolean, actorId: string): Promise<FeatureFlag>;
  auditLog(query: { limit: number; entityType?: string }): Promise<AuditEntry[]>;
  ping(): Promise<boolean>;
}
