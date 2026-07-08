import { describe, expect, it } from 'vitest';
import { MAX_DISPLAY_HZ, PERF_FLOOR_MS } from './constants.ts';
import { createFrameLog, frameLogCapacity } from './frameLog.ts';

describe('frameLogCapacity', () => {
  it('reserves maxDrillSeconds times MAX_DISPLAY_HZ samples', () => {
    expect(frameLogCapacity(300)).toBe(300 * MAX_DISPLAY_HZ);
    expect(frameLogCapacity(0.5, 240)).toBe(120);
  });
});

describe('createFrameLog', () => {
  it('stores frame deltas in insertion order and keeps the hot push path primitive-only', () => {
    const log = createFrameLog(4);

    expect(log.push(1000)).toBe(true);
    expect(log.push(1008)).toBe(true);
    expect(log.push(1016.5)).toBe(true);
    expect(log.push(1024.5)).toBe(true);

    expect(log.series()).toEqual([8, 8.5, 8]);
    expect(log.count).toBe(3);
    expect(log.overflow).toBe(false);
  });

  it('stops recording and marks overflow instead of wrapping', () => {
    const log = createFrameLog(2);

    log.push(0);
    log.push(8);
    log.push(16);
    expect(log.push(24)).toBe(false);
    expect(log.push(32)).toBe(false);

    expect(log.series()).toEqual([8, 8]);
    expect(log.overflow).toBe(true);
    expect(log.frozen).toBe(true);
  });

  it('resets the cursor and clears overflow', () => {
    const log = createFrameLog(1);
    log.push(0);
    log.push(8);
    log.push(16);
    expect(log.overflow).toBe(true);

    log.reset();
    log.push(100);
    log.push(110);

    expect(log.series()).toEqual([10]);
    expect(log.overflow).toBe(false);
    expect(log.frozen).toBe(false);
  });

  it('freezes the drill and ignores later timestamps', () => {
    const log = createFrameLog(4);

    log.push(0);
    log.push(8);
    log.freeze();
    expect(log.push(16)).toBe(false);

    expect(log.series()).toEqual([8]);
  });

  it('summarizes frame deltas with p50, nearest-rank tail percentiles, and budget windows', () => {
    const log = createFrameLog(8);
    for (const t of [0, 8, 16, 24, 40, 48]) log.push(t);

    expect(log.summary(PERF_FLOOR_MS)).toEqual({
      count: 5,
      p50: 8,
      p95: 16,
      p99: 16,
      overBudgetWindows: 1,
      overflow: false,
    });
  });

  it('estimates refresh rate from the median logged delta', () => {
    const log = createFrameLog(8);
    for (const t of [0, 8.33, 16.66, 24.99, 33.32]) log.push(t);

    expect(log.refreshEstimate()).toEqual({
      refreshEstimateHz: 120,
      medianDeltaMs: 8.33,
    });
  });

  it('exports both the full delta series and summary', () => {
    const log = createFrameLog(4);
    for (const t of [0, 10, 20]) log.push(t);

    expect(log.export()).toEqual({
      series: [10, 10],
      summary: {
        count: 2,
        p50: 10,
        p95: 10,
        p99: 10,
        overBudgetWindows: 2,
        overflow: false,
      },
    });
  });
});
