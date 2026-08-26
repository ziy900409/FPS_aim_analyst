import { describe, expect, it, vi } from 'vitest';

import { TRANSFER_PILOT_FAMILY_IDS } from './sessionSchedule.ts';
import {
  createSessionRunner,
  resolveFamilyDrillId,
  resolveWarmupDrillId,
  type SessionPlan,
} from './SessionRunner.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

describe('SessionRunner', () => {
  it('preserves the selected-family sequence and inserts the configured rest', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const plan: SessionPlan = {
      participantId: 'P001',
      sessionIndex: 1,
      families: ['spider-shot', 'hold-click', 'counterstrafe'],
      restSeconds: 17,
      includeWarmup: false,
    };

    await runner.start(plan);

    expect(runner.phase).toEqual({ kind: 'family', family: plan.families[0], familyIndex: 0 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: plan.families[1], remainingMs: 17_000 });
    runner.poll(1_000);
    runner.poll(18_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: plan.families[1], familyIndex: 1 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: plan.families[2], remainingMs: 17_000 });
    runner.poll(100_000);
    runner.poll(117_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: plan.families[2], familyIndex: 2 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual(plan.families.map(resolveFamilyDrillId));
  });

  it.each([
    { families: [], message: 'Session plan must include at least one family' },
    { families: ['hold-click', 'hold-click'], message: 'Session plan families must not contain duplicates' },
    { families: ['hold-click', 'unknown'], message: 'Unknown session plan family: unknown' },
  ])('rejects an invalid family order: $message', async ({ families, message }) => {
    const runner = createSessionRunner({ loadDrillById: vi.fn(async () => {}) });

    await expect(
      runner.start({
        participantId: 'P001',
        sessionIndex: 0,
        families: families as SessionPlan['families'],
        restSeconds: 60,
        includeWarmup: false,
      }),
    ).rejects.toThrow(message);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid restSeconds: %s', async (restSeconds) => {
    const runner = createSessionRunner({ loadDrillById: vi.fn(async () => {}) });

    await expect(
      runner.start({
        participantId: 'P001',
        sessionIndex: 0,
        families: ['hold-click'],
        restSeconds,
        includeWarmup: false,
      }),
    ).rejects.toThrow('restSeconds must be a non-negative finite number');
  });

  it('reports unavailable warmup explicitly and starts assessment instead', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const onStatus = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click'],
      restSeconds: 60,
      includeWarmup: true,
    });

    expect(runner.phase).toEqual({ kind: 'family', family: 'hold-click', familyIndex: 0 });
    expect(onStatus).toHaveBeenCalledWith('本家族無熱身，直接開始正式測試。');
    expect(loadDrillById).toHaveBeenCalledWith('hold_click_v1');
  });

  it('loads the counterstrafe practice drill before its assessment', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['counterstrafe'],
      restSeconds: 60,
      includeWarmup: true,
    });

    expect(runner.phase).toEqual({ kind: 'warmup', family: 'counterstrafe', availability: 'available' });
    expect(loadDrillById).toHaveBeenCalledWith('counterstrafe-free-v1');
    await runner.advance();
    expect(loadDrillById).toHaveBeenLastCalledWith('counterstrafe-reversal-v1');
  });

  it('uses closed drill mappings for every family', () => {
    expect(resolveFamilyDrillId('hold-click')).toBe('hold_click_v1');
    expect(resolveFamilyDrillId('hold-track')).toBe('hold_track_v1');
    expect(resolveFamilyDrillId('spider-shot')).toBe('spider-shot-v1');
    expect(resolveFamilyDrillId('counterstrafe')).toBe('counterstrafe-reversal-v1');
    expect(resolveFamilyDrillId('peek-click-transfer')).toBe('peek_click_transfer_pilot_v1_2deg');
    expect(resolveWarmupDrillId('counterstrafe')).toEqual({
      availability: 'available',
      drillId: 'counterstrafe-free-v1',
    });
  });

  it('reports unavailable warmup for the peek-click-transfer pilot family and loads it directly', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const onStatus = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['peek-click-transfer'],
      restSeconds: 60,
      includeWarmup: true,
    });

    expect(runner.phase).toEqual({ kind: 'family', family: 'peek-click-transfer', familyIndex: 0 });
    expect(onStatus).toHaveBeenCalledWith('本家族無熱身，直接開始正式測試。');
    expect(loadDrillById).toHaveBeenCalledWith(resolveFamilyDrillId('peek-click-transfer'));
    expect(resolveWarmupDrillId('peek-click-transfer')).toEqual({ availability: 'unavailable' });
  });

  it('runs the versioned transfer-pilot roster end to end with 60s rest between families (WP-45 T5)', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const plan: SessionPlan = {
      participantId: 'P001',
      sessionIndex: 0,
      families: [...TRANSFER_PILOT_FAMILY_IDS],
      restSeconds: 60,
      includeWarmup: true,
    };

    await runner.start(plan);
    // hold-click has no warmup drill — starts the family directly (README §T5 design decision).
    expect(runner.phase).toEqual({ kind: 'family', family: 'hold-click', familyIndex: 0 });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'counterstrafe', remainingMs: 60_000 });
    runner.poll(1_000);
    runner.poll(61_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: 'counterstrafe', familyIndex: 1 });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'peek-click-transfer', remainingMs: 60_000 });
    runner.poll(100_000);
    runner.poll(160_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: 'peek-click-transfer', familyIndex: 2 });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual(plan.families.map(resolveFamilyDrillId));
  });
});
