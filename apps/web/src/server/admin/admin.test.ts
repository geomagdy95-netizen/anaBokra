import { careers, instruments } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { flagItem, instrumentStats, MIN_CASES_FOR_ALPHA } from './analytics';
import { careerHealth, contentHealth } from './content-health';
import { MemoryAdminRepo } from './memory-repo';
import { systemChecks } from './system';
import { canOpen, canSeeAnswers } from './types';
import type { ResponseSample } from './types';

describe('role access', () => {
  it('limits sections by role', () => {
    expect(canOpen(['super_admin'], 'flags')).toBe(true);
    expect(canOpen(['support'], 'users')).toBe(true);
    expect(canOpen(['support'], 'assessment')).toBe(false);
    expect(canOpen(['assessment_lead'], 'assessment')).toBe(true);
    expect(canOpen(['content_editor'], 'flags')).toBe(false);
    expect(canOpen([], 'overview')).toBe(false);
  });

  it('shows full results only to super_admin and assessment_lead', () => {
    expect(canSeeAnswers(['support'])).toBe(false);
    expect(canSeeAnswers(['analyst'])).toBe(false);
    expect(canSeeAnswers(['assessment_lead'])).toBe(true);
  });
});

describe('instrumentStats', () => {
  const personality = instruments.personality;

  it('reverse-scores keyed items so a consistent respondent gets positive item–total r', async () => {
    const samples = await new MemoryAdminRepo().responsesFor('personality');
    const stats = instrumentStats(personality, samples);
    expect(stats.sessions).toBeGreaterThanOrEqual(MIN_CASES_FOR_ALPHA);
    for (const scale of stats.scales) {
      expect(scale.alpha).not.toBeNull();
      expect(scale.alpha!).toBeGreaterThan(0.6);
    }
    const reverse = stats.items.find((i) => i.keyed === -1 && !i.attentionCheck)!;
    expect(reverse.itemTotal!).toBeGreaterThan(0);
  });

  it('withholds alpha below the minimum number of complete cases', () => {
    const items = personality.items.filter((i) => i.scale === 'extraversion');
    const samples: ResponseSample[] = Array.from({ length: 5 }, (_, s) => items.map((i) => ({ sessionId: `s${s}`, itemId: i.id, value: 3, ms: 2000 }))).flat();
    const stats = instrumentStats(personality, samples);
    expect(stats.scales.find((s) => s.scale === 'extraversion')!.alpha).toBeNull();
  });

  it('counts distribution, missingness and attention-check pass rate', () => {
    const check = instruments.interests.items.find((i) => i.attentionCheck)!;
    const first = instruments.interests.items[0]!;
    const samples: ResponseSample[] = [
      { sessionId: 'a', itemId: first.id, value: 5, ms: 1000 },
      { sessionId: 'a', itemId: check.id, value: check.attentionCheck!.expected, ms: 1000 },
      { sessionId: 'b', itemId: check.id, value: 1, ms: 1000 },
    ];
    const stats = instrumentStats(instruments.interests, samples);
    const item = stats.items.find((i) => i.itemId === first.id)!;
    expect(item.distribution).toEqual([0, 0, 0, 0, 1]);
    expect(item.missing).toBeCloseTo(0.5);
    expect(stats.items.find((i) => i.itemId === check.id)!.passRate).toBeCloseTo(0.5);
  });

  it('flags weak, skipped and ceiling items', () => {
    const base = { itemId: 'x', scale: 's', keyed: 1 as const, attentionCheck: false, mean: 4.8, medianMs: 1000, passRate: null };
    expect(flagItem({ ...base, n: 100, missing: 0.2, sd: 0.4, itemTotal: 0.1, distribution: [0, 0, 0, 10, 90] })).toEqual(
      expect.arrayContaining(['weakItem', 'oftenSkipped', 'lowSpread', 'ceilingOrFloor']),
    );
    expect(flagItem({ ...base, n: 100, missing: 0, sd: 1.1, itemTotal: 0.5, mean: 3, distribution: [15, 20, 30, 20, 15] })).toEqual([]);
  });
});

describe('content health', () => {
  it('covers every career and flags proxies and lite pages', () => {
    const health = contentHealth(new Date('2026-10-10'));
    expect(health.careers).toHaveLength(careers.length);
    expect(health.totals.fullPages + health.totals.litePages).toBeLessThanOrEqual(careers.length);
    const proxy = careers.find((c) => c.proxy)!;
    expect(health.careers.find((c) => c.id === proxy.id)!.issues).toContain('proxyProfile');
  });

  it('marks pages older than a year as stale and missing pages', () => {
    const c = careers[0]!;
    expect(careerHealth(c, { depth: 'full', lastReviewedAt: '2025-01-01', sources: [1, 2, 3], marketEgypt: { salaryMonthlyEgp: {} }, pathEgypt: { programIds: ['p'] } }, new Date('2026-10-10')).issues).toContain('stale');
    expect(careerHealth(c, undefined).issues).toContain('noPage');
  });
});

describe('system checks', () => {
  it('reports presence only and fails console OTP in production', () => {
    const checks = systemChecks({ NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'secret-value' } as NodeJS.ProcessEnv, true);
    expect(JSON.stringify(checks)).not.toContain('secret-value');
    expect(checks.find((c) => c.key === 'SUPABASE_SERVICE_ROLE_KEY')!.status).toBe('ok');
    expect(checks.find((c) => c.key === 'NEXT_PUBLIC_SITE_URL')!.status).toBe('missing');
    expect(checks.find((c) => c.key === 'OTP_SENDER')!.status).toBe('missing');
  });
});

describe('MemoryAdminRepo', () => {
  it('builds a coherent demo overview and records flag changes in the audit log', async () => {
    const repo = new MemoryAdminRepo();
    const o = await repo.overview();
    expect(o.funnel[0]!.count).toBe(o.users.students);
    for (let i = 1; i < o.funnel.length; i++) expect(o.funnel[i]!.count).toBeLessThanOrEqual(o.funnel[i - 1]!.count);
    await repo.setFlag('path.3d', false, 'admin-1');
    expect((await repo.listFlags()).find((f) => f.key === 'path.3d')!.enabled).toBe(false);
    expect((await repo.auditLog({ limit: 1 }))[0]).toMatchObject({ entityType: 'feature_flags', entityId: 'path.3d', changedFields: ['enabled'] });
    await expect(repo.setFlag('nope', true, 'admin-1')).rejects.toThrow('unknown_flag');
  });

  it('pages and searches users', async () => {
    const repo = new MemoryAdminRepo();
    const page = await repo.listUsers({ role: 'student', limit: 10, offset: 0 });
    expect(page.rows).toHaveLength(10);
    expect(page.total).toBe(60);
    expect((await repo.listUsers({ q: 'Demo parent 3', limit: 10, offset: 0 })).rows[0]!.role).toBe('parent');
  });
});
