import { describe, expect, it } from 'vitest';
import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { createMetricsDashboard } from './MetricsDashboard.ts';

describe('MetricsDashboard', () => {
  it('computes a result model from a recorder snapshot', () => {
    const dashboard = createMetricsDashboard();
    const snapshot: DataRecorderSnapshot = {
      ticks: [],
      events: [
        { type: 'visible', targetId: 't0', side: 'R', t: 10 },
        { type: 'counter', key: 'A', t: 30 },
        { type: 'fire', targetId: 't0', t: 40, hit: true, firstShot: true, residualSpeed: 0, offsetDeg: 0 },
      ],
      recorderOverflow: false,
    };

    const metrics = dashboard.compute(snapshot);

    expect(metrics.counterReactionMs.values).toEqual([20]);
    expect(metrics.firstShotHitRate).toBe(100);
  });
});
