import { describe, expect, it, vi } from 'vitest';
import { createSessionRunner } from './SessionRunner.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

describe('SessionRunner.poll', () => {
  it('is a no-op outside rest and automatically starts the next family when rest expires', async () => {
    const loadDrillById = vi.fn<(drillId: string) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      families: ['hold-click', 'hold-track'],
      presetId: 'pilot-default',
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
});
