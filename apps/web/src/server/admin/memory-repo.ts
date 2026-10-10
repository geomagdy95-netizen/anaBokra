import { instruments } from '@anabokra/content';
import type { LikertInstrument } from '@anabokra/engine';

import type { AdminRepo, AdminRole, AuditEntry, FeatureFlag, Overview, ResponseSample, UserDetail, UserRow } from './types';

/** Small seeded PRNG (mulberry32) so the demo data is identical on every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOVERNORATES = ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Sharqia', 'Qalyubia', 'Gharbia', 'Assiut', 'Minya', 'Sohag'];
const CURRICULA = ['thanaweya', 'thanaweya', 'thanaweya', 'igcse', 'american', 'ib'];
const STATIONS = ['interests', 'personality', 'values', 'abilities'];
const DEMO_STUDENTS = 60;

interface DemoUser {
  row: UserRow;
  detail: UserDetail;
}

/**
 * Answers driven by a latent trait per scale plus noise, so reliability looks like real data
 * (alpha roughly .75–.9) instead of random noise.
 */
function demoAnswers(instrument: LikertInstrument, sessionId: string, next: () => number, upTo = 1): ResponseSample[] {
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  const latent = new Map(instrument.scales.map((s) => [s.id, normal()]));
  const { min, max } = instrument.responseScale;
  const items = instrument.items.slice(0, Math.round(instrument.items.length * upTo));
  return items.map((item) => {
    if (item.attentionCheck) {
      const pass = next() < 0.93;
      return { sessionId, itemId: item.id, value: pass ? item.attentionCheck.expected : min, ms: 2500 };
    }
    const raw = 3 + 0.95 * (latent.get(item.scale!) ?? 0) * (item.keyed ?? 1) + 0.8 * normal();
    return { sessionId, itemId: item.id, value: Math.min(max, Math.max(min, Math.round(raw))), ms: Math.round(1500 + next() * 4000) };
  });
}

function buildDemo() {
  const next = rng(20261010);
  const users: DemoUser[] = [];
  const responses: Record<string, ResponseSample[]> = { interests: [], personality: [], readiness: [] };
  const now = Date.UTC(2026, 9, 10);
  const day = 86_400_000;

  for (let i = 0; i < DEMO_STUDENTS; i++) {
    const id = `de300000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const created = new Date(now - Math.floor(next() * 21) * day).toISOString();
    const stationsDone = STATIONS.slice(0, next() < 0.8 ? 4 : Math.floor(next() * 4));
    const completed = stationsDone.length === 4;
    const consent: UserRow['consent'] = next() < 0.9 ? 'active' : next() < 0.5 ? 'withdrawn' : 'none';
    const sessionId = `5e550000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    if (consent !== 'none') {
      responses.interests!.push(...demoAnswers(instruments.interests, sessionId, next, stationsDone.includes('interests') ? 1 : 0.4));
      if (stationsDone.includes('personality')) responses.personality!.push(...demoAnswers(instruments.personality, sessionId, next));
    }
    const row: UserRow = {
      id,
      displayName: `Demo student ${i + 1}`,
      role: 'student',
      governorate: GOVERNORATES[Math.floor(next() * GOVERNORATES.length)]!,
      curriculum: CURRICULA[Math.floor(next() * CURRICULA.length)]!,
      createdAt: created,
      lastSeenAt: new Date(Date.parse(created) + Math.floor(next() * 5) * day).toISOString(),
      consent,
      hasResult: completed && consent !== 'none',
    };
    users.push({
      row,
      detail: {
        profile: { ...row, gender: next() < 0.5 ? 'female' : 'male', grade: 10 + Math.floor(next() * 3), dateOfBirth: '2009-05-01', phoneMasked: '+20 10• ••• ••12' },
        consents:
          consent === 'none'
            ? []
            : [{ id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, route: next() < 0.6 ? 'school' : 'teen_invite', method: 'whatsapp_link', policyVersion: 'consent-0.1-draft', grantedAt: created, withdrawnAt: consent === 'withdrawn' ? new Date(now - day).toISOString() : null }],
        sessions: consent === 'none' ? [] : [{ id: sessionId, status: completed ? 'completed' : 'in_progress', stationsDone, startedAt: created, completedAt: completed ? created : null }],
        latestResult: row.hasResult ? { createdAt: created, hollandCode: 'IAS', topCareerIds: ['data_scientist', 'physicist', 'software_engineer', 'architect', 'biotechnologist'], quality: [], coverage: 1 } : null,
      },
    });
  }
  for (let i = 0; i < 12; i++) {
    const id = `9a400000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const row: UserRow = { id, displayName: `Demo parent ${i + 1}`, role: 'parent', governorate: 'Cairo', curriculum: null, createdAt: new Date(now - i * day).toISOString(), lastSeenAt: null, consent: 'none', hasResult: false };
    users.push({ row, detail: { profile: { ...row, gender: null, grade: null, dateOfBirth: null, phoneMasked: null }, consents: [], sessions: [], latestResult: null } });
  }

  const flags: FeatureFlag[] = [
    { key: 'assessment.ai_explanations', enabled: false, rolloutPct: 100, description: 'Use Claude to write result explanations (templates otherwise).', updatedAt: new Date(now).toISOString() },
    { key: 'path.3d', enabled: true, rolloutPct: 100, description: '3D path view (2D fallback always available).', updatedAt: new Date(now).toISOString() },
    { key: 'explore.saved_items', enabled: true, rolloutPct: 100, description: 'Allow saving programs, universities and providers.', updatedAt: new Date(now).toISOString() },
    { key: 'maintenance_mode', enabled: false, rolloutPct: 100, description: 'Show a maintenance page to everyone except admins.', updatedAt: new Date(now).toISOString() },
  ];
  const audit: AuditEntry[] = [
    { id: 'a0000000-0000-4000-8000-000000000001', actorId: null, actorRole: 'service_role', action: 'insert', entityType: 'consents', entityId: users[0]!.detail.consents[0]?.id ?? null, changedFields: [], createdAt: new Date(now - 2 * day).toISOString() },
    { id: 'a0000000-0000-4000-8000-000000000002', actorId: users[1]!.row.id, actorRole: 'authenticated', action: 'update', entityType: 'profiles', entityId: users[1]!.row.id, changedFields: ['date_of_birth'], createdAt: new Date(now - day).toISOString() },
  ];
  return { users, responses, flags, audit, now };
}

/** Demo back office for dev mock mode: synthetic, clearly labelled, never used in production. */
export class MemoryAdminRepo implements AdminRepo {
  readonly demo = true;
  private data = buildDemo();

  async getAdminRoles(): Promise<AdminRole[]> {
    return ['super_admin'];
  }

  async overview(): Promise<Overview> {
    const students = this.data.users.filter((u) => u.row.role === 'student');
    const sessions = students.flatMap((u) => u.detail.sessions);
    return {
      users: {
        total: this.data.users.length,
        students: students.length,
        parents: this.data.users.length - students.length,
        newLast7d: this.data.users.filter((u) => this.data.now - Date.parse(u.row.createdAt) <= 7 * 86_400_000).length,
      },
      sessions: { started: sessions.length, inProgress: sessions.filter((s) => s.status !== 'completed').length, completed: sessions.filter((s) => s.status === 'completed').length },
      results: students.filter((u) => u.row.hasResult).length,
      consents: {
        active: students.filter((u) => u.row.consent === 'active').length,
        withdrawn: students.filter((u) => u.row.consent === 'withdrawn').length,
      },
      funnel: [
        { step: 'students', count: students.length },
        { step: 'started', count: sessions.length },
        ...STATIONS.map((st) => ({ step: st, count: sessions.filter((s) => s.stationsDone.includes(st)).length })),
        { step: 'result', count: students.filter((u) => u.row.hasResult).length },
      ],
    };
  }

  async listUsers({ q, role, limit, offset }: { q?: string; role?: string; limit: number; offset: number }) {
    const needle = q?.trim().toLowerCase();
    const rows = this.data.users
      .map((u) => u.row)
      .filter((r) => (!role || r.role === role) && (!needle || r.displayName.toLowerCase().includes(needle) || r.id.startsWith(needle)));
    return { rows: rows.slice(offset, offset + limit), total: rows.length };
  }

  async getUser(id: string) {
    return this.data.users.find((u) => u.row.id === id)?.detail ?? null;
  }

  async responsesFor(instrumentId: string) {
    return this.data.responses[instrumentId] ?? [];
  }

  async listFlags() {
    return [...this.data.flags];
  }

  async setFlag(key: string, enabled: boolean, actorId: string) {
    const flag = this.data.flags.find((f) => f.key === key);
    if (!flag) throw new Error('unknown_flag');
    flag.enabled = enabled;
    flag.updatedAt = new Date().toISOString();
    this.data.audit.unshift({ id: crypto.randomUUID(), actorId, actorRole: 'authenticated', action: 'update', entityType: 'feature_flags', entityId: key, changedFields: ['enabled'], createdAt: flag.updatedAt });
    return { ...flag };
  }

  async auditLog({ limit, entityType }: { limit: number; entityType?: string }) {
    return this.data.audit.filter((a) => !entityType || a.entityType === entityType).slice(0, limit);
  }

  async ping() {
    return true;
  }
}
