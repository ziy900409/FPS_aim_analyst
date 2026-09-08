import { describe, expect, it } from 'vitest';
import { collectMeta, type CollectMetaArgs } from '../data/metadata.ts';
import type { ExportPayload } from '../data/export.ts';
import { exportBasename } from '../results/ResultPresentation.ts';
import { buildFrozenSessionPlan } from './SessionRunner.ts';
import { compileSessionProgram, deriveProgramFamilyOrder, type RunStep } from './sessionProgram.ts';

/**
 * WP-58 T5 (FR-58.14~58.16) — the export side of the program contract: every rep produces its own
 * uniquely named payload, and every payload can say which rep of which item it is.
 *
 * The three moving parts are exercised against each other rather than in isolation: the compiler
 * produces the run steps, `collectMeta` records the coordinates, and `exportBasename` names the
 * file. A drift between any two of them shows up here.
 */

const CUSTOM_ITEMS = [
  { drillId: 'hold_click_v1', reps: 3 },
  { drillId: 'spider-shot-v2', reps: 2 },
] as const;

const PROGRAM = compileSessionProgram({ items: CUSTOM_ITEMS, drillRestSeconds: 30, familyRestSeconds: 60 });
const RUN_STEPS: readonly RunStep[] = PROGRAM.filter((step): step is RunStep => step.kind === 'run');

/** What `main.ts` writes for a custom run, minus the parts that are not about the program. */
function metaForRun(step: RunStep, startedAt: string): CollectMetaArgs {
  return {
    drillId: step.drillId,
    backend: 'webgpu',
    displayHz: 144,
    sensitivity: 1,
    crossOriginIsolated: true,
    startedAt,
    sessionPlanMode: 'custom',
    sessionPlanItems: CUSTOM_ITEMS,
    sessionPlanDrillRestSeconds: 30,
    sessionPlanRestSeconds: 60,
    sessionPlanFamilyOrder: deriveProgramFamilyOrder(PROGRAM),
    sessionPlanItemIndex: step.itemIndex,
    sessionPlanRepIndex: step.repIndex,
  };
}

function payloadFor(step: RunStep, startedAt: string): ExportPayload {
  return { meta: collectMeta(metaForRun(step, startedAt)), ticks: [], events: [] };
}

describe('deriveProgramFamilyOrder', () => {
  it('collapses consecutive repeats of one family', () => {
    // Two items, one family, five runs — the family order is a single entry, not five.
    const program = compileSessionProgram({
      items: [
        { drillId: 'spider-shot-v2', reps: 3 },
        { drillId: 'spider-shot-v3', reps: 2 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(deriveProgramFamilyOrder(program)).toEqual(['spider-shot']);
  });

  it('keeps a family that is revisited after another one (A-B-A)', () => {
    const program = compileSessionProgram({
      items: [
        { drillId: 'hold_click_v1', reps: 1 },
        { drillId: 'spider-shot-v2', reps: 1 },
        { drillId: 'hold_click_v1', reps: 1 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(deriveProgramFamilyOrder(program)).toEqual(['hold-click', 'spider-shot', 'hold-click']);
  });

  it('reproduces the frozen family order the operator selected', () => {
    const frozen = buildFrozenSessionPlan({
      participantId: 'P-001',
      sessionIndex: 0,
      families: ['hold-click', 'counterstrafe', 'spider-shot'],
      restSeconds: 60,
      includeWarmup: false,
    });
    expect(deriveProgramFamilyOrder(frozen.plan.program)).toEqual(['hold-click', 'counterstrafe', 'spider-shot']);
  });

  it('is validated by the metadata writer without a second allowlist', () => {
    // The derived order feeds `sessionPlanFamilyOrder`, whose validator is the KI-016 single source.
    const order = deriveProgramFamilyOrder(PROGRAM);
    expect(collectMeta(metaForRun(RUN_STEPS[0], '2026-09-08T10:00:00.000Z')).sessionPlanFamilyOrder).toEqual(order);
  });
});

describe('per-rep export identity (FR-58.15 / OQ-58.2)', () => {
  it('gives every rep of the program its own filename', () => {
    // Each rep is a fresh `activateDrill()`, so `startedAt` is re-stamped per rep — that is the
    // whole uniqueness mechanism, and OQ-58.2 decided not to add a rep suffix on top of it.
    const basenames = RUN_STEPS.map((step, index) =>
      exportBasename(payloadFor(step, `2026-09-08T10:0${index}:00.000Z`)),
    );
    expect(basenames).toHaveLength(5);
    expect(new Set(basenames).size).toBe(5);
    // Three reps of one drill produce three files, differing only in the timestamp.
    expect(basenames.filter((name) => name.startsWith('hold_click_v1-'))).toHaveLength(3);
  });

  it('locates each export at its own step of the program', () => {
    RUN_STEPS.forEach((step, index) => {
      const { meta } = payloadFor(step, `2026-09-08T10:0${index}:00.000Z`);
      expect(meta.sessionPlanItemIndex).toBe(step.itemIndex);
      expect(meta.sessionPlanRepIndex).toBe(step.repIndex);
      // The coordinates resolve inside the recorded program, and resolve to this run's drill.
      const item = meta.sessionPlanItems?.[meta.sessionPlanItemIndex ?? -1];
      expect(item?.drillId).toBe(meta.drillId);
      expect(meta.sessionPlanRepIndex).toBeLessThan(item?.reps ?? 0);
    });
    expect(RUN_STEPS.map((step) => [step.itemIndex, step.repIndex])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ]);
  });

  it('names two reps identically only if they somehow started in the same millisecond', () => {
    // The known (and accepted) boundary of the timestamp scheme, pinned so nobody later "optimises"
    // `startedAt` into something coarser without noticing what it costs.
    const first = exportBasename(payloadFor(RUN_STEPS[0], '2026-09-08T10:00:00.000Z'));
    const second = exportBasename(payloadFor(RUN_STEPS[1], '2026-09-08T10:00:00.000Z'));
    expect(second).toBe(first);
  });
});
