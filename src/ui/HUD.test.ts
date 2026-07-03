import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createHUDStats, createHUDSummary, type HUDStats } from './HUD.ts';

describe('createHUDSummary', () => {
  it('formats score, elapsed time, hit rate, and moving velocity state', () => {
    const summary = createHUDSummary({
      phase: 'running',
      elapsedMs: 65_432,
      score: 3,
      fireCount: 5,
      hitCount: 3,
      vx: 250,
      vz: 0,
      stopped: false,
    });

    expect(summary).toEqual({
      scoreText: '3',
      timeText: '01:05.4',
      hitRateText: '60.0%',
      velocityText: 'MOVING',
      velocityDetail: '250 u/s',
      stopped: false,
    });
  });

  it('keeps empty and stopped samples display-safe', () => {
    const summary = createHUDSummary({
      phase: 'countdown',
      elapsedMs: -1,
      score: 0,
      fireCount: 0,
      hitCount: 0,
      vx: 0,
      vz: 0,
      stopped: true,
    });

    expect(summary.timeText).toBe('00:00.0');
    expect(summary.hitRateText).toBe('N/A');
    expect(summary.velocityText).toBe('STOP');
  });
});

describe('createHUDStats', () => {
  it('fills a reusable stats object from SharedState and recorder counters', () => {
    const state = createSharedState();
    const target: HUDStats = {
      phase: 'idle',
      elapsedMs: 0,
      score: 0,
      fireCount: 0,
      hitCount: 0,
      vx: 0,
      vz: 0,
      stopped: false,
    };
    state.player.vx = -250;
    state.player.vz = 10;

    const returned = createHUDStats(state, 'running', 1234, 2, 4, 2, target);

    expect(returned).toBe(target);
    expect(target).toMatchObject({
      phase: 'running',
      elapsedMs: 1234,
      score: 2,
      fireCount: 4,
      hitCount: 2,
      vx: -250,
      vz: 10,
      stopped: false,
    });
  });
});
