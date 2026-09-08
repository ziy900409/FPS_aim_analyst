import { describe, expect, it, vi } from 'vitest';

import { TRANSFER_PILOT_FAMILY_IDS, type SessionFamilyId } from './sessionSchedule.ts';
import {
  buildFrozenSessionPlan,
  createSessionRunner,
  resolveFamilyDrillId,
  resolveWarmupDrillId,
  type FrozenSessionPlanInput,
  type SessionRunnerPhase,
} from './SessionRunner.ts';

/**
 * WP-58 T3 — frozen-track behavioural equivalence.
 *
 * Every scenario here existed before the runner was turned into a cursor; each one is rewritten
 * against the new phase union without weakening a single assertion. The point of the file is narrow
 * and load-bearing: the counterbalanced Assessment protocol must be observably unchanged (family
 * order, rest length, warmup resolution, which drill each family loads), because sessions recorded
 * before and after this refactor have to stay comparable.
 */

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function frozen(
  overrides: Partial<FrozenSessionPlanInput> & Pick<FrozenSessionPlanInput, 'families'>,
): ReturnType<typeof buildFrozenSessionPlan> {
  return buildFrozenSessionPlan({
    participantId: 'P001',
    sessionIndex: 0,
    restSeconds: 60,
    includeWarmup: false,
    ...overrides,
  });
}

/** The whole `run` phase, spelled out — cursor, step, and every step field. */
function runPhase(
  cursor: number,
  family: SessionFamilyId,
  itemIndex: number,
  extra?: { readonly drillId?: string; readonly warmup?: true },
): SessionRunnerPhase {
  return {
    kind: 'run',
    cursor,
    step: {
      kind: 'run',
      drillId: extra?.drillId ?? resolveFamilyDrillId(family),
      family,
      itemIndex,
      repIndex: 0,
      repCount: 1,
      ...(extra?.warmup === true ? { warmup: true } : {}),
    },
  };
}

/** The whole `rest` phase. Every seam in a frozen program is a family seam (see the builder). */
function familyRestPhase(
  cursor: number,
  seconds: number,
  nextFamily: SessionFamilyId,
  remainingMs = seconds * 1_000,
): SessionRunnerPhase {
  return {
    kind: 'rest',
    cursor,
    step: { kind: 'rest', seconds, boundary: 'family', nextDrillId: resolveFamilyDrillId(nextFamily) },
    remainingMs,
  };
}

describe('SessionRunner', () => {
  it('preserves the selected-family sequence and inserts the configured rest', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const families: readonly SessionFamilyId[] = ['spider-shot', 'hold-click', 'counterstrafe'];
    const { plan } = frozen({ families, sessionIndex: 1, restSeconds: 17 });

    await runner.start(plan);

    expect(runner.phase).toEqual(runPhase(0, families[0], 0));
    await runner.advance();
    expect(runner.phase).toEqual(familyRestPhase(1, 17, families[1]));
    runner.poll(1_000);
    runner.poll(18_000);
    await settleTransitions();
    expect(runner.phase).toEqual(runPhase(2, families[1], 1));
    await runner.advance();
    expect(runner.phase).toEqual(familyRestPhase(3, 17, families[2]));
    runner.poll(100_000);
    runner.poll(117_000);
    await settleTransitions();
    expect(runner.phase).toEqual(runPhase(4, families[2], 2));
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual(families.map(resolveFamilyDrillId));
  });

  it.each([
    { families: [], message: 'Session plan must include at least one family' },
    { families: ['hold-click', 'hold-click'], message: 'Session plan families must not contain duplicates' },
    { families: ['hold-click', 'unknown'], message: 'Unknown session plan family: unknown' },
  ])('rejects an invalid family order: $message', ({ families, message }) => {
    // The rejection moved one step earlier (compile time rather than start time): an invalid plan
    // now cannot even be expressed as a program, let alone reach the runtime.
    expect(() => frozen({ families: families as readonly SessionFamilyId[] })).toThrow(message);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid restSeconds: %s', (restSeconds) => {
    expect(() => frozen({ families: ['hold-click'], restSeconds })).toThrow(
      'restSeconds must be a non-negative finite number',
    );
  });

  it('reports unavailable warmup explicitly and starts assessment instead', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const build = frozen({ families: ['hold-click'], includeWarmup: true });

    // The "no warmup for this family" fact is now reported by the compile step (whose caller renders
    // the operator message), not discovered mid-run by the state machine.
    expect(build.warmupAvailability).toBe('unavailable');
    expect(build.plan.items).toEqual([{ drillId: 'hold_click_v1', reps: 1 }]);

    await runner.start(build.plan);

    expect(runner.phase).toEqual(runPhase(0, 'hold-click', 0));
    expect(loadDrillById).toHaveBeenCalledWith('hold_click_v1');
  });

  it('loads the counterstrafe practice drill before its assessment, with no rest in between', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const onStatus = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus });
    const build = frozen({ families: ['counterstrafe'], includeWarmup: true });

    expect(build.warmupAvailability).toBe('available');
    // Warmup -> first family is a same-family seam carrying a 0 s rest, which the compiler drops:
    // exactly the "advance straight from warmup into the assessment" the old state machine did.
    expect(build.plan.program.map((step) => step.kind)).toEqual(['run', 'run']);

    await runner.start(build.plan);

    expect(runner.phase).toEqual(
      runPhase(0, 'counterstrafe', 0, { drillId: 'counterstrafe-free-v1', warmup: true }),
    );
    expect(loadDrillById).toHaveBeenCalledWith('counterstrafe-free-v1');
    await runner.advance();
    expect(runner.phase).toEqual(runPhase(1, 'counterstrafe', 1));
    expect(loadDrillById).toHaveBeenLastCalledWith('counterstrafe-reversal-v1');
    // The warmup is not counted in the "n / N" progress readout, as before WP-58.
    expect(onStatus.mock.calls.map(([text]) => text)).toEqual([
      '熱身: counterstrafe',
      '正式測試 1/1: counterstrafe',
    ]);
  });

  it('uses closed drill mappings for every family', () => {
    expect(resolveFamilyDrillId('hold-click')).toBe('hold_click_v1');
    expect(resolveFamilyDrillId('hold-track')).toBe('hold_track_v1');
    expect(resolveFamilyDrillId('spider-shot')).toBe('spider-shot-v3');
    expect(resolveFamilyDrillId('counterstrafe')).toBe('counterstrafe-reversal-v1');
    expect(resolveFamilyDrillId('peek-click-transfer')).toBe('peek_click_transfer_pilot_v1_2deg');
    expect(resolveFamilyDrillId('peek-click-transfer-v1')).toBe('peek_click_transfer_v1');
    expect(resolveWarmupDrillId('counterstrafe')).toEqual({
      availability: 'available',
      drillId: 'counterstrafe-free-v1',
    });
  });

  it('resolves the formal peek-click-transfer-v1 family to a drill distinct from every pilot family (WP-53 T4, FR-53-6)', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const build = frozen({ families: ['peek-click-transfer-v1'], includeWarmup: true });

    await runner.start(build.plan);

    expect(build.warmupAvailability).toBe('unavailable');
    expect(runner.phase).toEqual(runPhase(0, 'peek-click-transfer-v1', 0));
    expect(loadDrillById).toHaveBeenCalledWith('peek_click_transfer_v1');
    expect(resolveFamilyDrillId('peek-click-transfer-v1')).not.toBe(resolveFamilyDrillId('peek-click-transfer'));
    expect(resolveWarmupDrillId('peek-click-transfer-v1')).toEqual({ availability: 'unavailable' });
  });

  it('reports unavailable warmup for the peek-click-transfer pilot family and loads it directly', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const build = frozen({ families: ['peek-click-transfer'], includeWarmup: true });

    await runner.start(build.plan);

    expect(build.warmupAvailability).toBe('unavailable');
    expect(runner.phase).toEqual(runPhase(0, 'peek-click-transfer', 0));
    expect(loadDrillById).toHaveBeenCalledWith(resolveFamilyDrillId('peek-click-transfer'));
    expect(resolveWarmupDrillId('peek-click-transfer')).toEqual({ availability: 'unavailable' });
  });

  it('runs the versioned transfer-pilot roster end to end with 60s rest between families (WP-45 T5)', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const families = [...TRANSFER_PILOT_FAMILY_IDS];
    const build = frozen({ families, includeWarmup: true });

    // hold-click has no warmup drill — starts the family directly (README §T5 design decision).
    expect(build.warmupAvailability).toBe('unavailable');
    await runner.start(build.plan);
    expect(runner.phase).toEqual(runPhase(0, 'hold-click', 0));

    await runner.advance();
    expect(runner.phase).toEqual(familyRestPhase(1, 60, 'counterstrafe'));
    runner.poll(1_000);
    runner.poll(61_000);
    await settleTransitions();
    expect(runner.phase).toEqual(runPhase(2, 'counterstrafe', 1));

    await runner.advance();
    expect(runner.phase).toEqual(familyRestPhase(3, 60, 'peek-click-transfer'));
    runner.poll(100_000);
    runner.poll(160_000);
    await settleTransitions();
    expect(runner.phase).toEqual(runPhase(4, 'peek-click-transfer', 2));

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual(families.map(resolveFamilyDrillId));
  });
});
