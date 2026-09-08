import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { compileSessionProgram, type ProgramStep } from './sessionProgram.ts';
import { TEST_FAMILY_IDS, type SessionFamilyId } from './sessionSchedule.ts';
import {
  buildFrozenSessionPlan,
  createSessionRunner,
  resolveFamilyDrillId,
  type SessionPlan,
} from './SessionRunner.ts';

/**
 * WP-58 T3 — the cursor itself: the shape a frozen plan compiles to, two-tier rests, reps, and the
 * runtime invariants the render loop depends on (NFR-58.3, NFR-58.5, ADR-2).
 *
 * `SessionRunner.test.ts` covers behavioural equivalence with the pre-WP-58 state machine; this file
 * covers what only exists now that the schedule is an array.
 */

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function kindsOf(program: readonly ProgramStep[]): readonly string[] {
  return program.map((step) => step.kind);
}

function customPlan(program: readonly ProgramStep[]): SessionPlan {
  return { participantId: 'P001', sessionIndex: 0, mode: 'custom', items: [], program };
}

describe('WP-58 T3 — a frozen plan compiles to N runs and N-1 family rests', () => {
  it.each([1, 2, 3, 4])('has the expected shape for %i families', (count) => {
    const families = TEST_FAMILY_IDS.slice(0, count) as readonly SessionFamilyId[];
    const { plan } = buildFrozenSessionPlan({
      participantId: 'P001',
      sessionIndex: 0,
      families,
      restSeconds: 60,
      includeWarmup: false,
    });

    const runs = plan.program.filter((step) => step.kind === 'run');
    const rests = plan.program.filter((step) => step.kind === 'rest');
    expect(runs).toHaveLength(count);
    expect(rests).toHaveLength(count - 1);
    expect(runs.map((step) => step.drillId)).toEqual(families.map(resolveFamilyDrillId));
    // Every seam of a frozen program is a family seam, and every one takes the configured rest.
    expect(rests.every((step) => step.boundary === 'family' && step.seconds === 60)).toBe(true);
    expect(plan.mode).toBe('frozen');
  });

  it('prepends the warmup as run 0 without inserting a rest before the first measured run', () => {
    const { plan } = buildFrozenSessionPlan({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['counterstrafe', 'hold-click'],
      restSeconds: 60,
      includeWarmup: true,
    });

    expect(kindsOf(plan.program)).toEqual(['run', 'run', 'rest', 'run']);
    expect(plan.program[0]).toMatchObject({ drillId: counterstrafeFreeV1.drillId, warmup: true });
    expect(plan.program[1]).toMatchObject({ drillId: counterstrafeReversalV1.drillId });
    expect(plan.program[1]).not.toHaveProperty('warmup');
  });

  it('emits no rest at all when the operator asks for 0 rest seconds (FR-58.6)', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const { plan } = buildFrozenSessionPlan({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click', 'hold-track'],
      restSeconds: 0,
      includeWarmup: false,
    });

    expect(kindsOf(plan.program)).toEqual(['run', 'run']);

    // No zero-length overlay flashes for a frame, and advancing no longer needs a poll() to get past
    // an instantly-expired rest.
    const runner = createSessionRunner({ loadDrillById });
    await runner.start(plan);
    await runner.advance();
    expect(runner.phase).toMatchObject({ kind: 'run', cursor: 1, step: { drillId: 'hold_track_v1' } });
  });
});

describe('WP-58 T3 — the cursor walks a custom program with reps and two rest tiers', () => {
  const items = [
    { drillId: holdClickV1.id, reps: 2 },
    { drillId: counterstrafeFreeV1.drillId, reps: 1 },
    { drillId: counterstrafeReversalV1.drillId, reps: 1 },
  ];
  const program = compileSessionProgram({ items, drillRestSeconds: 30, familyRestSeconds: 60 });

  it('compiles to the rep / family / drill seams the plan describes', () => {
    expect(kindsOf(program)).toEqual(['run', 'rest', 'run', 'rest', 'run', 'rest', 'run']);
    expect(program.filter((step) => step.kind === 'rest').map((step) => [step.boundary, step.seconds])).toEqual([
      ['rep', 30],
      ['family', 60],
      ['drill', 30],
    ]);
  });

  it('counts each rest down against its own step, not one shared duration', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start(customPlan(program));

    let now = 0;
    const restLengths: number[] = [];
    for (let seam = 0; seam < 3; seam += 1) {
      await runner.advance();
      expect(runner.phase.kind).toBe('rest');
      const startedAt = now;
      runner.poll(now);
      // Poll a frame at a time until the countdown expires; the recorded elapsed time is what the
      // participant actually rested, which is the number the protocol is written in.
      while (runner.phase.kind === 'rest') {
        now += 1_000;
        runner.poll(now);
        await settleTransitions();
      }
      restLengths.push(now - startedAt);
    }

    expect(restLengths).toEqual([30_000, 60_000, 30_000]);
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual([
      holdClickV1.id,
      holdClickV1.id,
      counterstrafeFreeV1.drillId,
      counterstrafeReversalV1.drillId,
    ]);
  });

  it('numbers every measured run over the program, and re-runs the same drill for each rep', async () => {
    const onStatus = vi.fn();
    const runner = createSessionRunner({ loadDrillById: async () => {}, onStatus });
    await runner.start(customPlan(program));

    expect(runner.phase).toMatchObject({ kind: 'run', step: { repIndex: 0, repCount: 2, itemIndex: 0 } });
    await runner.advance();
    await runner.advance();
    // Reps repeat the *same* drill id — the schedule layer never touches drill config (D-58-P1).
    expect(runner.phase).toMatchObject({
      kind: 'run',
      step: { drillId: holdClickV1.id, repIndex: 1, repCount: 2, itemIndex: 0 },
    });
    expect(onStatus.mock.calls.map(([text]) => text)).toEqual([
      '正式測試 1/4: hold-click',
      '休息後開始: hold-click',
      '正式測試 2/4: hold-click',
    ]);
  });
});

describe('WP-58 T3 — start() refuses a plan it cannot run', () => {
  it('rejects an empty program', async () => {
    const runner = createSessionRunner({ loadDrillById: async () => {} });
    await expect(runner.start(customPlan([]))).rejects.toThrow('Session plan program must not be empty');
    expect(runner.phase).toEqual({ kind: 'idle' });
  });

  it.each([-1, 1.5])('rejects sessionIndex %s', async (sessionIndex) => {
    const runner = createSessionRunner({ loadDrillById: async () => {} });
    const program = compileSessionProgram({
      items: [{ drillId: holdClickV1.id, reps: 1 }],
      drillRestSeconds: 0,
      familyRestSeconds: 0,
    });
    await expect(runner.start({ ...customPlan(program), sessionIndex })).rejects.toThrow(
      'sessionIndex must be a non-negative integer',
    );
  });

  it('rejects a second start while a session is running', async () => {
    const runner = createSessionRunner({ loadDrillById: async () => {} });
    const plan = buildFrozenSessionPlan({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click'],
      restSeconds: 60,
      includeWarmup: false,
    }).plan;

    await runner.start(plan);
    await expect(runner.start(plan)).rejects.toThrow('SessionRunner is already active');
  });
});

describe('WP-58 T3 — SessionRunner stays outside the three loops (ADR-2 / NFR-58.5)', () => {
  const FORBIDDEN: readonly RegExp[] = [
    /from ['"]three/,
    /SharedState/,
    /SimLoop/,
    /InputSampler/,
    /DataRecorder/,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
    /requestAnimationFrame/,
    /document\./,
    /window\./,
  ];

  it.each(FORBIDDEN)('SessionRunner.ts contains no %s', (pattern) => {
    const source = readFileSync(new URL('./SessionRunner.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(pattern);
  });
});
