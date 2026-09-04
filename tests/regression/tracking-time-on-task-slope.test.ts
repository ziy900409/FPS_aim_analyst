/**
 * WP-54 / T7 — B-3c, the time-on-task slope (gate §2.2, frozen 2026-09-03).
 *
 * The criterion asks whether a 25 s block drifts: RMS ε over the first 5 s vs the last 5 s of the
 * same scored window, Δ = (last − first) / first, |Δ| ≤ 20% after averaging over the cell. These
 * fixtures pin the arithmetic against analytically exact answers (aim = bearing + a known constant
 * offset makes ε exactly that offset, at pitch 0), pin the half-window boundary convention, and —
 * the part that matters for C-D4 — pin `windowRmsEpsilonDeg` to the canonical P0 `rmsEpsilonDeg`.
 * If those diverge, the halves have stopped partitioning the window the gate reports on.
 */
import { describe, expect, it } from 'vitest';
import {
  TRACKING_TIME_ON_TASK_HALF_MS,
  computeTrackingTimeOnTaskSlope,
} from '../../scripts/trackingTimeOnTaskSlope.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const T0_MS = 1000;
const DISTANCE_U = 4;
/** `resolveEyeOrigin` falls back to this for a fixture without `meta.scene.eye` (`legacy-default`);
 * the target sits at the same height, so every bearing is at pitch 0 and ε is a pure yaw
 * difference — the expected figures below are exact, not approximations. */
const EYE_Y = 1.6;
const PREP_TICKS = 64;
/** 14 s — comfortably longer than the 2 × 5 s the criterion needs, and short enough to build in a
 * unit test. A real block is 25 s. */
const SCORED_TICKS = SIM_HZ * 14;
const SWEEP_DEG = 2;
const SWEEP_HZ = 0.5;
const TARGET_ID = 't0';

const DEG = Math.PI / 180;

/** Target world position for a bearing of `yawDeg` from the eye, at pitch 0. */
function targetAt(yawDeg: number): { x: number; y: number; z: number } {
  const yaw = yawDeg * DEG;
  return { x: -DISTANCE_U * Math.sin(yaw), y: EYE_Y, z: -DISTANCE_U * Math.cos(yaw) };
}

function bearingDeg(i: number): number {
  return SWEEP_DEG * Math.sin(2 * Math.PI * SWEEP_HZ * (i / SIM_HZ));
}

/**
 * One block's tick stream: an on-target prep window (excluded by the `scored_start` adapter), then
 * `scoredTicks` scored ticks where the aim trails the bearing by `errorDeg(i)` — so ε at scored
 * tick `i` is exactly `|errorDeg(i)|`.
 */
function buildTicks(errorDeg: (i: number) => number, scoredTicks = SCORED_TICKS): TickRecord[] {
  const ticks: TickRecord[] = [];
  const centre = targetAt(0);
  for (let i = 0; i < PREP_TICKS; i++) {
    ticks.push(makeTick({ t: T0_MS + i * TICK_MS, tx: centre.x, ty: centre.y, tz: centre.z, aim: { yaw: 0, pitch: 0 } }));
  }
  for (let i = 0; i < scoredTicks; i++) {
    const bearing = bearingDeg(i);
    const target = targetAt(bearing);
    ticks.push(
      makeTick({
        t: T0_MS + (PREP_TICKS + i) * TICK_MS,
        tx: target.x,
        ty: target.y,
        tz: target.z,
        aim: { yaw: (bearing + errorDeg(i)) * DEG, pitch: 0 },
      }),
    );
  }
  return ticks;
}

function payloadFor(ticks: readonly TickRecord[]) {
  const centre = targetAt(0);
  const events: DrillEvent[] = [
    { type: 'visible', targetId: TARGET_ID, side: 'R', t: T0_MS, targetX: centre.x, targetY: centre.y, targetZ: centre.z },
    {
      type: 'scored_start',
      targetId: TARGET_ID,
      t: T0_MS + PREP_TICKS * TICK_MS,
      targetX: centre.x,
      targetY: centre.y,
      targetZ: centre.z,
    },
  ];
  return makePayload({
    meta: { drillId: 'tracking_core_pr_pilot_v1_3deg_5dps', simHz: SIM_HZ },
    ticks,
    events,
  });
}

/** Scored tick index at which a step change lands squarely in the 4 s neither half covers. */
const STEP_AT = SIM_HZ * 7;

describe('computeTrackingTimeOnTaskSlope', () => {
  it('reports Δ = 0 for a participant who holds the same error all block, and excludes the middle', () => {
    const result = computeTrackingTimeOnTaskSlope(payloadFor(buildTicks(() => 1)));

    expect(result.status).toBe('ok');
    expect(result.firstRmsEpsilonDeg).toBeCloseTo(1, 9);
    expect(result.lastRmsEpsilonDeg).toBeCloseTo(1, 9);
    expect(result.deltaFraction).toBeCloseTo(0, 9);
    // Boundary convention: the first half is [firstTick, +5 s) and the last is (lastTick − 5 s,
    // lastTick]. At 128 Hz both cutoffs land exactly on a tick (5000 ms = 640 × 7.8125 ms) and both
    // are excluded, so the halves come out symmetric at 640 ticks = 5 s of samples each.
    expect(result.firstTickCount).toBe(SIM_HZ * 5);
    expect(result.lastTickCount).toBe(SIM_HZ * 5);
    // The 4 s between the halves belongs to neither: Δ compares the ends, not two halves of the run.
    expect(result.firstTickCount + result.lastTickCount).toBeLessThan(SCORED_TICKS);
    expect(result.windowSpanMs).toBeCloseTo((SCORED_TICKS - 1) * TICK_MS, 9);
  });

  it('reports +100% when the error doubles by the end of the block (fatigue)', () => {
    const result = computeTrackingTimeOnTaskSlope(payloadFor(buildTicks((i) => (i < STEP_AT ? 1 : 2))));

    expect(result.status).toBe('ok');
    expect(result.firstRmsEpsilonDeg).toBeCloseTo(1, 9);
    expect(result.lastRmsEpsilonDeg).toBeCloseTo(2, 9);
    expect(result.deltaFraction).toBeCloseTo(1, 9);
    // Sign matters: the criterion is |Δ| ≤ 20%, but the direction is what gets reported.
    expect(result.deltaFraction).toBeGreaterThan(0.2);
  });

  it('reports −50% when the participant warms up over the block (learning)', () => {
    const result = computeTrackingTimeOnTaskSlope(payloadFor(buildTicks((i) => (i < STEP_AT ? 2 : 1))));

    expect(result.status).toBe('ok');
    expect(result.deltaFraction).toBeCloseTo(-0.5, 9);
    expect(Math.abs(result.deltaFraction)).toBeGreaterThan(0.2);
  });

  it('measures from first-on-target, and reproduces the canonical P0 rmsEpsilonDeg (C-D4)', () => {
    // The first 32 scored ticks are aimed 90 deg away — the ray misses the hitbox, so the canonical
    // window opens later and both halves shift with it.
    const offTargetTicks = 32;
    const result = computeTrackingTimeOnTaskSlope(
      payloadFor(buildTicks((i) => (i < offTargetTicks ? 90 : 1))),
    );

    expect(result.status).toBe('ok');
    expect(result.windowRmsEpsilonDeg).toBeCloseTo(result.canonicalRmsEpsilonDeg, 12);
    expect(result.windowSpanMs).toBeCloseTo((SCORED_TICKS - offTargetTicks - 1) * TICK_MS, 9);
    // Both halves now sit inside the post-acquisition stretch, where the error is a constant 1 deg.
    expect(result.deltaFraction).toBeCloseTo(0, 9);
  });

  it('refuses to report a slope when the two halves would overlap', () => {
    // 8 s of scored data: less than 2 × 5 s, so "first 5 s" and "last 5 s" share ticks and Δ would
    // partly compare a stretch with itself.
    const result = computeTrackingTimeOnTaskSlope(payloadFor(buildTicks(() => 1, SIM_HZ * 8)));

    expect(result.status).toBe('window-too-short');
    expect(result.deltaFraction).toBeNaN();
    // The span is still reported, so the operator can see how far short the run fell.
    expect(result.windowSpanMs).toBeCloseTo((SIM_HZ * 8 - 1) * TICK_MS, 9);
    expect(result.windowSpanMs).toBeLessThan(2 * TRACKING_TIME_ON_TASK_HALF_MS);
  });

  it('reports a closed reason instead of a number whenever the slope is undefined', () => {
    // Never acquired: P0 reports the acquisition failure; there is no pursuit window to halve.
    expect(computeTrackingTimeOnTaskSlope(payloadFor(buildTicks(() => 90))).status).toBe('no-scored-window');
    // Fewer scored ticks than the canonical `minValidTicks` floor.
    expect(
      computeTrackingTimeOnTaskSlope(payloadFor(buildTicks(() => 1)), { minTicks: SCORED_TICKS + 1 }).status,
    ).toBe('insufficient-ticks');
    // Enough ticks in the window, but not enough inside a single half.
    expect(computeTrackingTimeOnTaskSlope(payloadFor(buildTicks(() => 1)), { minTicks: 700 }).status).toBe(
      'insufficient-ticks',
    );
    // A tick inside the window with no target telemetry.
    const holed = buildTicks(() => 1);
    holed[PREP_TICKS + 10] = makeTick({ t: holed[PREP_TICKS + 10].t });
    expect(computeTrackingTimeOnTaskSlope(payloadFor(holed)).status).toBe('missing-target-telemetry');
  });
});
