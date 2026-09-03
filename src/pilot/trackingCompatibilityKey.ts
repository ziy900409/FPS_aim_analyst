import type { Meta } from '../data/metadata.ts';

/**
 * trackingCompatibilityKey — WP-54 / T4 (NFR-54-7).
 *
 * A WP-54-specific cohort-compatibility key. `src/metrics/compatibilityKey.ts`'s existing
 * `buildCompatibilityKey()` cannot be reused here: it hard-requires `meta.assessment`
 * (`buildCompatibilityKey` throws `"meta.assessment is required..."` when absent), and every
 * WP-54 pilot block is `mode: 'practice'` (T2 decision, see progress.md) — `main.ts` only attaches
 * `meta.assessment` when `activeDrillConfig.mode === 'assessment'` — so `meta.assessment` is always
 * `undefined` for a WP-54 export. Its field set is also a different axis set (participant/task/
 * weapon-mode/feedback-policy identity for formal Assessment cohorts) than NFR-54-7's tracking-pilot
 * axes (drill, protocol, motion, travel amplitude, speed, target size, FOV, sensitivity, input
 * mode, display refresh). This module follows the
 * same style — a pure `buildXxx`/`checkXxx` pair with `requireXxx` field validators — without
 * reusing its type or touching that file (its existing 7 callers must stay unaffected).
 */

export const TRACKING_PILOT_PROTOCOL_VERSION = 'tracking-pilot-v1';

export interface TrackingCompatibilityKey {
  readonly drillId: string;
  readonly protocolVersion: string;
  readonly motionKind: string;
  /**
   * The trajectory's **travel amplitude** (KI-020 renamed this from `sizeDeg`): after the
   * re-parameterization the trajectory bounds describe how far the target travels, not how big it
   * is. Target size lives in `targetHitboxWidthU` below.
   */
  readonly travelAmplitudeDeg: string;
  readonly speedDegPerSec: string;
  /**
   * Target angular size, carried as the hitbox edge in source units (KI-020 §4.1 made size a real
   * hitbox). `Meta` does not record the target distance, so this stays in source units rather than
   * degrees — within WP-54 every block shares the same 4u sightline, so it is a faithful size axis,
   * and `drillId` pins the exact condition regardless.
   */
  readonly targetHitboxWidthU: number;
  readonly fovDeg: number;
  readonly sensitivity: number;
  readonly inputMode: string;
  /**
   * Display refresh rate, rounded to whole Hz (OQ-54-11, researcher's decision 2026-09-03: 60 Hz
   * pilot data is acceptable, but refresh rate must separate cohorts). Rounded so a 59.98 vs 60.02
   * measurement never splits a cohort. Tracking measurement itself runs on the 128 Hz sim clock, but
   * what the participant *sees* — and therefore their achievable tracking error — depends on it.
   */
  readonly displayRefreshHz: number;
}

/**
 * Builds the compatibility key for one export's condition. Throws on any missing/malformed
 * required field (fail-fast, same discipline as `trackingTrajectory.ts`'s unknown-`kind` guard) —
 * a WP-54 export with an unrecognized or missing `trackingTrajectory` cannot be placed in any cohort.
 */
export function buildTrackingCompatibilityKey(meta: Meta): TrackingCompatibilityKey {
  const drillId = requireTrimmedNonEmptyString(meta.drillId, 'meta.drillId');
  const trajectory = requireTrackingTrajectorySummary(meta.spawn?.trackingTrajectory);
  const fovDeg = requirePositiveFiniteNumber(meta.fovDeg, 'meta.fovDeg');
  const sensitivity = requirePositiveFiniteNumber(meta.sensitivity, 'meta.sensitivity');
  const targetHitboxWidthU = requirePositiveFiniteNumber(
    meta.targets?.hitbox?.widthU,
    'meta.targets.hitbox.widthU',
  );
  const displayRefreshHz = Math.round(requirePositiveFiniteNumber(meta.displayHz, 'meta.displayHz'));

  return {
    drillId,
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
    motionKind: trajectory.kind,
    travelAmplitudeDeg: trajectory.travelAmplitudeDeg,
    speedDegPerSec: trajectory.speedDegPerSec,
    targetHitboxWidthU,
    fovDeg,
    sensitivity,
    displayRefreshHz,
    // "Input mode" is read as the mouse-input derivation model (KI-005 tick-window integration vs.
    // a legacy/missing export that would force the aim-difference fallback) — the only axis in
    // `Meta` that genuinely describes *how input was captured*, distinct from sensitivity/FOV. This
    // is a judgment call (NFR-54-7 does not spell out the field further); see progress.md Open
    // Questions for the alternative readings considered.
    inputMode: meta.mouseIntegration?.model ?? 'aim-diff-legacy',
  };
}

/** Field-by-field equality — a pilot run cohort/comparison must never mix two incompatible keys. */
export function checkTrackingCompatibility(a: TrackingCompatibilityKey, b: TrackingCompatibilityKey): boolean {
  return (
    a.drillId === b.drillId &&
    a.protocolVersion === b.protocolVersion &&
    a.motionKind === b.motionKind &&
    a.travelAmplitudeDeg === b.travelAmplitudeDeg &&
    a.speedDegPerSec === b.speedDegPerSec &&
    a.targetHitboxWidthU === b.targetHitboxWidthU &&
    a.fovDeg === b.fovDeg &&
    a.sensitivity === b.sensitivity &&
    a.inputMode === b.inputMode &&
    a.displayRefreshHz === b.displayRefreshHz
  );
}

interface TrajectorySummary {
  readonly kind: string;
  readonly travelAmplitudeDeg: string;
  readonly speedDegPerSec: string;
}

function requireTrackingTrajectorySummary(value: unknown): TrajectorySummary {
  if (typeof value !== 'object' || value === null) {
    throw new Error('meta.spawn.trackingTrajectory is required for a tracking compatibility key');
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;

  if (kind === 'band-limited-2d-v1') {
    const yawBoundDeg = requirePositiveFiniteNumber(record.yawBoundDeg, 'trackingTrajectory.yawBoundDeg');
    const pitchBoundDeg = requirePositiveFiniteNumber(record.pitchBoundDeg, 'trackingTrajectory.pitchBoundDeg');
    const targetRmsSpeedDegPerSec = requirePositiveFiniteNumber(
      record.targetRmsSpeedDegPerSec,
      'trackingTrajectory.targetRmsSpeedDegPerSec',
    );
    return {
      kind,
      travelAmplitudeDeg: `${yawBoundDeg}x${pitchBoundDeg}`,
      speedDegPerSec: `${targetRmsSpeedDegPerSec}`,
    };
  }

  if (kind === 'reversal-2d-v1') {
    const [loDeg, hiDeg] = requireAscendingRange(record.angularBoundsDeg, 'trackingTrajectory.angularBoundsDeg');
    const [loSpeed, hiSpeed] = requireAscendingRange(
      record.speedRangeDegPerSec,
      'trackingTrajectory.speedRangeDegPerSec',
    );
    return {
      kind,
      travelAmplitudeDeg: `${loDeg}..${hiDeg}`,
      speedDegPerSec: `${loSpeed}..${hiSpeed}`,
    };
  }

  throw new Error(`meta.spawn.trackingTrajectory.kind "${String(kind)}" is not recognized`);
}

function requireAscendingRange(value: unknown, name: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${name} must be a [min, max] pair`);
  const [lo, hi] = value;
  if (typeof lo !== 'number' || !Number.isFinite(lo) || typeof hi !== 'number' || !Number.isFinite(hi)) {
    throw new Error(`${name} must contain two finite numbers`);
  }
  if (!(lo < hi)) throw new Error(`${name} must be strictly ascending`);
  return [lo, hi];
}

function requireTrimmedNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a non-empty string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${name} must be a non-empty string`);
  return trimmed;
}

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}
