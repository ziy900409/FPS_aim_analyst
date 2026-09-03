/**
 * WP-54 / T7 — what angular size and speed did this payload actually deliver **to the eye**?
 *
 * KI-024's root cause was that every stimulus-side check measured angles about the *trajectory
 * origin* (the world point the target orbits), while ε(t) and `computeSignedOmegaSeries()` measure
 * them from the *eye*. `field-low` put the eye 4 u behind the world origin, so the two frames
 * differed by 2x and the pilot delivered half of every angle it claimed — for three Gate A rounds,
 * undetected, because the acceptance band was computed in the wrong frame.
 *
 * `field-low` is fixed (BD-024, `eyeZ: 0`), which makes the two frames coincide. This module is the
 * standing guard that they still do: it measures from the **recorded target positions** and the
 * payload's **own** `meta.scene.eye`, so a payload recorded in any future mis-anchored scene is
 * caught from the data rather than from the config it claims.
 *
 * Not a second definition of target angular speed (C-D4): the bearing math here is the same as
 * `trackingDynamics`'s private `targetAnglesDeg()`, over the same eye origin
 * (`resolveEyeOrigin()`), and the nominal it compares against is the trajectory config's own
 * `targetRmsSpeedDegPerSec`. It re-frames an existing quantity; it does not invent one.
 */
import type { ExportPayload } from '../src/data/export.ts';
import { eyeOriginForTick, resolveEyeOrigin } from '../src/metrics/eyeOrigin.ts';

const RAD_TO_DEG = 180 / Math.PI;
/** Below this the payload has too little telemetry to state a delivered speed. */
const MIN_TICKS = 32;

export interface TrackingDeliveredAnglesResult {
  readonly status: 'ok' | 'no-trajectory-config' | 'insufficient-target-samples';
  /** Eye-relative RMS 2D angular speed over the recorded window (deg/s). */
  readonly rmsSpeedDegPerSec: number;
  /** The config's claim, for the ratio. `NaN` for `reversal-2d-v1` (a range, not a set-point). */
  readonly nominalSpeedDegPerSec: number;
  /** `delivered / nominal`. `NaN` when there is no single nominal to divide by. */
  readonly speedRatio: number;
  /** Angular size the hitbox subtends at the measured engagement distance (deg). */
  readonly angularSizeDeg: number;
  /** Mean |target − eye| across the window — the *actual* engagement distance. */
  readonly eyeDistanceU: number;
  readonly tickCount: number;
}

const NOT_MEASURED = {
  rmsSpeedDegPerSec: Number.NaN,
  nominalSpeedDegPerSec: Number.NaN,
  speedRatio: Number.NaN,
  angularSizeDeg: Number.NaN,
  eyeDistanceU: Number.NaN,
  tickCount: 0,
} as const;

export function measureTrackingDeliveredAngles(payload: ExportPayload): TrackingDeliveredAnglesResult {
  const config = payload.meta.spawn?.trackingTrajectory as
    | { readonly kind?: string; readonly targetRmsSpeedDegPerSec?: number }
    | undefined;
  if (config === undefined) return { status: 'no-trajectory-config', ...NOT_MEASURED };

  const eyeOrigin = resolveEyeOrigin(payload);
  const ticks = payload.ticks
    .slice()
    .sort((a, b) => a.t - b.t)
    .filter((tick) => tick.tx !== null && tick.ty !== null && tick.tz !== null);
  if (ticks.length < MIN_TICKS) return { status: 'insufficient-target-samples', ...NOT_MEASURED };

  const bearings: { yawDeg: number; pitchDeg: number; tMs: number }[] = [];
  let sumDistance = 0;
  for (const tick of ticks) {
    const eye = eyeOriginForTick(tick, eyeOrigin);
    const dx = tick.tx! - eye.x;
    const dy = tick.ty! - eye.y;
    const dz = tick.tz! - eye.z;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) continue;
    sumDistance += len;
    bearings.push({
      tMs: tick.t,
      yawDeg: Math.atan2(-dx, -dz) * RAD_TO_DEG,
      pitchDeg: Math.asin(dy / len) * RAD_TO_DEG,
    });
  }
  if (bearings.length < MIN_TICKS) return { status: 'insufficient-target-samples', ...NOT_MEASURED };

  let sumSquares = 0;
  let intervals = 0;
  for (let i = 1; i < bearings.length; i++) {
    const dtSec = (bearings[i].tMs - bearings[i - 1].tMs) / 1000;
    if (dtSec <= 0) continue;
    const yawOmega = wrapDeltaDeg(bearings[i].yawDeg - bearings[i - 1].yawDeg) / dtSec;
    const pitchOmega = (bearings[i].pitchDeg - bearings[i - 1].pitchDeg) / dtSec;
    // The prep window holds the trajectory frozen at age 0, so those intervals are exactly zero on
    // both axes and would drag the RMS down. Dropping exact zeroes excludes them without needing to
    // locate `scored_start`; genuine motion never lands on exactly 0.0 on both axes at once.
    if (yawOmega === 0 && pitchOmega === 0) continue;
    sumSquares += yawOmega * yawOmega + pitchOmega * pitchOmega;
    intervals += 1;
  }
  if (intervals < MIN_TICKS) return { status: 'insufficient-target-samples', ...NOT_MEASURED };

  const eyeDistanceU = sumDistance / bearings.length;
  const widthU = payload.meta.targets?.hitbox?.widthU;
  const nominalSpeedDegPerSec =
    config.kind === 'band-limited-2d-v1' && typeof config.targetRmsSpeedDegPerSec === 'number'
      ? config.targetRmsSpeedDegPerSec
      : Number.NaN;
  const rmsSpeedDegPerSec = Math.sqrt(sumSquares / intervals);

  return {
    status: 'ok',
    rmsSpeedDegPerSec,
    nominalSpeedDegPerSec,
    speedRatio: rmsSpeedDegPerSec / nominalSpeedDegPerSec,
    angularSizeDeg:
      widthU === undefined ? Number.NaN : 2 * RAD_TO_DEG * Math.atan(widthU / 2 / eyeDistanceU),
    eyeDistanceU,
    tickCount: bearings.length,
  };
}

function wrapDeltaDeg(delta: number): number {
  let out = delta % 360;
  if (out > 180) out -= 360;
  if (out < -180) out += 360;
  return out;
}

/** One-line console rendering for the analysis runner's per-run block. */
export function formatTrackingDeliveredAngles(result: TrackingDeliveredAnglesResult): string {
  if (result.status !== 'ok') return `atEye=${result.status}`;
  const speed = Number.isNaN(result.speedRatio)
    ? `rmsSpeed=${result.rmsSpeedDegPerSec.toFixed(2)}deg/s`
    : `rmsSpeed=${result.rmsSpeedDegPerSec.toFixed(2)}/${result.nominalSpeedDegPerSec}deg/s ` +
      `(${(100 * result.speedRatio).toFixed(0)}% of nominal)`;
  const size = Number.isNaN(result.angularSizeDeg) ? '' : ` size=${result.angularSizeDeg.toFixed(3)}deg`;
  return `atEye dist=${result.eyeDistanceU.toFixed(2)}u ${speed}${size} ticks=${result.tickCount}`;
}
