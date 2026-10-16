import { describe, expect, it } from 'vitest';

import type { Preview } from '@/server/assessment/scoring';

import type { JourneyData } from './journey';
import { nextStep, nextStepHref } from './next-step';
import type { JourneyDoc, VerifyResult } from './verify';

const preview = (stage: Preview['stage']): Preview => ({
  stage,
  flat: false,
  groups: ['tech', 'science', 'engineering'].map((cluster, i) => ({ cluster, fit: 80 - i * 5, careerIds: [] })),
  matches: [],
  fits: {},
  interestCode: [],
  personalitySet: null,
});

type Data = Pick<JourneyData, 'discover' | 'preview' | 'journey' | 'open'>;
const data = (over: { next?: number | null; done?: number; stage?: Preview['stage']; journey?: Partial<JourneyDoc>; open?: boolean } = {}): Data =>
  ({
    open: over.open ?? true,
    discover: { next: over.next === undefined ? null : over.next, doneCount: over.done ?? 10 },
    preview: preview(over.stage ?? 'suggested'),
    journey: { v: 1, paths: {}, ...over.journey },
  }) as unknown as Data;

const result = (pathId: string, careers: string[]): VerifyResult =>
  ({ pathId, careers: careers.map((careerId) => ({ careerId, fit: 0.6, cautions: [] })) }) as unknown as VerifyResult;

describe('nextStep', () => {
  it('starts with the next Discover task, marking the very first one', () => {
    expect(nextStep(data({ next: 1, done: 0, stage: 'none' }))).toEqual({ kind: 'task', n: 1, first: true });
    expect(nextStep(data({ next: 4, done: 3, stage: 'early' }))).toEqual({ kind: 'task', n: 4, first: false });
  });

  it('then the best suggested field, but a field already started comes first', () => {
    expect(nextStep(data())).toEqual({ kind: 'field', id: 'tech', started: false });
    expect(nextStep(data({ journey: { paths: { science: { answers: { x: 2 } } } } }))).toEqual({ kind: 'field', id: 'science', started: true });
  });

  it('waits for suggestions before offering a field', () => {
    expect(nextStep(data({ stage: 'early' }))).toEqual({ kind: 'explore' });
  });

  it('then a career of a checked field: a started quest first, else the best one not tried', () => {
    const checked = { tech: { answers: {}, result: result('tech', ['software_engineer', 'data_scientist']) }, science: { answers: {}, result: result('science', ['physicist']) }, engineering: { answers: {}, result: result('engineering', ['civil_engineer']) } };
    expect(nextStep(data({ journey: { paths: checked } }))).toEqual({ kind: 'career', group: 'tech', id: 'software_engineer', started: false });
    const started = { ...checked } as JourneyDoc['paths'];
    expect(nextStep(data({ journey: { paths: started, careers: { data_scientist: { answers: { day: 3 } } } } }))).toEqual({ kind: 'career', group: 'tech', id: 'data_scientist', started: true });
  });

  it('offers exploring when everything suggested is done, and links each step', () => {
    const all = Object.fromEntries(['tech', 'science', 'engineering'].map((id) => [id, { answers: {}, result: result(id, []) }]));
    expect(nextStep(data({ journey: { paths: all } }))).toEqual({ kind: 'explore' });
    expect(nextStepHref({ kind: 'task', n: 3, first: false })).toBe('/journey/me?task=3');
    expect(nextStepHref({ kind: 'field', id: 'tech', started: false })).toBe('/journey/tech');
    expect(nextStepHref({ kind: 'career', group: 'tech', id: 'software_engineer', started: false })).toBe('/journey/tech/software_engineer');
    expect(nextStepHref({ kind: 'explore' })).toBeNull();
  });
});
