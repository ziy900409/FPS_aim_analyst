import { describe, expect, it, vi } from 'vitest';

vi.mock('./sessionSchedule.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sessionSchedule.ts')>();
  return { ...actual, buildFamilyOrder: vi.fn(actual.buildFamilyOrder) };
});

import {
  createSessionRunner,
  resolveFamilyDrillId,
  resolveWarmupDrillId,
  type SessionPlan,
} from './SessionRunner.ts';
import { buildFamilyOrder } from './sessionSchedule.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

describe('SessionRunner', () => {
  it('uses buildFamilyOrder for the selected-family sequence and inserts rest', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    const plan: SessionPlan = {
      participantId: 'P001',
      sessionIndex: 1,
      families: ['counterstrafe', 'hold-track', 'spider-shot'],
      presetId: 'pilot-default',
      includeWarmup: false,
    };
    const expectedFamilies = buildFamilyOrder(plan.participantId, plan.sessionIndex).filter((family) =>
      plan.families.includes(family),
    );
    vi.mocked(buildFamilyOrder).mockClear();

    await runner.start(plan);

    expect(buildFamilyOrder).toHaveBeenCalledTimes(1);
    expect(buildFamilyOrder).toHaveBeenCalledWith(plan.participantId, plan.sessionIndex);
    expect(runner.phase).toEqual({ kind: 'family', family: expectedFamilies[0], familyIndex: 0 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: expectedFamilies[1], remainingMs: 60_000 });
    runner.poll(1_000);
    runner.poll(61_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: expectedFamilies[1], familyIndex: 1 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: expectedFamilies[2], remainingMs: 60_000 });
    runner.poll(100_000);
    runner.poll(160_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: expectedFamilies[2], familyIndex: 2 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual(expectedFamilies.map(resolveFamilyDrillId));
  });

  it('changes the first scheduled family when sessionIndex changes', async () => {
    const participantId = 'P001';
    const firstOrder = buildFamilyOrder(participantId, 0);
    const secondOrder = buildFamilyOrder(participantId, 1);
    vi.mocked(buildFamilyOrder).mockClear();
    const firstRunner = createSessionRunner({ loadDrillById: vi.fn(async () => {}) });
    const secondRunner = createSessionRunner({ loadDrillById: vi.fn(async () => {}) });

    await firstRunner.start({
      participantId,
      sessionIndex: 0,
      families: firstOrder,
      presetId: 'pilot-default',
      includeWarmup: false,
    });
    await secondRunner.start({
      participantId,
      sessionIndex: 1,
      families: secondOrder,
      presetId: 'pilot-default',
      includeWarmup: false,
    });

    expect(firstOrder).not.toEqual(secondOrder);
    expect(firstRunner.phase).toEqual({ kind: 'family', family: firstOrder[0], familyIndex: 0 });
    expect(secondRunner.phase).toEqual({ kind: 'family', family: secondOrder[0], familyIndex: 0 });
  });

  it('reports unavailable warmup explicitly and starts assessment instead', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const onStatus = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click'],
      presetId: 'pilot-default',
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
      presetId: 'pilot-default',
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
    expect(resolveWarmupDrillId('counterstrafe')).toEqual({
      availability: 'available',
      drillId: 'counterstrafe-free-v1',
    });
  });
});
