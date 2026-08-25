import { describe, expect, it, vi } from 'vitest';
import { createSessionRunner, resolveFamilyDrillId, resolveWarmupDrillId } from './SessionRunner.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

describe('SessionRunner', () => {
  it('runs selected families in the fixed T1 family order and inserts rest', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['counterstrafe', 'hold-track', 'spider-shot'],
      presetId: 'pilot-default',
      includeWarmup: false,
    });

    expect(runner.phase).toEqual({ kind: 'family', family: 'hold-track', familyIndex: 0 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'spider-shot', remainingMs: 60_000 });
    runner.poll(1_000);
    runner.poll(61_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: 'spider-shot', familyIndex: 1 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'counterstrafe', remainingMs: 60_000 });
    runner.poll(100_000);
    runner.poll(160_000);
    await settleTransitions();
    expect(runner.phase).toEqual({ kind: 'family', family: 'counterstrafe', familyIndex: 2 });
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });
    expect(loadDrillById.mock.calls.map(([id]) => id)).toEqual([
      'hold_track_v1',
      'spider-shot-v1',
      'counterstrafe-reversal-v1',
    ]);
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
