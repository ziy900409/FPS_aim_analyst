import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { spiderShotV2 } from '../drill/spider_shot_v2.ts';
import { spiderShotV3Binding } from '../drill/spider_shot_v3.ts';
import { spiderShotWideV1Binding } from '../drill/spider_shot_wide_v1.ts';
import { trackingBrVariants } from '../drill/tracking_br_v1.ts';
import { trackingSceneV1 } from '../drill/tracking_scene_v1.ts';
import type { WeaponId } from '../weapon/weapons.ts';
import { DECLARED_WEAPON_BY_DRILL_ID, FAMILY_BY_DRILL_ID, SCHEDULABLE_DRILL_IDS } from './drillFamily.ts';
import { TRACKING_PILOT_SCHEDULABLE_DRILLS } from './trackingPilotSchedulableDrills.ts';
import {
  type ProgramStep,
  type RunStep,
  type SessionProgramItem,
  type SessionProgramPlan,
  SessionProgramCompileError,
  compileSessionProgram,
  summarizeProgram,
} from './sessionProgram.ts';

/**
 * WP-58 T2 — the compiler's five rules (FR-58.4~58.8), the user-scenario golden program, the
 * illegal-input matrix (FR-58.7) and the purity/perf gates (NFR-58.1 / NFR-58.4).
 *
 * Every drill id below is read from the drill module's own constant, never typed as a literal
 * (D-58-T0-2). The families are asserted rather than assumed, so if a later WP moves a drill between
 * families these tests fail loudly instead of silently testing the wrong boundary.
 */

/** Three drills from three different families — the shape the user scenario depends on (§1.4). */
const A = holdClickV1.id;
const B = spiderShotV2.drillId;
const C = counterstrafeReversalV1.drillId;
/** A second `counterstrafe` drill, for the same-family-adjacency case (R-58.8). */
const C_SIBLING = counterstrafeFreeV1.drillId;

function runsOf(program: readonly ProgramStep[]): readonly ProgramStep[] {
  return program.filter((step) => step.kind === 'run');
}

describe('WP-58 T2 — fixture families are what the cases assume', () => {
  it('draws A/B/C from three distinct families and the sibling from C\'s', () => {
    const [familyA, familyB, familyC, familySibling] = [A, B, C, C_SIBLING].map((id) =>
      FAMILY_BY_DRILL_ID.get(id),
    );
    expect(new Set([familyA, familyB, familyC]).size).toBe(3);
    expect(familySibling).toBe(familyC);
    expect(C_SIBLING).not.toBe(C);
  });
});

describe('WP-58 T2 — rule 1: each item expands into `reps` run steps', () => {
  it('emits one run per rep with 0-based repIndex and the item\'s repCount', () => {
    const program = compileSessionProgram({ items: [{ drillId: A, reps: 3 }], drillRestSeconds: 0, familyRestSeconds: 0 });
    expect(runsOf(program)).toEqual([
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 0, repCount: 3 },
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 1, repCount: 3 },
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 2, repCount: 3 },
    ]);
  });

  it('boundary: reps = 1 yields a single-step program with no rest at all', () => {
    const program = compileSessionProgram({ items: [{ drillId: A, reps: 1 }], drillRestSeconds: 30, familyRestSeconds: 60 });
    expect(program).toEqual([
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 0, repCount: 1 },
    ]);
  });
});

describe('WP-58 T2 — rule 2: at most one rest between adjacent runs, boundary from item/family', () => {
  it.each([
    ['same item', [{ drillId: A, reps: 2 }], 'rep'],
    ['different items, same family', [{ drillId: C, reps: 1 }, { drillId: C_SIBLING, reps: 1 }], 'drill'],
    ['different families', [{ drillId: A, reps: 1 }, { drillId: B, reps: 1 }], 'family'],
  ])('%s -> boundary %s', (_label, items, boundary) => {
    const program = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
    expect(program).toHaveLength(3);
    expect(program[1]).toMatchObject({ kind: 'rest', boundary });
  });

  it('boundary: two items sharing the same drill id are still a `drill` seam, not a `rep` one', () => {
    // Repetition is a property of the *item*, so the operator listing the same drill twice gets two
    // blocks, not one block of four. The rest happens to be the same length either way; the label is
    // what the preview table and the exported metadata report.
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 1 }, { drillId: A, reps: 1 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(program[1]).toMatchObject({ kind: 'rest', boundary: 'drill', seconds: 30 });
    expect(program[2]).toMatchObject({ kind: 'run', itemIndex: 1, repIndex: 0 });
  });
});

describe('WP-58 T2 — rule 3: seconds follow the boundary kind', () => {
  it('gives family seams familyRestSeconds and every other seam drillRestSeconds', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 1 }, { drillId: C_SIBLING, reps: 1 }, { drillId: C, reps: 1 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    const rests = program.filter((step) => step.kind === 'rest');
    expect(rests).toEqual([
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: A },
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: B },
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: C_SIBLING },
      { kind: 'rest', seconds: 30, boundary: 'drill', nextDrillId: C },
    ]);
  });

  it('boundary: a shorter family rest than drill rest is compiled as written, not reordered', () => {
    // The compiler reports the operator's numbers; it is not in the business of second-guessing an
    // unusual protocol. The preview table (FR-58.13) is what makes this visible before the run.
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 1 }],
      drillRestSeconds: 45,
      familyRestSeconds: 5,
    });
    expect(program.filter((step) => step.kind === 'rest')).toEqual([
      { kind: 'rest', seconds: 45, boundary: 'rep', nextDrillId: A },
      { kind: 'rest', seconds: 5, boundary: 'family', nextDrillId: B },
    ]);
  });
});

describe('WP-58 T2 — rule 4: no rest before the first run or after the last', () => {
  it.each([
    ['single run', [{ drillId: A, reps: 1 }]],
    ['multi rep', [{ drillId: A, reps: 4 }]],
    ['cross family', [{ drillId: A, reps: 2 }, { drillId: B, reps: 2 }, { drillId: C, reps: 2 }]],
  ])('%s starts and ends on a run', (_label, items) => {
    const program = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
    expect(program[0].kind).toBe('run');
    expect(program.at(-1)?.kind).toBe('run');
  });

  it('boundary: never emits two adjacent rests', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 3 }, { drillId: B, reps: 3 }, { drillId: C, reps: 3 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    for (let index = 1; index < program.length; index++) {
      expect(program[index].kind === 'rest' && program[index - 1].kind === 'rest').toBe(false);
    }
  });
});

describe('WP-58 T2 — rule 5: zero-second rests are omitted at compile time', () => {
  it('drops every rest when both durations are 0', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 2 }],
      drillRestSeconds: 0,
      familyRestSeconds: 0,
    });
    expect(program).toHaveLength(4);
    expect(program.every((step) => step.kind === 'run')).toBe(true);
  });

  it('boundary: drops only the zero-length kind, keeping the other', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 2 }],
      drillRestSeconds: 0,
      familyRestSeconds: 60,
    });
    expect(program.filter((step) => step.kind === 'rest')).toEqual([
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: B },
    ]);
  });

  it('never emits a rest with seconds <= 0', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 2 }],
      drillRestSeconds: 0.5,
      familyRestSeconds: 0,
    });
    for (const step of program) if (step.kind === 'rest') expect(step.seconds).toBeGreaterThan(0);
  });
});

describe('WP-58 T2 — golden: the user scenario compiles to 17 steps', () => {
  /** `A x3 / 30s, 60s, B x3 / 30s, 60s, C x3 / 30s` — README §2.4's frozen expectation. */
  const program = compileSessionProgram({
    items: [{ drillId: A, reps: 3 }, { drillId: B, reps: 3 }, { drillId: C, reps: 3 }],
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  });

  it('matches element for element, including boundary and seconds', () => {
    expect(program).toEqual([
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 0, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: A },
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 1, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: A },
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 0, repIndex: 2, repCount: 3 },
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: B },
      { kind: 'run', drillId: B, family: 'spider-shot', itemIndex: 1, repIndex: 0, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: B },
      { kind: 'run', drillId: B, family: 'spider-shot', itemIndex: 1, repIndex: 1, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: B },
      { kind: 'run', drillId: B, family: 'spider-shot', itemIndex: 1, repIndex: 2, repCount: 3 },
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: C },
      { kind: 'run', drillId: C, family: 'counterstrafe', itemIndex: 2, repIndex: 0, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: C },
      { kind: 'run', drillId: C, family: 'counterstrafe', itemIndex: 2, repIndex: 1, repCount: 3 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: C },
      { kind: 'run', drillId: C, family: 'counterstrafe', itemIndex: 2, repIndex: 2, repCount: 3 },
    ]);
  });

  it('has the shape README §2.4 states: 17 steps, 9 runs, 6x30s rep + 2x60s family', () => {
    expect(program).toHaveLength(17);
    expect(summarizeProgram(program)).toEqual({ runCount: 9, totalRestSeconds: 6 * 30 + 2 * 60 });
    expect(program.filter((step) => step.kind === 'rest' && step.boundary === 'rep')).toHaveLength(6);
    expect(program.filter((step) => step.kind === 'rest' && step.boundary === 'family')).toHaveLength(2);
  });
});

describe('WP-58 T2 — adjacent same-family drills take the drill rest (R-58.8 is design, not a bug)', () => {
  it('puts a 30s `drill` rest between two counterstrafe drills, not the 60s family rest', () => {
    const program = compileSessionProgram({
      items: [{ drillId: C, reps: 2 }, { drillId: C_SIBLING, reps: 2 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(program.filter((step) => step.kind === 'rest')).toEqual([
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: C },
      { kind: 'rest', seconds: 30, boundary: 'drill', nextDrillId: C_SIBLING },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: C_SIBLING },
    ]);
  });

  it('does treat the spider-shot / spider-shot-wide sibling constructs as a family seam', () => {
    // D-58-T0-1: the wide variant is a separate construct, so crossing into it earns the long rest
    // even though the two read like the same drill family to the eye.
    const program = compileSessionProgram({
      items: [{ drillId: spiderShotV3Binding.id, reps: 1 }, { drillId: spiderShotWideV1Binding.id, reps: 1 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(program[1]).toMatchObject({ kind: 'rest', boundary: 'family', seconds: 60 });
  });
});

describe('WP-58 T2 — A-B-A interleave (FR-58.8)', () => {
  it('allows a family to recur and gives both crossings the family rest', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 1 }, { drillId: B, reps: 1 }, { drillId: A, reps: 1 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(program.map((step) => (step.kind === 'run' ? step.drillId : `rest:${step.boundary}`))).toEqual([
      A,
      'rest:family',
      B,
      'rest:family',
      A,
    ]);
    expect(program.filter((step) => step.kind === 'run').map((step) => step.itemIndex)).toEqual([0, 1, 2]);
  });
});

describe('WP-58 T2 — illegal input throws a named, classifiable error (FR-58.7)', () => {
  const base: SessionProgramPlan = {
    items: [{ drillId: A, reps: 1 }],
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  };

  it.each<[string, SessionProgramPlan, string, number | undefined]>([
    ['empty items', { ...base, items: [] }, 'items', undefined],
    ['unregistered drill', { ...base, items: [{ drillId: 'not_a_drill', reps: 1 }] }, 'drillId', 0],
    [
      'off-roster drill (exists as a module but is not schedulable)',
      { ...base, items: [{ drillId: A, reps: 1 }, { drillId: 'counterstrafe-cued-v1', reps: 1 }] },
      'drillId',
      1,
    ],
    ['reps 0', { ...base, items: [{ drillId: A, reps: 0 }] }, 'reps', 0],
    ['reps negative', { ...base, items: [{ drillId: A, reps: -1 }] }, 'reps', 0],
    ['reps fractional', { ...base, items: [{ drillId: A, reps: 1.5 }] }, 'reps', 0],
    ['reps NaN', { ...base, items: [{ drillId: A, reps: Number.NaN }] }, 'reps', 0],
    ['reps Infinity', { ...base, items: [{ drillId: A, reps: Number.POSITIVE_INFINITY }] }, 'reps', 0],
    ['negative drill rest', { ...base, drillRestSeconds: -1 }, 'drillRestSeconds', undefined],
    ['NaN drill rest', { ...base, drillRestSeconds: Number.NaN }, 'drillRestSeconds', undefined],
    ['Infinite family rest', { ...base, familyRestSeconds: Number.POSITIVE_INFINITY }, 'familyRestSeconds', undefined],
    ['negative family rest', { ...base, familyRestSeconds: -0.5 }, 'familyRestSeconds', undefined],
  ])('%s -> field %s', (_label, plan, field, itemIndex) => {
    let thrown: unknown;
    try {
      compileSessionProgram(plan);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SessionProgramCompileError);
    const error = thrown as SessionProgramCompileError;
    expect(error.name).toBe('SessionProgramCompileError');
    expect(error.field).toBe(field);
    expect(error.itemIndex).toBe(itemIndex);
  });

  it('rejects a bad item even when it sits behind valid ones — no partial program is returned', () => {
    // The failure mode this guards is the tempting one: compile what you can, drop the rest. A
    // program that quietly lost its third block would run to completion and look like valid data.
    expect(() =>
      compileSessionProgram({
        items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 2 }, { drillId: 'nope', reps: 2 }],
        drillRestSeconds: 30,
        familyRestSeconds: 60,
      }),
    ).toThrow(SessionProgramCompileError);
  });
});

describe('WP-58 T2 — determinism (NFR-58.1)', () => {
  it('produces bit-identical output for the same input across repeated calls', () => {
    const plan: SessionProgramPlan = {
      items: [{ drillId: A, reps: 3 }, { drillId: B, reps: 2 }, { drillId: C, reps: 4 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    };
    const first = JSON.stringify(compileSessionProgram(plan));
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(JSON.stringify(compileSessionProgram(plan))).toBe(first);
    }
  });

  it('does not retain state between calls', () => {
    const single = compileSessionProgram({ items: [{ drillId: A, reps: 1 }], drillRestSeconds: 30, familyRestSeconds: 60 });
    compileSessionProgram({ items: [{ drillId: B, reps: 9 }], drillRestSeconds: 30, familyRestSeconds: 60 });
    expect(compileSessionProgram({ items: [{ drillId: A, reps: 1 }], drillRestSeconds: 30, familyRestSeconds: 60 })).toEqual(single);
  });
});

describe('WP-58 T2 — summarizeProgram', () => {
  it('counts runs and sums rest seconds only', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 1 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(summarizeProgram(program)).toEqual({ runCount: 3, totalRestSeconds: 90 });
  });

  it('reports zeros for an empty program', () => {
    expect(summarizeProgram([])).toEqual({ runCount: 0, totalRestSeconds: 0 });
  });
});

describe('WP-58 T2 — 400 run steps compile under 1 ms P95 (NFR-58.4)', () => {
  const WARM_ITERATIONS = 50;
  const SAMPLES = 500;
  const P95_LIMIT_MS = 1;

  /** The stated ceiling: 20 items x 20 reps. Items cycle the roster so families keep changing. */
  const plan: SessionProgramPlan = {
    items: Array.from({ length: 20 }, (_unused, index) => ({
      drillId: SCHEDULABLE_DRILL_IDS[index % SCHEDULABLE_DRILL_IDS.length],
      reps: 20,
    })),
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  };

  it('compiles 400 runs well inside the budget', () => {
    expect(summarizeProgram(compileSessionProgram(plan)).runCount).toBe(400);

    for (let iteration = 0; iteration < WARM_ITERATIONS; iteration++) compileSessionProgram(plan);

    const samples: number[] = [];
    for (let iteration = 0; iteration < SAMPLES; iteration++) {
      const startedAt = performance.now();
      compileSessionProgram(plan);
      samples.push(performance.now() - startedAt);
    }
    const ordered = [...samples].sort((left, right) => left - right);
    const p95Ms = ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0;
    console.log(
      `[WP-58 T2 perf] compileSessionProgram(400 runs): samples=${SAMPLES} warm=${WARM_ITERATIONS} p95=${p95Ms.toFixed(4)}ms max=${ordered.at(-1)?.toFixed(4)}ms`,
    );
    expect(p95Ms).toBeLessThan(P95_LIMIT_MS);
  });
});

describe('WP-58 T3 — the warmup marker rides through untouched', () => {
  it('carries `warmup` onto every run of a warmup item and onto no other run', () => {
    const program = compileSessionProgram({
      items: [
        { drillId: C_SIBLING, reps: 1, warmup: true },
        { drillId: C, reps: 1 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });

    expect(program[0]).toMatchObject({ kind: 'run', drillId: C_SIBLING, warmup: true });
    // Absent, not `false`: a warmup is the exception, and step objects are compared element-wise.
    expect(program.at(-1)).not.toHaveProperty('warmup');
  });

  it('does not let the marker change a boundary or a rest duration', () => {
    const items = [
      { drillId: C_SIBLING, reps: 1 },
      { drillId: C, reps: 1 },
    ];
    const plain = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
    const marked = compileSessionProgram({
      items: [{ ...items[0], warmup: true }, items[1]],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });

    expect(marked.map((step) => (step.kind === 'rest' ? step : step.kind))).toEqual(
      plain.map((step) => (step.kind === 'rest' ? step : step.kind)),
    );
  });
});

/**
 * WP-62 T2 — the per-item weapon (FR-62.1 / 62.2 / 62.3, D-62-1).
 *
 * The weapon is data on the program item, so the compiler has exactly two jobs: carry it onto every
 * rep, and refuse the two ways it can be wrong before a single step exists. Everything else about
 * the compiler — the five rules, the boundaries, the rest durations — has to stay bit-for-bit
 * unchanged when no weapon is named (NFR-62.4); that is what the key-set assertions are really for.
 */
describe('WP-62 T2 — a named weapon rides through to every rep (FR-62.1 / FR-62.3)', () => {
  /** No schedulable drill declares this one, so it can only reach a run step by being asked for. */
  const CHOSEN: WeaponId = 'usp_s_laser';
  /** One of the eight `tracking_br_v1` cells — the only drills that fix a weapon as their own factor. */
  const BR = trackingBrVariants[0];

  function runStepsOf(program: readonly ProgramStep[]): readonly RunStep[] {
    return program.flatMap((step) => (step.kind === 'run' ? [step] : []));
  }

  it('fixture check: the BR cell fixes a weapon, A fixes none, and the two differ', () => {
    // Read from the registry *and* from the drill config, so a later edit to either is caught here
    // rather than silently turning the negative cases below into positives.
    expect(DECLARED_WEAPON_BY_DRILL_ID.get(BR.id)).toBe(BR.drill.weaponId);
    expect(DECLARED_WEAPON_BY_DRILL_ID.get(BR.id)).not.toBe(CHOSEN);
    expect(DECLARED_WEAPON_BY_DRILL_ID.has(A)).toBe(false);
  });

  it('puts the item weapon on all three of its reps and on no run of any other item', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 3, weaponId: CHOSEN }, { drillId: B, reps: 2 }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(runStepsOf(program).map((step) => step.weaponId)).toEqual([
      CHOSEN,
      CHOSEN,
      CHOSEN,
      undefined,
      undefined,
    ]);
  });

  it('lets a BR cell name the weapon it already declares — agreement is not a conflict', () => {
    const declared = DECLARED_WEAPON_BY_DRILL_ID.get(BR.id);
    const program = compileSessionProgram({
      items: [{ drillId: BR.id, reps: 2, weaponId: declared }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(runStepsOf(program).map((step) => step.weaponId)).toEqual([declared, declared]);
  });

  it('omits the key entirely when no weapon was named (NFR-62.4)', () => {
    const program = compileSessionProgram({
      items: [{ drillId: A, reps: 2 }, { drillId: B, reps: 1, weaponId: CHOSEN }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    const runs = runStepsOf(program);
    // `toEqual` and `toBeUndefined()` both pass on a `weaponId: undefined`; only the own-key check
    // sees it, and that is the difference between an unchanged export and a schema change.
    expect(runs.map((step) => Object.hasOwn(step, 'weaponId'))).toEqual([false, false, true]);
    expect(Object.keys(runs[0])).toEqual(['kind', 'drillId', 'family', 'itemIndex', 'repIndex', 'repCount']);
    expect(Object.keys(runs[2])).toEqual([
      'kind',
      'drillId',
      'family',
      'itemIndex',
      'repIndex',
      'repCount',
      'weaponId',
    ]);
  });

  it('keeps warmup and weapon as independent keys, in a fixed order', () => {
    const program = compileSessionProgram({
      items: [{ drillId: C_SIBLING, reps: 1, warmup: true, weaponId: CHOSEN }],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(Object.keys(runStepsOf(program)[0])).toEqual([
      'kind',
      'drillId',
      'family',
      'itemIndex',
      'repIndex',
      'repCount',
      'warmup',
      'weaponId',
    ]);
  });

  it('does not let a weapon change a boundary, a rest duration or a rep count', () => {
    const items = [{ drillId: A, reps: 2 }, { drillId: B, reps: 1 }];
    const plain = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
    const armed = compileSessionProgram({
      items: [{ ...items[0], weaponId: CHOSEN }, items[1]],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(armed.map((step) => (step.kind === 'rest' ? step : step.kind))).toEqual(
      plain.map((step) => (step.kind === 'rest' ? step : step.kind)),
    );
    expect(summarizeProgram(armed)).toEqual(summarizeProgram(plain));
  });
});

describe('WP-62 T2 — an illegal weapon is a compile failure, located to its item (FR-62.2)', () => {
  const CHOSEN: WeaponId = 'usp_s_laser';
  const BR = trackingBrVariants[0];

  /** The form hands the compiler plain strings, and an export can be replayed. This is that, in a test. */
  function asWeaponId(value: unknown): WeaponId {
    return value as WeaponId;
  }

  it.each<[string, readonly SessionProgramItem[], number]>([
    ['unknown id', [{ drillId: A, reps: 1, weaponId: asWeaponId('not_a_weapon') }], 0],
    ['empty string', [{ drillId: A, reps: 1, weaponId: asWeaponId('') }], 0],
    ['non-string', [{ drillId: A, reps: 1, weaponId: asWeaponId(7) }], 0],
    ['null rather than absent', [{ drillId: A, reps: 1, weaponId: asWeaponId(null) }], 0],
    // A prototype key is a plain string to the form, and a bare `WEAPONS[id]` would hand back a
    // function for it. `isWeaponId` is an own-property check, so it is not a weapon id.
    ['inherited Object key', [{ drillId: A, reps: 1, weaponId: asWeaponId('toString') }], 0],
    ['overrides a BR cell', [{ drillId: BR.id, reps: 1, weaponId: CHOSEN }], 0],
    [
      'only the second of three items is bad',
      [
        { drillId: A, reps: 2 },
        { drillId: BR.id, reps: 2, weaponId: CHOSEN },
        { drillId: B, reps: 1 },
      ],
      1,
    ],
  ])('%s -> a located weaponId compile failure', (_label, items, itemIndex) => {
    let thrown: unknown;
    let returned: readonly ProgramStep[] | undefined;
    try {
      returned = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SessionProgramCompileError);
    const error = thrown as SessionProgramCompileError;
    expect(error.name).toBe('SessionProgramCompileError');
    expect(error.field).toBe('weaponId');
    expect(error.itemIndex).toBe(itemIndex);
    // Every item is validated before the first step is built, so a bad item sitting behind good ones
    // cannot leave a half-compiled program behind (FM-1).
    expect(returned).toBeUndefined();
  });

  it('classifies by field and index alone — the caller never parses the message', () => {
    // The message names the drill and the weapon it is pinned to, because the operator reads it. The
    // caller (T4's form) keys off `field`/`itemIndex`, which is what leaves the wording free to
    // change without breaking the UI.
    const declared = DECLARED_WEAPON_BY_DRILL_ID.get(BR.id);
    let thrown: unknown;
    try {
      compileSessionProgram({
        items: [{ drillId: BR.id, reps: 1, weaponId: CHOSEN }],
        drillRestSeconds: 30,
        familyRestSeconds: 60,
      });
    } catch (error) {
      thrown = error;
    }
    const error = thrown as SessionProgramCompileError;
    expect(error.message).toContain(BR.id);
    expect(error.message).toContain(String(declared));
  });
});

describe('WP-58 T2 — module purity boundary scan (NFR-58.1 / NFR-58.5)', () => {
  const FORBIDDEN: readonly RegExp[] = [
    /from ['"]three/,
    /from ['"]node:/,
    /Date\.now\s*\(/,
    /performance\.now\s*\(/,
    /Math\.random\s*\(/,
    /requestAnimationFrame/,
    /document\./,
    /window\./,
  ];

  it.each(FORBIDDEN)('sessionProgram.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('./sessionProgram.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });

  // WP-58 T-exit: the gate doc asks for the same scan on `drillFamily.ts`, and T2 only had
  // `sessionProgram.ts` to scan. A scan that lives in the acceptance transcript rather than in the
  // suite stops being a gate the moment the transcript scrolls away, so it runs here instead.
  it.each(FORBIDDEN)('drillFamily.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('./drillFamily.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });

  // WP-62 T2 (NFR-62.1): validating `weaponId` put `weapons.ts` — and through it `WeaponConfig.ts`,
  // which imports nothing at all — inside the compiler's dependency closure. Purity is a property of
  // that whole closure, not of one file, so the same scan now runs on the modules that just joined
  // it. This widens the gate; no rule above was relaxed to let the new imports through.
  it.each(FORBIDDEN)('weapons.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('../weapon/weapons.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });

  it.each(FORBIDDEN)('WeaponConfig.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('../weapon/WeaponConfig.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });
});

describe('WP-58 T-exit — SessionRunner stays outside the three loops (ADR-2 / §2.11)', () => {
  // The runner is an application-orchestration layer: its only reach into the sim is *which drill to
  // load*, through the `loadDrillById` seam its caller injects. Touching shared state directly would
  // put a fourth writer on the sim/render/input contract without any of the discipline that comes
  // with it.
  const FORBIDDEN_REACH: readonly RegExp[] = [
    /SharedState/,
    /SimLoop/,
    /InputSampler/,
    /DataRecorder/,
    /from ['"]three/,
    /document\./,
    /window\./,
    /Date\.now\s*\(/,
  ];

  it.each(FORBIDDEN_REACH)('SessionRunner.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('./SessionRunner.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });
});

/**
 * WP-64 T1 (FR-64.3 / FR-64.4) — the curated tracking-pilot blocks compile like any other member of
 * their family. That is the whole claim: scheduling them adds no case to the compiler, so reps,
 * both rest boundaries and the fixed-weapon guard must come out of the *existing* rules rather than
 * out of anything pilot-shaped. Exact expected steps, never a snapshot — a snapshot would happily
 * record a wrong boundary as the new truth.
 */
describe('WP-64 T1 — a curated tracking-pilot block schedules like any other tracking drill', () => {
  const [CORE, REVERSAL] = TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => entry.config.drillId);
  const SIBLING = trackingSceneV1.id; // the frozen `tracking` representative, unchanged by WP-64
  const PILOT_WEAPON = DECLARED_WEAPON_BY_DRILL_ID.get(CORE);

  it('fixture check: both curated blocks are schedulable tracking drills with a fixed weapon', () => {
    for (const drillId of [CORE, REVERSAL]) {
      expect(FAMILY_BY_DRILL_ID.get(drillId)).toBe('tracking');
      expect(SCHEDULABLE_DRILL_IDS).toContain(drillId);
      expect(DECLARED_WEAPON_BY_DRILL_ID.get(drillId)).toBe('tracking_pilot_hold');
    }
    expect(FAMILY_BY_DRILL_ID.get(SIBLING)).toBe('tracking');
    expect(FAMILY_BY_DRILL_ID.get(A)).not.toBe('tracking');
  });

  it('expands reps, then the same-family drill rest, then the cross-family rest', () => {
    const program = compileSessionProgram({
      items: [
        { drillId: CORE, reps: 2 },
        { drillId: SIBLING, reps: 1 },
        { drillId: A, reps: 1 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(program).toEqual([
      { kind: 'run', drillId: CORE, family: 'tracking', itemIndex: 0, repIndex: 0, repCount: 2 },
      { kind: 'rest', seconds: 30, boundary: 'rep', nextDrillId: CORE },
      { kind: 'run', drillId: CORE, family: 'tracking', itemIndex: 0, repIndex: 1, repCount: 2 },
      { kind: 'rest', seconds: 30, boundary: 'drill', nextDrillId: SIBLING },
      { kind: 'run', drillId: SIBLING, family: 'tracking', itemIndex: 1, repIndex: 0, repCount: 1 },
      { kind: 'rest', seconds: 60, boundary: 'family', nextDrillId: A },
      { kind: 'run', drillId: A, family: 'hold-click', itemIndex: 2, repIndex: 0, repCount: 1 },
    ]);
  });

  it('treats the two curated blocks as same-family neighbours, not as a family boundary', () => {
    const program = compileSessionProgram({
      items: [
        { drillId: CORE, reps: 1 },
        { drillId: REVERSAL, reps: 1 },
      ],
      drillRestSeconds: 45,
      familyRestSeconds: 90,
    });
    expect(program).toEqual([
      { kind: 'run', drillId: CORE, family: 'tracking', itemIndex: 0, repIndex: 0, repCount: 1 },
      { kind: 'rest', seconds: 45, boundary: 'drill', nextDrillId: REVERSAL },
      { kind: 'run', drillId: REVERSAL, family: 'tracking', itemIndex: 1, repIndex: 0, repCount: 1 },
    ]);
  });

  it('accepts an item naming the weapon the block already declares (FR-64.4)', () => {
    const program = compileSessionProgram({
      items: [{ drillId: CORE, reps: 2, weaponId: PILOT_WEAPON }],
      drillRestSeconds: 0,
      familyRestSeconds: 0,
    });
    expect(program.flatMap((step) => (step.kind === 'run' ? [step.weaponId] : []))).toEqual([
      PILOT_WEAPON,
      PILOT_WEAPON,
    ]);
  });

  it.each([
    ['the core cell', [{ drillId: CORE, reps: 1, weaponId: 'ak47' as WeaponId }], 0],
    ['the reversal cell', [{ drillId: REVERSAL, reps: 1, weaponId: 'usp_s_laser' as WeaponId }], 0],
    [
      'the second item of three',
      [
        { drillId: A, reps: 1 },
        { drillId: CORE, reps: 1, weaponId: 'ak47' as WeaponId },
        { drillId: SIBLING, reps: 1 },
      ],
      1,
    ],
  ] as [string, readonly SessionProgramItem[], number][])(
    'refuses to re-arm %s — the weapon is a fixed research factor',
    (_label, items, itemIndex) => {
      let thrown: unknown;
      let returned: readonly ProgramStep[] | undefined;
      try {
        returned = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SessionProgramCompileError);
      const error = thrown as SessionProgramCompileError;
      expect(error.field).toBe('weaponId');
      expect(error.itemIndex).toBe(itemIndex);
      expect(returned).toBeUndefined();
    },
  );

  it('still rejects an uncurated pilot block as an unschedulable drillId (FR-64.1)', () => {
    let thrown: unknown;
    try {
      compileSessionProgram({
        items: [{ drillId: 'tracking_core_pr_pilot_v1_practice', reps: 1 }],
        drillRestSeconds: 30,
        familyRestSeconds: 60,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SessionProgramCompileError);
    expect((thrown as SessionProgramCompileError).field).toBe('drillId');
    expect((thrown as SessionProgramCompileError).itemIndex).toBe(0);
  });
});
