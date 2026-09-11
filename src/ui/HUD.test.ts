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

    const returned = createHUDStats(state, 'running', 1234, 2, 4, 2, target, undefined);

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

  it('carries the drill time limit through to the reused stats object (WP-65 T4)', () => {
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

    createHUDStats(state, 'running', 500, 0, 0, 0, target, 60_000);
    expect(target.timeLimitMs).toBe(60_000);

    // The same reused object must be able to go back to counting up when the next drill is a
    // `targetCount` one — a stale limit would silently turn its Time card into a countdown.
    createHUDStats(state, 'running', 500, 0, 0, 0, target, undefined);
    expect(target.timeLimitMs).toBeUndefined();
    expect(createHUDSummary(target).timeText).toBe('00:00.5');
  });
});

/**
 * WP-65 / T4（FR-65.7/FR-65.8）：`timeLimit` 型 drill 的 Time 卡倒數。`formatElapsed()` 零修改,
 * 倒數只是換一個輸入——下面的期望值同時釘死「換了輸入」與「沒換格式」。
 */
describe('WP-65 T4 — the time card counts down only for time-limited drills', () => {
  function summaryOf(overrides: Partial<HUDStats>): string {
    return createHUDSummary({
      phase: 'running',
      elapsedMs: 0,
      score: 0,
      fireCount: 0,
      hitCount: 0,
      vx: 0,
      vz: 0,
      stopped: true,
      ...overrides,
    }).timeText;
  }

  it('leaves the count-up path byte-for-byte unchanged when no limit is given', () => {
    // The three expectations are lifted from the pre-WP-65 suites above, unedited: `targetCount`
    // drills must read exactly as they did before this slice.
    expect(summaryOf({ elapsedMs: 65_432 })).toBe('01:05.4');
    expect(summaryOf({ elapsedMs: -1, phase: 'countdown' })).toBe('00:00.0');
    expect(summaryOf({ elapsedMs: 1234 })).toBe('00:01.2');
  });

  it('shows the full duration before the clock starts (FR-65.8)', () => {
    // `elapsedMs === 0` covers `armed`, `countdown` and the first running frame alike — the HUD
    // needs no phase branch of its own, which is why `main.ts` zeroes `hudElapsedMs` for `armed`.
    expect(summaryOf({ elapsedMs: 0, timeLimitMs: 60_000, phase: 'armed' })).toBe('01:00.0');
    expect(summaryOf({ elapsedMs: 0, timeLimitMs: 60_000, phase: 'countdown' })).toBe('01:00.0');
  });

  it('decreases as the run proceeds and lands on zero at the limit', () => {
    expect(summaryOf({ elapsedMs: 12_600, timeLimitMs: 60_000 })).toBe('00:47.4');
    expect(summaryOf({ elapsedMs: 60_000, timeLimitMs: 60_000 })).toBe('00:00.0');
  });

  it('clamps past the limit instead of going negative', () => {
    // Overrun really happens: `endCondition` is judged on a sim tick while the HUD reads the rAF
    // clock, so the two can differ by a frame.
    expect(summaryOf({ elapsedMs: 61_000, timeLimitMs: 60_000 })).toBe('00:00.0');
    expect(summaryOf({ elapsedMs: Number.POSITIVE_INFINITY, timeLimitMs: 60_000 })).toBe('00:00.0');
  });

  it('keeps a non-finite limit display-safe rather than printing NaN', () => {
    expect(summaryOf({ elapsedMs: 1000, timeLimitMs: Number.NaN })).toBe('00:00.0');
  });
});
