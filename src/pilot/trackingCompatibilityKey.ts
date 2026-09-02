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
 * axes (drill, protocol, motion, size, speed, FOV, sensitivity, input mode). This module follows the
 * same style — a pure `buildXxx`/`checkXxx` pair with `requireXxx` field validators — without
 * reusing its type or touching that file (its existing 7 callers must stay unaffected).
 */

export const TRACKING_PILOT_PROTOCOL_VERSION = 'tracking-pilot-v1';

export interface TrackingCompatibilityKey {
  readonly drillId: string;
  readonly protocolVersion: string;
  readonly motionKind: string;
  readonly sizeDeg: string;
  readonly speedDegPerSec: string;
  readonly fovDeg: number;
  readonly sensitivity: number;
  readonly inputMode: string;
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

  return {
    drillId,
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
    motionKind: trajectory.kind,
    sizeDeg: trajectory.sizeDeg,
    speedDegPerSec: trajectory.speedDegPerSec,
    fovDeg,
    sensitivity,
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
    a.sizeDeg === b.sizeDeg &&
    a.speedDegPerSec === b.speedDegPerSec &&
    a.fovDeg === b.fovDeg &&
    a.sensitivity === b.sensitivity &&
    a.inputMode === b.inputMode
  );
}

interface TrajectorySummary {
  readonly kind: string;
  readonly sizeDeg: string;
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
      sizeDeg: `${yawBoundDeg}x${pitchBoundDeg}`,
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
      sizeDeg: `${loDeg}..${hiDeg}`,
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
