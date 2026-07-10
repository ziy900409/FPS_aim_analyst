import { describe, expect, it } from 'vitest';
import {
  canonicalLongrangeFrames,
  EXPECTED_LONGRANGE_TICKS,
  longrangeFrameSequences,
  runLongrangeTracking,
} from './longrangeTrackingDeterminismFixture.ts';

const CANON = runLongrangeTracking(canonicalLongrangeFrames());

describe('WP-23 T3 - tracking_longrange_v1 cross-FPS determinism', () => {
  it('canonical run covers longrange small target motion and timed presentations', () => {
    expect(CANON.ticks).toBe(EXPECTED_LONGRANGE_TICKS);
    expect(CANON.phase).toBe('running');
    expect(CANON.snapshot.recorderOverflow).toBe(false);
    expect(CANON.visibleCount).toBeGreaterThanOrEqual(3);
    expect(CANON.distinctTx).toBeGreaterThan(1);
    expect(CANON.firstTargetRadialDistance).toBeGreaterThan(110);
  });

  for (const [name, abs] of Object.entries(longrangeFrameSequences)) {
    it(`${name}: DataRecorder snapshot is bit-exact with canonical`, () => {
      const run = runLongrangeTracking(abs);

      expect(run.ticks).toBe(EXPECTED_LONGRANGE_TICKS);
      expect(run.phase).toBe(CANON.phase);
      expect(run.snapshot).toEqual(CANON.snapshot);
    });
  }

  it('replaying the same jittered input sequence produces an identical snapshot', () => {
    const seq = longrangeFrameSequences['jitter 144 Hz +/-50%'];
    const a = runLongrangeTracking(seq);
    const b = runLongrangeTracking(seq);

    expect(a.snapshot).toEqual(b.snapshot);
  });
});
