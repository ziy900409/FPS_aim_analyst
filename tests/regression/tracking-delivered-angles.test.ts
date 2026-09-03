/**
 * WP-54 / T7 — KI-024 standing guard in the analysis layer.
 *
 * The defect: every stimulus-side check measured angles about the trajectory origin, while ε(t) and
 * the P1 dynamics measure them from the eye. `field-low` put the eye 4 u behind the world origin,
 * so the pilot delivered exactly half of every angle it claimed and three Gate A rounds passed the
 * speed acceptance band anyway.
 *
 * `measureTrackingDeliveredAngles()` measures from the recorded target positions and the payload's
 * own `meta.scene.eye`, so the mis-anchored case is caught from the data. The decisive fixture
 * below is the pair whose *metadata and trajectory config are identical* — only `scene.eye` moves.
 */
import { describe, expect, it } from 'vitest';
import { measureTrackingDeliveredAngles } from '../../scripts/trackingDeliveredAngles.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  createTrackingTrajectory,
  projectTrackingAngles,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from '../../src/sim/trackingTrajectory.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';

const SIM_HZ = 128;
const NOMINAL_SPEED = 5;
const TRAJ_DISTANCE_U = 4;
const CENTER_Y = 1.5;
const PREP_TICKS = 64;

const CONFIG: TrackingTrajectoryConfig = {
  kind: 'band-limited-2d-v1',
  seed: 54010,
  durationMs: 8000, // long enough for the RMS to settle on the 0.3 Hz band
  yawBoundDeg: 16,
  pitchBoundDeg: 16,
  targetRmsSpeedDegPerSec: NOMINAL_SPEED,
  frequencyBandHz: [0.3, 2.1],
};

/** Hitbox subtending 2.0 deg at `TRAJ_DISTANCE_U` — the config's own conversion. */
const HITBOX_WIDTH_U = 2 * TRAJ_DISTANCE_U * Math.tan((2.0 / 2) * (Math.PI / 180));

function recordTicks(): TickRecord[] {
  const trajectory = createTrackingTrajectory(CONFIG);
  const sample: TrackingTrajectorySample = {
    yawDeg: 0,
    pitchDeg: 0,
    yawVelocityDegPerSec: 0,
    pitchVelocityDegPerSec: 0,
  };
  const pos = { x: 0, y: 0, z: 0 };
  const ticks: TickRecord[] = [];
  const push = (ageSec: number, index: number): void => {
    trajectory.sample(ageSec, sample);
    projectTrackingAngles(sample.yawDeg, sample.pitchDeg, { distanceU: TRAJ_DISTANCE_U, centerY: CENTER_Y }, pos);
    ticks.push(makeTick({ t: 1000 + index * (1000 / SIM_HZ), tx: pos.x, ty: pos.y, tz: pos.z }));
  };
  // Frozen prep window, then the scored window.
  for (let i = 0; i < PREP_TICKS; i++) push(0, i);
  const scoredTicks = Math.round((CONFIG.durationMs / 1000) * SIM_HZ);
  for (let i = 0; i < scoredTicks; i++) push(i / SIM_HZ, PREP_TICKS + i);
  return ticks;
}

/** Identical stimulus and metadata; only where the player's eye sits differs. */
function payloadWithEyeZ(eyeZ: number) {
  return makePayload({
    meta: {
      drillId: 'tracking_core_pr_pilot_v1_2deg_5dps',
      simHz: SIM_HZ,
      simToWorld: 1,
      spawn: { seed: 1, presentationMs: 30000, trackingTrajectory: CONFIG },
      targets: { hitbox: { widthU: HITBOX_WIDTH_U, heightU: HITBOX_WIDTH_U, depthU: HITBOX_WIDTH_U, shape: 'sphere' } },
      scene: {
        sceneId: 'field-low',
        assetPackVersion: 'field-low-v1',
        clutterTier: 'low',
        fallback: false,
        eye: { x: 0, y: 1.6, z: eyeZ },
      },
    },
    ticks: recordTicks(),
  });
}

describe('measureTrackingDeliveredAngles (KI-024)', () => {
  it('reports the nominal speed and size when the eye is anchored at the sim origin (eyeZ:0)', () => {
    const result = measureTrackingDeliveredAngles(payloadWithEyeZ(0));

    expect(result.status).toBe('ok');
    // The engagement distance is the config distance, so config angles are the angles at the eye.
    expect(result.eyeDistanceU).toBeCloseTo(TRAJ_DISTANCE_U, 1);
    expect(result.speedRatio).toBeGreaterThan(0.95);
    expect(result.speedRatio).toBeLessThan(1.05);
    expect(result.angularSizeDeg).toBeCloseTo(2.0, 1);
  });

  it('catches the mis-anchored eye that halved every delivered angle for three Gate A rounds', () => {
    // Byte-identical trajectory config and hitbox to the passing case — the ONLY difference is
    // `scene.eye.z`. This is the payload shape P01–P05 actually had.
    const result = measureTrackingDeliveredAngles(payloadWithEyeZ(4));

    expect(result.status).toBe('ok');
    expect(result.eyeDistanceU).toBeCloseTo(8, 1);
    // Half of nominal, the figure measured across all 9 blocks of P04 (0.499–0.508).
    expect(result.speedRatio).toBeGreaterThan(0.48);
    expect(result.speedRatio).toBeLessThan(0.52);
    // And the "2.0 deg" target is really 1.0 deg — why "0.5 deg" was reported as invisible.
    expect(result.angularSizeDeg).toBeCloseTo(1.0, 1);
  });

  it('reports a reason instead of a number when it cannot measure', () => {
    const noConfig = makePayload({ meta: { simHz: SIM_HZ }, ticks: recordTicks() });
    expect(measureTrackingDeliveredAngles(noConfig).status).toBe('no-trajectory-config');

    const barelyAnyTicks = makePayload({
      meta: { simHz: SIM_HZ, spawn: { seed: 1, presentationMs: 30000, trackingTrajectory: CONFIG } },
      ticks: recordTicks().slice(0, 10),
    });
    expect(measureTrackingDeliveredAngles(barelyAnyTicks).status).toBe('insufficient-target-samples');
  });

  it('does not divide by a range: reversal configs report a speed but no ratio', () => {
    const reversal = makePayload({
      meta: {
        simHz: SIM_HZ,
        simToWorld: 1,
        spawn: {
          seed: 1,
          presentationMs: 30000,
          trackingTrajectory: {
            kind: 'reversal-2d-v1',
            seed: 54100,
            durationMs: 8000,
            angularBoundsDeg: [-13, 13],
            speedRangeDegPerSec: [5, 20],
            reversalIntervalMs: [400, 900],
            accelerationRampMs: 120,
          },
        },
        scene: { sceneId: 'field-low', assetPackVersion: 'field-low-v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 0 } },
      },
      ticks: recordTicks(),
    });

    const result = measureTrackingDeliveredAngles(reversal);
    expect(result.status).toBe('ok');
    expect(result.rmsSpeedDegPerSec).toBeGreaterThan(0);
    expect(result.speedRatio).toBeNaN();
  });
});
