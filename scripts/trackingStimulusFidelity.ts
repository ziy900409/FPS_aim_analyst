/**
 * WP-54 / T6 — was a pilot payload recorded by the *current* stimulus code?
 *
 * Split out of `analyze-tracking-pilot.ts` for the same reason as `trackingPilotSummary.ts`: the
 * script runs `main()` on import and needs a directory of participant exports, so its logic is
 * only testable from a separate module.
 *
 * The runner's `stimulusCheck()` reconstructs the trajectory from `meta.spawn.trackingTrajectory`
 * with today's `createTrackingTrajectory()` and measures *that*. Metadata cannot distinguish
 * stimulus generations — `targetRmsSpeedDegPerSec` is the same 5 / 20 before and after KI-023 —
 * and `band-limited-2d-v1` emits no `target_motion_change` events for the recorded-vs-scheduled
 * cross-check that saves the reversal family. So a recording made by pre-KI-023 code (per-axis
 * set-point ⇒ √2 too fast) reads as "100% of nominal".
 *
 * The recorded ticks carry the target's world position, written by the sim through
 * `projectTrackingAngles()`. Re-projecting the reconstruction through the same function and
 * differencing closes the hole (gate §12.3, D-54.43). This asks only "is the recorded curve the
 * reconstructed curve" — it is not a second definition of delivered speed (C-D4); that stays the
 * trajectory's own `hypot(yawVelocityDegPerSec, pitchVelocityDegPerSec)`.
 */
import type { ExportPayload } from '../src/data/export.ts';
import {
  createTrackingTrajectory,
  projectTrackingAngles,
  type TrackingProjectionOrigin,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from '../src/sim/trackingTrajectory.ts';

/** Float-noise headroom: an actual generation mismatch is centimetres, agreement is ~1e-15 u. */
const DEFAULT_TOLERANCE_U = 1e-9;
/** Ticks compared while searching for the alignment; long enough to be unambiguous. */
const PROBE_TICKS = 400;
/** The recording's target samples start after spawn + prep; 1024 ticks (8 s) is ample slack. */
const MAX_RECORD_TICK_OFFSET = 1024;
/** A block without a prep window starts one trajectory tick in (observed on `practice`). */
const MAX_TRAJECTORY_TICK_OFFSET = 2;

export interface TrackingStimulusFidelityResult {
  readonly status: 'match' | 'mismatch' | 'no-trajectory-config' | 'no-target-samples';
  /** Ticks actually differenced at the chosen alignment. */
  readonly comparedTicks: number;
  readonly maxPositionErrorU: number;
  /** Sightline geometry recovered from the payload — not assumed, so a changed drill shows up. */
  readonly sightline: TrackingProjectionOrigin | null;
  /** Index into the recording's target-bearing ticks where the scored window begins. */
  readonly recordTickOffset: number;
  /** Trajectory tick the recording's first compared sample corresponds to. */
  readonly trajectoryTickOffset: number;
}

interface TargetSample {
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
}

/**
 * Recovers `(distanceU, centerY)` from a single recorded sample paired with the angles the
 * reconstruction claims for it — the exact inverse of `projectTrackingAngles()`.
 *
 * Deliberately solved from ONE tick rather than fitted across many: a free scale parameter would
 * absorb much of a small-angle amplitude error, which is the very defect being hunted. Every other
 * tick then either agrees to float noise or does not.
 */
function recoverSightline(
  sample: TargetSample,
  yawDeg: number,
  pitchDeg: number,
): TrackingProjectionOrigin | null {
  const degToRad = Math.PI / 180;
  const cosPitch = Math.cos(pitchDeg * degToRad);
  const cosYaw = Math.cos(yawDeg * degToRad);
  const denominator = cosPitch * cosYaw;
  if (Math.abs(denominator) < 1e-6) return null;
  const distanceU = -sample.tz / denominator;
  if (!Number.isFinite(distanceU) || distanceU <= 0) return null;
  const centerY = sample.ty - distanceU * Math.sin(pitchDeg * degToRad);
  if (!Number.isFinite(centerY)) return null;
  return { distanceU, centerY };
}

export function checkTrackingStimulusFidelity(
  payload: ExportPayload,
  options: { readonly toleranceU?: number } = {},
): TrackingStimulusFidelityResult {
  const toleranceU = options.toleranceU ?? DEFAULT_TOLERANCE_U;
  const empty = {
    comparedTicks: 0,
    maxPositionErrorU: Number.NaN,
    sightline: null,
    recordTickOffset: -1,
    trajectoryTickOffset: -1,
  } as const;

  const config = payload.meta.spawn?.trackingTrajectory as TrackingTrajectoryConfig | undefined;
  if (config === undefined) return { status: 'no-trajectory-config', ...empty };

  const samples: TargetSample[] = [];
  for (const tick of payload.ticks) {
    if (tick.tx === null || tick.ty === null || tick.tz === null) continue;
    samples.push({ tx: tick.tx, ty: tick.ty, tz: tick.tz });
  }
  if (samples.length === 0) return { status: 'no-target-samples', ...empty };

  // Reconstruct the scored window's angles on the sim grid.
  const simHz = payload.meta.simHz;
  const trajectory = createTrackingTrajectory(config);
  const out: TrackingTrajectorySample = {
    yawDeg: 0,
    pitchDeg: 0,
    yawVelocityDegPerSec: 0,
    pitchVelocityDegPerSec: 0,
  };
  const tickCount = Math.round((config.durationMs / 1000) * simHz);
  const angles: { yawDeg: number; pitchDeg: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    trajectory.sample(i / simHz, out);
    angles.push({ yawDeg: out.yawDeg, pitchDeg: out.pitchDeg });
  }

  const projected = { x: 0, y: 0, z: 0 };
  const errorAt = (
    recordOffset: number,
    trajectoryOffset: number,
    sightline: TrackingProjectionOrigin,
    limit: number,
  ): { maxErrorU: number; comparedTicks: number } => {
    let maxErrorU = 0;
    let comparedTicks = 0;
    for (let i = 0; i < limit; i++) {
      const sample = samples[recordOffset + i];
      const angle = angles[trajectoryOffset + i];
      if (sample === undefined || angle === undefined) break;
      projectTrackingAngles(angle.yawDeg, angle.pitchDeg, sightline, projected);
      maxErrorU = Math.max(
        maxErrorU,
        Math.abs(sample.tx - projected.x),
        Math.abs(sample.ty - projected.y),
        Math.abs(sample.tz - projected.z),
      );
      comparedTicks += 1;
    }
    return { maxErrorU, comparedTicks };
  };

  // Search the alignment: the recording's target samples begin after the prep window (during which
  // the trajectory is frozen at age 0), and a block without a prep window starts one tick in.
  let best: {
    recordOffset: number;
    trajectoryOffset: number;
    sightline: TrackingProjectionOrigin;
    maxErrorU: number;
  } | null = null;
  const maxRecordOffset = Math.min(samples.length - 1, MAX_RECORD_TICK_OFFSET);
  for (let recordOffset = 0; recordOffset <= maxRecordOffset; recordOffset++) {
    for (let trajectoryOffset = 0; trajectoryOffset <= MAX_TRAJECTORY_TICK_OFFSET; trajectoryOffset++) {
      const angle = angles[trajectoryOffset];
      if (angle === undefined) continue;
      const sightline = recoverSightline(samples[recordOffset]!, angle.yawDeg, angle.pitchDeg);
      if (sightline === null) continue;
      const { maxErrorU } = errorAt(recordOffset, trajectoryOffset, sightline, PROBE_TICKS);
      if (best === null || maxErrorU < best.maxErrorU) {
        best = { recordOffset, trajectoryOffset, sightline, maxErrorU };
      }
    }
    if (best !== null && best.maxErrorU <= toleranceU) break;
  }
  if (best === null) return { status: 'no-target-samples', ...empty };

  const full = errorAt(best.recordOffset, best.trajectoryOffset, best.sightline, angles.length);
  return {
    status: full.maxErrorU <= toleranceU ? 'match' : 'mismatch',
    comparedTicks: full.comparedTicks,
    maxPositionErrorU: full.maxErrorU,
    sightline: best.sightline,
    recordTickOffset: best.recordOffset,
    trajectoryTickOffset: best.trajectoryOffset,
  };
}

/** One-line console rendering for the analysis runner's per-run block. */
export function formatTrackingStimulusFidelity(result: TrackingStimulusFidelityResult): string {
  if (result.status === 'no-trajectory-config' || result.status === 'no-target-samples') {
    return `fidelity=${result.status}`;
  }
  const sightline =
    result.sightline === null
      ? ''
      : ` sightline=${result.sightline.distanceU.toFixed(3)}u/y${result.sightline.centerY.toFixed(3)}`;
  return (
    `fidelity=${result.status} maxPosErr=${result.maxPositionErrorU.toExponential(2)}u ` +
    `ticks=${result.comparedTicks}${sightline}`
  );
}
