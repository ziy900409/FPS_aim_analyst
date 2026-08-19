import { describe, expect, it } from 'vitest';
import { deriveTrackingTransitions } from './trackingTransitions.ts';

describe('deriveTrackingTransitions', () => {
  it('reports no drops for continuously on-target samples', () => {
    expect(deriveTrackingTransitions(samples(true, true, true), 'target-1')).toEqual({
      targetId: 'target-1',
      dropCount: 0,
      reacquireMs: [],
    });
  });

  it('measures one drop followed by reacquisition', () => {
    expect(deriveTrackingTransitions(samples(true, false, false, true), 'target-1')).toEqual({
      targetId: 'target-1',
      dropCount: 1,
      reacquireMs: [20],
    });
  });

  it('counts a terminal drop but excludes it from reacquisition intervals', () => {
    expect(deriveTrackingTransitions(samples(true, false, false), 'target-1')).toEqual({
      targetId: 'target-1',
      dropCount: 1,
      reacquireMs: [],
    });
  });
});

function samples(...onTarget: boolean[]) {
  return onTarget.map((value, index) => ({ t: index * 10, onTarget: value, epsilonDeg: value ? 0 : 5 }));
}
