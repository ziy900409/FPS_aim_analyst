/**
 * WP-54 / T6 — the analysis runner must be able to tell whether a pilot payload was recorded by
 * the *current* stimulus code, not just whether the current code reconstructs a well-formed
 * stimulus from that payload's metadata.
 *
 * Why this exists (gate §12.3 / D-54.43): `analyze-tracking-pilot.ts`'s `stimulusCheck()` rebuilds
 * the trajectory from `meta.spawn.trackingTrajectory` with today's `createTrackingTrajectory()` and
 * then measures that reconstruction. `targetRmsSpeedDegPerSec` is the same number (5 / 20) before
 * and after KI-023, so metadata alone cannot distinguish the generations. For `reversal-2d-v1` the
 * recorded `target_motion_change` events cross-check the reconstruction, but `band-limited-2d-v1`
 * emits no such events — so a payload recorded by pre-KI-023 code (per-axis set-point, √2 too fast)
 * would be reported as "100% of nominal" by the runner and silently pass Gate A's speed band.
 *
 * The recorded ticks carry the target's world position, which the sim wrote through
 * `projectTrackingAngles()`. Comparing that against the same projection of the reconstruction
 * closes the hole. This is a curve-identity check, not a second definition of delivered speed
 * (C-D4): the authoritative delivered-speed figure stays the trajectory's own
 * `hypot(yawVelocityDegPerSec, pitchVelocityDegPerSec)`.
 */
import { describe, expect, it } from 'vitest';
import { checkTrackingStimulusFidelity } from '../../scripts/trackingStimulusFidelity.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  createTrackingTrajectory,
  projectTrackingAngles,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from '../../src/sim/trackingTrajectory.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';

const SIM_HZ = 128;
const SIGHTLINE = { distanceU: 4, centerY: 1.5 } as const;

// A short band-limited cell: same family and bounds as the pilot's `2deg_5dps`, 2 s so the fixture
// stays small. `band-limited-2d-v1` emits no `target_motion_change` events, which is exactly the
// case the runner could not previously verify.
const CONFIG: TrackingTrajectoryConfig = {
  kind: 'band-limited-2d-v1',
  seed: 54010,
  durationMs: 2000,
  yawBoundDeg: 16,
  pitchBoundDeg: 16,
  targetRmsSpeedDegPerSec: 5,
  frequencyBandHz: [0.3, 2.1],
};

/**
 * Builds the tick stream a real block produces: a few ticks with no target, then a frozen prep
 * window (trajectory held at age 0), then the scored window. `angleScale` distorts both axes by a
 * constant factor — `Math.SQRT2` reproduces the pre-KI-023 (per-axis set-point) amplitude.
 */
function recordTicks(options: {
  readonly leadingNullTicks?: number;
  readonly prepTicks?: number;
  readonly trajectoryStartTick?: number;
  readonly angleScale?: number;
}): TickRecord[] {
  const leadingNullTicks = options.leadingNullTicks ?? 3;
  const prepTicks = options.prepTicks ?? 0;
  const trajectoryStartTick = options.trajectoryStartTick ?? 0;
  const angleScale = options.angleScale ?? 1;

  const trajectory = createTrackingTrajectory(CONFIG);
  const sample: TrackingTrajectorySample = {
    yawDeg: 0,
    pitchDeg: 0,
    yawVelocityDegPerSec: 0,
    pitchVelocityDegPerSec: 0,
  };
  const pos = { x: 0, y: 0, z: 0 };
  const ticks: TickRecord[] = [];
  let t = 1000;

  for (let i = 0; i < leadingNullTicks; i++) {
    ticks.push(makeTick({ t }));
    t += 1000 / SIM_HZ;
  }
  const push = (ageSec: number): void => {
    trajectory.sample(ageSec, sample);
    projectTrackingAngles(sample.yawDeg * angleScale, sample.pitchDeg * angleScale, SIGHTLINE, pos);
    ticks.push(makeTick({ t, tx: pos.x, ty: pos.y, tz: pos.z }));
    t += 1000 / SIM_HZ;
  };
  // Prep window: the sim holds the trajectory at age 0 while the player centres their aim.
  for (let i = 0; i < prepTicks; i++) push(0);
  const scoredTicks = Math.round((CONFIG.durationMs / 1000) * SIM_HZ);
  for (let i = trajectoryStartTick; i < scoredTicks; i++) push(i / SIM_HZ);
  return ticks;
}

function payloadFor(ticks: readonly TickRecord[], config: TrackingTrajectoryConfig | undefined) {
  return makePayload({
    meta: {
      drillId: 'tracking_core_pr_pilot_v1_2deg_5dps',
      simHz: SIM_HZ,
      spawn: config === undefined ? undefined : { seed: 1, presentationMs: 30000, trackingTrajectory: config },
    },
    ticks,
  });
}

describe('checkTrackingStimulusFidelity', () => {
  it('recognises a recording made by the current stimulus code', () => {
    const result = checkTrackingStimulusFidelity(payloadFor(recordTicks({ prepTicks: 128 }), CONFIG));

    expect(result.status).toBe('match');
    expect(result.comparedTicks).toBe(256); // the full 2 s scored window at 128 Hz
    expect(result.maxPositionErrorU).toBeLessThan(1e-12);
    // Recovered from the payload itself, so a changed sightline shows up instead of being assumed.
    expect(result.sightline?.distanceU).toBeCloseTo(SIGHTLINE.distanceU, 9);
    expect(result.sightline?.centerY).toBeCloseTo(SIGHTLINE.centerY, 9);
    // Indexes the target-bearing ticks, so the 3 leading target-less ticks are not counted: the
    // offset is exactly the frozen prep window.
    expect(result.recordTickOffset).toBe(128);
    expect(result.trajectoryTickOffset).toBe(0);
  });

  it('flags a pre-KI-023 (per-axis set-point) recording that metadata alone cannot distinguish', () => {
    // The payload's metadata is byte-identical to the passing case — only the recorded positions
    // carry the √2 amplitude of the per-axis semantics. This is the KI-023 class of defect.
    const result = checkTrackingStimulusFidelity(
      payloadFor(recordTicks({ prepTicks: 128, angleScale: Math.SQRT2 }), CONFIG),
    );

    expect(result.status).toBe('mismatch');
    // Far above float noise: a whole-degree divergence at a 4 u sightline is centimetres of travel.
    expect(result.maxPositionErrorU).toBeGreaterThan(0.01);
  });

  it('aligns a block whose recording starts one trajectory tick in (no prep window, e.g. practice)', () => {
    const result = checkTrackingStimulusFidelity(
      payloadFor(recordTicks({ prepTicks: 0, trajectoryStartTick: 1 }), CONFIG),
    );

    expect(result.status).toBe('match');
    expect(result.trajectoryTickOffset).toBe(1);
    expect(result.maxPositionErrorU).toBeLessThan(1e-12);
  });

  it('reports the reason instead of a verdict when it cannot compare', () => {
    expect(checkTrackingStimulusFidelity(payloadFor(recordTicks({}), undefined)).status).toBe(
      'no-trajectory-config',
    );
    expect(
      checkTrackingStimulusFidelity(payloadFor([makeTick({ t: 1000 }), makeTick({ t: 1008 })], CONFIG)).status,
    ).toBe('no-target-samples');
  });
});
