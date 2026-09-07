/**
 * WP-54 / T7 — gate §3.5: shots-on-target vs the offline on-target derivation.
 *
 * `tracking-pilot-v2`'s weapon has zero spread (D-54.51), so the engine's live per-shot verdict and
 * the offline replay read the *same* sphere geometry. These fixtures pin that reconciliation: when
 * the two agree the delta is exactly 0, when they disagree the delta reports the size of the
 * disagreement, and `totPercent` never drifts from the canonical P0 `totPercent` (C-D4) — if it
 * did, the engine would be reconciled against a window nobody else measures.
 *
 * The block is built so on-target is exact rather than approximate: aim on the bearing gives ε = 0
 * (inside any hitbox), aim 20° away is far outside the ~7° H1 hitbox subtends at 4 u. No fixture
 * here depends on the hitbox's exact size.
 */
import { describe, expect, it } from 'vitest';
import { computeTrackingShotsOnTarget, formatTrackingShotsOnTarget } from '../../scripts/trackingShotsOnTarget.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const T0_MS = 1000;
const DISTANCE_U = 4;
/** `resolveEyeOrigin`'s `legacy-default` for a fixture without `meta.scene.eye`; the target sits at
 * the same height, so every bearing is at pitch 0 and ε is a pure yaw difference. */
const EYE_Y = 1.6;
const PREP_TICKS = 64;
/** 8 s of scored ticks — long enough for a realistic shot count, small enough for a unit test. */
const SCORED_TICKS = SIM_HZ * 8;
/** Every 16th tick = 8 Hz, close to the weapon's 10 Hz and exactly tick-aligned so no fixture
 * depends on rounding at the window edges. */
const SHOT_EVERY_TICKS = 16;
const OFF_TARGET_DEG = 20;
const TARGET_ID = 't0';
const DEG = Math.PI / 180;

function targetAt(yawDeg: number): { x: number; y: number; z: number } {
  const yaw = yawDeg * DEG;
  return { x: -DISTANCE_U * Math.sin(yaw), y: EYE_Y, z: -DISTANCE_U * Math.cos(yaw) };
}

/** Scored tick `i` is on-target iff `onTarget(i)`; the target itself never moves, so the only thing
 * under test is where the participant was aiming. */
function buildTicks(onTarget: (i: number) => boolean): TickRecord[] {
  const ticks: TickRecord[] = [];
  const centre = targetAt(0);
  for (let i = 0; i < PREP_TICKS; i++) {
    ticks.push(makeTick({ t: T0_MS + i * TICK_MS, tx: centre.x, ty: centre.y, tz: centre.z, aim: { yaw: 0, pitch: 0 } }));
  }
  for (let i = 0; i < SCORED_TICKS; i++) {
    ticks.push(
      makeTick({
        t: T0_MS + (PREP_TICKS + i) * TICK_MS,
        tx: centre.x,
        ty: centre.y,
        tz: centre.z,
        aim: { yaw: (onTarget(i) ? 0 : OFF_TARGET_DEG) * DEG, pitch: 0 },
      }),
    );
  }
  return ticks;
}

function scoredTickMs(i: number): number {
  return T0_MS + (PREP_TICKS + i) * TICK_MS;
}

/** One `fire` event per `SHOT_EVERY_TICKS` scored ticks, with `hit` decided by `hit(i)`. */
function shotEvents(hit: (scoredTickIndex: number) => boolean): DrillEvent[] {
  const events: DrillEvent[] = [];
  for (let i = 0; i < SCORED_TICKS; i += SHOT_EVERY_TICKS) {
    events.push({ type: 'fire', t: scoredTickMs(i), hit: hit(i), firstShot: i === 0, residualSpeed: 0 });
  }
  return events;
}

function payloadFor(ticks: readonly TickRecord[], shots: readonly DrillEvent[] = []) {
  const centre = targetAt(0);
  const events: DrillEvent[] = [
    { type: 'visible', targetId: TARGET_ID, side: 'R', t: T0_MS, targetX: centre.x, targetY: centre.y, targetZ: centre.z },
    {
      type: 'scored_start',
      targetId: TARGET_ID,
      t: scoredTickMs(0),
      targetX: centre.x,
      targetY: centre.y,
      targetZ: centre.z,
    },
    ...shots,
  ];
  return makePayload({ meta: { drillId: 'tracking_core_pr_pilot_v1_3deg_5dps', simHz: SIM_HZ }, ticks, events });
}

const EXPECTED_SHOTS = Math.ceil(SCORED_TICKS / SHOT_EVERY_TICKS);
/** The first half of the block is on-target. */
const firstHalf = (i: number): boolean => i < SCORED_TICKS / 2;

describe('computeTrackingShotsOnTarget', () => {
  it('reports a delta of exactly 0 when the engine and the replay agree on every shot', () => {
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(() => true), shotEvents(() => true)));

    expect(result.status).toBe('ok');
    expect(result.shotCount).toBe(EXPECTED_SHOTS);
    expect(result.hitCount).toBe(EXPECTED_SHOTS);
    expect(result.hitRatePercent).toBeCloseTo(100, 9);
    expect(result.totPercent).toBeCloseTo(100, 9);
    expect(result.deltaPoints).toBeCloseTo(0, 9);
    expect(result.sampleCount).toBe(SCORED_TICKS);
  });

  it('agrees exactly on a half-on half-off block, where a wrong window would not', () => {
    // TOT is 50% by construction and the shots are spread evenly, so any disagreement here would
    // mean the shots were matched to a different interval than the samples.
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(firstHalf), shotEvents(firstHalf)));

    expect(result.status).toBe('ok');
    expect(result.totPercent).toBeCloseTo(50, 9);
    expect(result.hitRatePercent).toBeCloseTo(50, 9);
    expect(result.deltaPoints).toBeCloseTo(0, 9);
  });

  it('surfaces the disagreement this layer exists to catch', () => {
    // The engine claims every shot hit while the replay says the crosshair was 20° away for half
    // the block: exactly the signature of `HitDetector` and `trackingDerivation` disagreeing about
    // the hitbox. The number has to come out large, not be smoothed away.
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(firstHalf), shotEvents(() => true)));

    expect(result.status).toBe('ok');
    expect(result.hitRatePercent).toBeCloseTo(100, 9);
    expect(result.totPercent).toBeCloseTo(50, 9);
    expect(result.deltaPoints).toBeCloseTo(50, 9);
    expect(formatTrackingShotsOnTarget(result)).toContain('delta=+50.0pt');
  });

  it('keeps totPercent identical to the canonical P0 figure (C-D4)', () => {
    for (const onTarget of [() => true, firstHalf]) {
      const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(onTarget), shotEvents(onTarget)));
      expect(result.canonicalTotPercent).toBeCloseTo(result.totPercent, 9);
      expect(formatTrackingShotsOnTarget(result)).not.toContain('P0-MISMATCH');
    }
  });

  it('measures from first-on-target, not from the start of the presentation', () => {
    // The window that matters is the tracking window, which opens when the participant acquires.
    // `deriveTrackingSamples` hands back the wider presentation window, so recomputing the share
    // over all of it would report 75% here while P0 reports 100% — a second definition of TOT,
    // visible only on runs that acquired late (C-D4).
    const acquireAt = SCORED_TICKS / 4;
    const acquired = (i: number): boolean => i >= acquireAt;
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(acquired), shotEvents(acquired)));

    expect(result.status).toBe('ok');
    expect(result.totPercent).toBeCloseTo(100, 9);
    expect(result.canonicalTotPercent).toBeCloseTo(result.totPercent, 9);
    expect(result.sampleCount).toBe(SCORED_TICKS - acquireAt);
    // The shots fired while still off-target fall outside that window and must not be counted.
    expect(result.shotCount).toBe(Math.ceil((SCORED_TICKS - acquireAt) / SHOT_EVERY_TICKS));
    expect(result.hitRatePercent).toBeCloseTo(100, 9);
    expect(result.deltaPoints).toBeCloseTo(0, 9);
  });

  it('excludes shots fired before the scored window opens', () => {
    // The prep window is excluded from every other measure by construction; counting its shots
    // would credit the engine for a stretch the offline share never covered.
    const prepShots: DrillEvent[] = [
      { type: 'fire', t: T0_MS, hit: false, firstShot: true, residualSpeed: 0 },
      { type: 'fire', t: T0_MS + TICK_MS, hit: false, firstShot: false, residualSpeed: 0 },
    ];
    const result = computeTrackingShotsOnTarget(
      payloadFor(buildTicks(() => true), [...prepShots, ...shotEvents(() => true)]),
    );

    expect(result.status).toBe('ok');
    expect(result.shotCount).toBe(EXPECTED_SHOTS);
    expect(result.hitRatePercent).toBeCloseTo(100, 9);
  });

  it('reports no-shots rather than 0% for a run that never fired', () => {
    // Every pre-v2 payload looks like this. Reading it as "missed everything" would invent a
    // disagreement with the offline share, which is precisely what this layer is meant to detect.
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(() => true)));

    expect(result.status).toBe('no-shots');
    expect(result.totPercent).toBeCloseTo(100, 9);
    expect(result.shotCount).toBe(0);
    expect(Number.isNaN(result.deltaPoints)).toBe(true);
    expect(formatTrackingShotsOnTarget(result)).toContain('no-shots');
  });

  it('reports no-scored-window when the participant never acquired the target', () => {
    // No first-on-target tick means no tracking window, the same boundary the canonical TOT calls
    // an acquisition failure — there is nothing for the shots to be reconciled against.
    const result = computeTrackingShotsOnTarget(payloadFor(buildTicks(() => false), shotEvents(() => false)));

    expect(result.status).toBe('no-scored-window');
    expect(formatTrackingShotsOnTarget(result)).toBe('shotsOnTarget=no-scored-window');
  });
});
