import { describe, expect, it, vi } from 'vitest';
import { createSessionRunner } from './SessionRunner.ts';

async function settleTransitions(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SessionRunner.poll', () => {
  it('is a no-op outside rest and automatically starts the next family when rest expires', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click', 'hold-track'],
      restSeconds: 60,
      includeWarmup: false,
    });

    runner.poll(1_000);
    expect(runner.phase).toEqual({ kind: 'family', family: 'hold-click', familyIndex: 0 });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'hold-track', remainingMs: 60_000 });
    runner.poll(2_000);
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'hold-track', remainingMs: 60_000 });
    runner.poll(62_000);
    await settleTransitions();

    expect(runner.phase).toEqual({ kind: 'family', family: 'hold-track', familyIndex: 1 });
    expect(loadDrillById).toHaveBeenLastCalledWith('hold_track_v1');
  });

  it('recovers from a failed auto-advance instead of leaving the rest phase (and its overlay) stuck forever', async () => {
    const loadDrillById = vi
      .fn<(drillId: string) => Promise<void>>()
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        throw new Error('scene load failed');
      });
    const onStatus = vi.fn();
    const onPhaseChange = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus, onPhaseChange });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click', 'hold-track'],
      restSeconds: 60,
      includeWarmup: false,
    });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextFamily: 'hold-track', remainingMs: 60_000 });
    onPhaseChange.mockClear();

    runner.poll(2_000);
    runner.poll(62_000);
    await settleTransitions();

    // The failed loadDrillById must not leave the state machine (and therefore the rest
    // overlay driven by onPhaseChange) stuck at 'rest' forever.
    expect(runner.phase.kind).not.toBe('rest');
    expect(onPhaseChange).toHaveBeenCalledWith(expect.objectContaining({ kind: runner.phase.kind }));
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('scene load failed'));
  });
});
