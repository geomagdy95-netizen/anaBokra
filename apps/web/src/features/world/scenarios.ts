import { GROUP_ORDER, type GroupId, type IslandState, type Scenario } from './types';

const PHASES = 4;

/** Demo states for the dev page, following the reference board: before, during and after the assessment. */
export function scenarioStates(scenario: Scenario): Record<GroupId, IslandState> {
  const out = Object.fromEntries(GROUP_ORDER.map((id) => [id, { id, relation: 'neutral', bridge: 'connected', done: 0, total: PHASES }])) as Record<GroupId, IslandState>;
  const grown = (): Record<GroupId, IslandState> => {
    for (const s of Object.values(out)) s.growth = s.checked ? 1 : (s.done / s.total) * 0.75;
    return out;
  };

  // As in the app: only the user's island first; then the three suggestions appear; fields the user
  // adds join after them (slot = order of appearance).
  for (const id of GROUP_ORDER) out[id] = { ...out[id], visible: false };
  const show = (id: GroupId, slot: number, s: Partial<IslandState>) => (out[id] = { ...out[id], ...s, visible: true, slot });

  if (scenario === 'before') return grown();

  if (scenario === 'during') {
    show('health', 0, { relation: 'suggested', bridge: 'updating' });
    show('engineering', 1, { relation: 'suggested', bridge: 'updating' });
    show('law', 2, { relation: 'suggested', bridge: 'updating' });
    return grown();
  }

  for (const id of GROUP_ORDER) out[id] = { ...out[id], relation: 'other', bridge: 'broken' };
  show('tech', 0, { relation: 'suggested', bridge: 'connected', done: 2 });
  show('creative', 1, { relation: 'suggested', bridge: 'connected', done: 1 });
  show('education', 2, { relation: 'suggested', bridge: 'connected', done: 0 });
  if (scenario === 'added') {
    show('health', 3, { relation: 'added', bridge: 'connected', done: 0 });
    // By then the user has checked one path.
    out.tech = { ...out.tech, done: PHASES, checked: true };
  }
  return grown();
}

/** How far the core island has grown in each demo scenario. */
export const scenarioCoreGrowth = (scenario: Scenario) => ({ before: 0, during: 0.4, after: 1, added: 1 })[scenario];

/** The user reopens a group outside their suggestions. */
export function addToMap(state: IslandState): IslandState {
  return state.relation === 'other' ? { ...state, relation: 'added', bridge: 'connected' } : state;
}

// --- Core island (the user's profile) -----------------------------------------

export type CorePhase = 'interests' | 'personality' | 'values' | 'abilities';
export const CORE_PHASES: readonly CorePhase[] = ['interests', 'personality', 'values', 'abilities'];
export type PhaseStatus = 'done' | 'current' | 'todo';

export type Riasec = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export interface DemoProfile {
  grade: 10 | 11;
  track: 'science' | 'math' | 'literary';
  phases: Record<CorePhase, PhaseStatus>;
  /** Top interest areas, once the interests phase is done. */
  interests: Riasec[];
  /** Message keys under DevWorld.profile.valueNames, once the values phase is done. */
  values: string[];
  /** Message keys under DevWorld.profile.strengthNames, once the abilities phase is done. */
  strengths: string[];
}

/** Demo profile for each scenario: what the core island has collected so far. */
export function profileFor(scenario: Scenario): DemoProfile {
  const base: DemoProfile = {
    grade: 11,
    track: 'science',
    phases: { interests: 'current', personality: 'todo', values: 'todo', abilities: 'todo' },
    interests: [],
    values: [],
    strengths: [],
  };
  if (scenario === 'before') return base;
  if (scenario === 'during')
    return { ...base, phases: { interests: 'done', personality: 'current', values: 'todo', abilities: 'todo' }, interests: ['I', 'A', 'S'] };
  return {
    ...base,
    phases: { interests: 'done', personality: 'done', values: 'done', abilities: 'done' },
    interests: ['I', 'A', 'S'],
    values: ['creativity', 'helping', 'stability'],
    strengths: ['logic', 'communication'],
  };
}
