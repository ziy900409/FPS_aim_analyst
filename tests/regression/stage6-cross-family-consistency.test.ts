import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';

const holdClick: DrillEvent[] = [{ type: 'visible', targetId: 'h', side: 'L', t: 10 }, { type: 'fire', t: 20, hit: true, firstShot: true, residualSpeed: 0 }];
const holdTrack: DrillEvent[] = [{ type: 'visible', targetId: 't', side: 'R', t: 10 }, { type: 'target_stop', targetId: 't', t: 20, targetX: 1, targetY: 2, targetZ: 3 }];
const spiderShot: DrillEvent[] = [{ type: 'visible', targetId: 's', side: 'L', zone: 'center', t: 10 }, { type: 'visible', targetId: 's2', side: 'R', zone: 'peripheral', t: 20 }];
const counterstrafe: DrillEvent[] = [{ type: 'cue', t: 5, direction: 'A' }, { type: 'visible', targetId: 'c', side: 'L', t: 10 }, { type: 'counter', key: 'A', t: 15 }, { type: 'fire', t: 20, hit: true, firstShot: true, residualSpeed: 0 }];

describe('stage6 cross-family event contract', () => {
  it('uses one timestamp shape for shared visible and fire events', () => {
    for (const events of [holdClick, holdTrack, spiderShot, counterstrafe]) {
      for (const event of events.filter((event) => event.type === 'visible' || event.type === 'fire')) expect(Number.isFinite(event.t)).toBe(true);
    }
  });

  it('keeps family-specific event variants out of unrelated exports', () => {
    expect(holdClick.some((event) => event.type === 'cue' || event.type === 'target_stop')).toBe(false);
    expect(holdTrack.some((event) => event.type === 'cue' || event.type === 'fire')).toBe(false);
    expect(spiderShot.some((event) => event.type === 'cue' || event.type === 'target_stop')).toBe(false);
    expect(counterstrafe.some((event) => event.type === 'target_stop')).toBe(false);
    expect(spiderShot.filter((event) => event.type === 'visible').every((event) => event.zone !== undefined)).toBe(true);
  });
});
