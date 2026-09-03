/**
 * WP-54 / T7 — the frozen-crosshair discriminability ratio (gate §12.8, OQ-54-14).
 *
 * Gate A round 3 showed the band-limited core matrix could not distinguish a participant who
 * tracks from one who does not move at all: freeze the crosshair at the participant's own median
 * aim, recompute ε(t), and the "did not move" RMS was only 1.05–1.25x the achieved RMS (vs
 * 2.08–3.26x for the reversal family). T7 uses that ratio as its re-parameterization target, so it
 * needs a definition guarded by tests rather than a one-off probe.
 *
 * These fixtures pin the arithmetic against analytically known answers, and — the part that
 * matters for C-D4 — pin `actualRmsEpsilonDeg` to the canonical P0 `rmsEpsilonDeg`. If the two
 * ever diverge, the ratio has stopped dividing the number the gate reports.
 */
import { describe, expect, it } from 'vitest';
import { computeTrackingFrozenCrosshairRatio } from '../../scripts/trackingFrozenCrosshairRatio.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const T0_MS = 1000;
const DISTANCE_U = 4;
/** `resolveEyeOrigin` falls back to this for a fixture without `meta.scene.eye` (`legacy-default`);
 * putting the target at the same height keeps every bearing at pitch 0, so ε is a pure yaw
 * difference and the expected ratios are exact. */
const EYE_Y = 1.6;
const PREP_TICKS = 64;
const SCORED_TICKS = 256; // 2 s at 128 Hz
const SWEEP_DEG = 2; // the target's yaw amplitude
const SWEEP_HZ = 0.5; // exactly one period across the scored window ⇒ median bearing is 0
const TARGET_ID = 't0';

const DEG = Math.PI / 180;

/** Target world position for a bearing of `yawDeg` from the eye, at pitch 0 — the inverse of
 * `aimForward()`'s convention, so ε(aim=yawDeg) is exactly 0. */
function targetAt(yawDeg: number): { x: number; y: number; z: number } {
  const yaw = yawDeg * DEG;
  return { x: -DISTANCE_U * Math.sin(yaw), y: EYE_Y, z: -DISTANCE_U * Math.cos(yaw) };
}

/** The target's bearing at scored tick `i`. */
function bearingDeg(i: number): number {
  return SWEEP_DEG * Math.sin(2 * Math.PI * SWEEP_HZ * (i / SIM_HZ));
}

/**
 * One block's tick stream: a prep window with the target frozen at centre and the aim resting on
 * it, then the scored window. `aimDeg(i, bearing)` is the participant model.
 *
 * The prep window is deliberately *on target*: without the `scored_start` adapter the canonical
 * window would start there and pull 64 extra ticks into every figure below.
 */
function buildTicks(aimDeg: (i: number, bearingDeg: number) => number): TickRecord[] {
  const ticks: TickRecord[] = [];
  const centre = targetAt(0);
  for (let i = 0; i < PREP_TICKS; i++) {
    ticks.push(makeTick({ t: T0_MS + i * TICK_MS, tx: centre.x, ty: centre.y, tz: centre.z, aim: { yaw: 0, pitch: 0 } }));
  }
  for (let i = 0; i < SCORED_TICKS; i++) {
    const bearing = bearingDeg(i);
    const target = targetAt(bearing);
    ticks.push(
      makeTick({
        t: T0_MS + (PREP_TICKS + i) * TICK_MS,
        tx: target.x,
        ty: target.y,
        tz: target.z,
        aim: { yaw: aimDeg(i, bearing) * DEG, pitch: 0 },
      }),
    );
  }
  return ticks;
}

function payloadFor(ticks: readonly TickRecord[], options: { readonly scoredStart?: boolean } = {}) {
  const centre = targetAt(0);
  const events: DrillEvent[] = [
    { type: 'visible', targetId: TARGET_ID, side: 'R', t: T0_MS, targetX: centre.x, targetY: centre.y, targetZ: centre.z },
  ];
  if (options.scoredStart !== false) {
    events.push({
      type: 'scored_start',
      targetId: TARGET_ID,
      t: T0_MS + PREP_TICKS * TICK_MS,
      targetX: centre.x,
      targetY: centre.y,
      targetZ: centre.z,
    });
  }
  return makePayload({
    meta: { drillId: 'tracking_core_pr_pilot_v1_2deg_5dps', simHz: SIM_HZ },
    ticks,
    events,
  });
}

describe('computeTrackingFrozenCrosshairRatio', () => {
  it('returns exactly 1 for a participant who never moved — the stimulus tells them apart from nobody', () => {
    // Aim held at the centre for the whole scored window: the participant *is* the frozen baseline.
    const result = computeTrackingFrozenCrosshairRatio(payloadFor(buildTicks(() => 0)));

    expect(result.status).toBe('ok');
    expect(result.ratio).toBeCloseTo(1, 12);
    expect(result.frozenRmsEpsilonDeg).toBeCloseTo(result.actualRmsEpsilonDeg, 12);
    // RMS of a full sine period at 2 deg amplitude = 2/sqrt(2).
    expect(result.actualRmsEpsilonDeg).toBeCloseTo(SWEEP_DEG / Math.SQRT2, 2);
    // The prep window is excluded: the ratio is measured over the scored window only.
    expect(result.tickCount).toBe(SCORED_TICKS);
  });

  it('returns 2 when the participant halves their error — a discriminating condition', () => {
    const result = computeTrackingFrozenCrosshairRatio(
      payloadFor(buildTicks((_i, bearing) => bearing / 2)),
    );

    expect(result.status).toBe('ok');
    expect(result.ratio).toBeCloseTo(2, 2);
    expect(result.maxFrozenEpsilonDeg).toBeCloseTo(SWEEP_DEG, 2);
  });

  it('grows without bound for a flawless follower', () => {
    // `angularEccentricityDeg` is `acos(dot)`, which loses half its significand as dot approaches
    // 1: a mathematically perfect follower still measures ~5e-7 deg of ε. So the ratio is huge
    // rather than literally Infinity — worth pinning, because it is the numeric ceiling of this
    // measure, not a defect.
    const result = computeTrackingFrozenCrosshairRatio(payloadFor(buildTicks((_i, bearing) => bearing)));

    expect(result.status).toBe('ok');
    expect(result.actualRmsEpsilonDeg).toBeLessThan(1e-5);
    expect(result.ratio).toBeGreaterThan(1e5);
    expect(result.frozenRmsEpsilonDeg).toBeGreaterThan(1);
  });

  it('falls at or below 1 when the stimulus barely travels, however well the participant tracks', () => {
    // The §12.8 finding in miniature: a target with no angular sweep leaves ε no room to differ,
    // so a frozen crosshair matches or beats a real attempt — the condition measures nothing.
    const stationary: TickRecord[] = [];
    const centre = targetAt(0);
    for (let i = 0; i < PREP_TICKS + SCORED_TICKS; i++) {
      const scoredIndex = i - PREP_TICKS;
      // Symmetric jitter about the centre — a genuine (if imperfect) tracking attempt.
      const aimDeg = scoredIndex < 0 ? 0 : 0.3 * Math.sin(2 * Math.PI * 3 * (scoredIndex / SIM_HZ));
      stationary.push(
        makeTick({
          t: T0_MS + i * TICK_MS,
          tx: centre.x,
          ty: centre.y,
          tz: centre.z,
          aim: { yaw: aimDeg * DEG, pitch: 0 },
        }),
      );
    }

    const result = computeTrackingFrozenCrosshairRatio(payloadFor(stationary));

    expect(result.status).toBe('ok');
    expect(result.ratio).toBeLessThan(1);
    expect(result.maxFrozenEpsilonDeg).toBeLessThan(0.01);
  });

  it('measures from first-on-target, and reproduces the canonical P0 rmsEpsilonDeg (C-D4)', () => {
    // The first 32 scored ticks are aimed 90 deg away — the ray misses the hitbox entirely, so the
    // canonical window opens later. The ratio must divide the same number P0 reports.
    const offTargetTicks = 32;
    const result = computeTrackingFrozenCrosshairRatio(
      payloadFor(buildTicks((i, bearing) => (i < offTargetTicks ? 90 : bearing / 2))),
    );

    expect(result.status).toBe('ok');
    expect(result.tickCount).toBe(SCORED_TICKS - offTargetTicks);
    expect(result.actualRmsEpsilonDeg).toBeCloseTo(result.canonicalRmsEpsilonDeg, 12);
  });

  it('reports a closed reason instead of a number when the ratio is undefined', () => {
    // Never acquired: P0 reports the acquisition failure; there is no pursuit RMS to divide.
    expect(computeTrackingFrozenCrosshairRatio(payloadFor(buildTicks(() => 90))).status).toBe(
      'no-scored-window',
    );
    // Fewer scored ticks than the canonical `minValidTicks` floor.
    expect(
      computeTrackingFrozenCrosshairRatio(payloadFor(buildTicks(() => 0)), { minTicks: SCORED_TICKS + 1 }).status,
    ).toBe('insufficient-ticks');
    // A tick inside the window with no target telemetry.
    const holed = buildTicks(() => 0);
    holed[PREP_TICKS + 10] = makeTick({ t: holed[PREP_TICKS + 10].t });
    expect(computeTrackingFrozenCrosshairRatio(payloadFor(holed)).status).toBe('missing-target-telemetry');
  });

  it('still measures the scored window when the export has no scored_start (legacy payload)', () => {
    // Permissive, matching `adaptPayloadForScoredWindow()`: the window then opens at `visible`, so
    // the on-target prep ticks are included — visible in `tickCount`, not silently dropped.
    const result = computeTrackingFrozenCrosshairRatio(
      payloadFor(buildTicks(() => 0), { scoredStart: false }),
    );

    expect(result.status).toBe('ok');
    expect(result.tickCount).toBe(PREP_TICKS + SCORED_TICKS);
  });
});
