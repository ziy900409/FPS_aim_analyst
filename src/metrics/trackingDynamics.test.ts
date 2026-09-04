import { describe, expect, it } from 'vitest';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { Meta } from '../data/metadata.ts';
import { aimForward } from './eyeOrigin.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';
import {
  deriveTrackingDynamics,
  deriveTrackingReversalWindows,
  type TrackingDynamicsOptions,
  type TrackingReversalWindowOptions,
} from './trackingDynamics.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const DISTANCE = 4;
const DEG_TO_RAD = Math.PI / 180;
const TARGET_ID = 'target-1';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_core_pr_pilot_v1_test',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 54000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
};

const DYNAMICS_OPTIONS: TrackingDynamicsOptions = {
  version: 'tracking-dynamics-v1',
  lagSearchMs: [0, 250],
  smoothingVersion: 'tracking-dynamics-smoothing-v1-none',
  minValidTicks: 32,
  correlationAmbiguityRatio: 2,
};

const REVERSAL_OPTIONS: TrackingReversalWindowOptions = {
  version: 'tracking-dynamics-v1',
  minWindowMs: 300,
  maxWindowMs: 500,
  minBaselineMs: 200,
  settlingToleranceDeg: 0.5,
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function anglesToWorld(yawDeg: number, pitchDeg: number): { x: number; y: number; z: number } {
  const dir = aimForward(yawDeg * DEG_TO_RAD, pitchDeg * DEG_TO_RAD);
  return { x: EYE.x + DISTANCE * dir.x, y: EYE.y + DISTANCE * dir.y, z: EYE.z + DISTANCE * dir.z };
}

interface ContinuousBuildOptions {
  totalTicks: number;
  prepTicks?: number;
  targetYawDeg(tSec: number, tick: number): number;
  targetPitchDeg(tSec: number, tick: number): number;
  aimYawDeg(tSec: number, tick: number): number;
  aimPitchDeg(tSec: number, tick: number): number;
  protocolViolationAtTick?: number;
  /** WP-54 / T7: defaults to `fire`; `fire-released` is deliberately non-blocking here. */
  protocolViolationKind?: Extract<ExportPayload['events'][number], { type: 'protocol_violation' }>['kind'];
  motionChanges?: Array<{
    atTick: number;
    yawBefore: number;
    yawAfter: number;
    pitchBefore: number;
    pitchAfter: number;
  }>;
}

/** Builds a synthetic ExportPayload directly from closed-form target/aim angle functions of
 * elapsed seconds. `dYaw`/`dPitch` are set to the *exact* radian delta of the scripted aim angles
 * between consecutive ticks — physically self-consistent with `tick.aim.yaw/pitch`, no approximation. */
function buildContinuousPayload(options: ContinuousBuildOptions): ExportPayload {
  const prepTicks = options.prepTicks ?? 0;
  const ticks: TickRecord[] = [];
  const events: ExportPayload['events'] = [];
  let previousAimYawDeg: number | undefined;
  let previousAimPitchDeg: number | undefined;

  for (let tick = 0; tick <= options.totalTicks; tick++) {
    const t = tick * TICK_MS;
    const tSec = t / 1000;
    const targetPos = anglesToWorld(options.targetYawDeg(tSec, tick), options.targetPitchDeg(tSec, tick));

    if (tick === 0) {
      events.push({
        type: 'visible',
        targetId: TARGET_ID,
        side: 'R',
        t,
        targetX: targetPos.x,
        targetY: targetPos.y,
        targetZ: targetPos.z,
      });
    }
    if (tick === prepTicks) {
      events.push({
        type: 'scored_start',
        targetId: TARGET_ID,
        t,
        targetX: targetPos.x,
        targetY: targetPos.y,
        targetZ: targetPos.z,
      });
    }
    if (options.protocolViolationAtTick === tick) {
      events.push({ type: 'protocol_violation', kind: options.protocolViolationKind ?? 'fire', t });
    }
    for (const change of options.motionChanges ?? []) {
      if (change.atTick === tick) {
        events.push({
          type: 'target_motion_change',
          targetId: TARGET_ID,
          t,
          yawVelocityBeforeDegPerSec: change.yawBefore,
          yawVelocityAfterDegPerSec: change.yawAfter,
          pitchVelocityBeforeDegPerSec: change.pitchBefore,
          pitchVelocityAfterDegPerSec: change.pitchAfter,
        });
      }
    }

    const aimYawDeg = options.aimYawDeg(tSec, tick);
    const aimPitchDeg = options.aimPitchDeg(tSec, tick);
    const tickRecord: TickRecord = {
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: targetPos.x,
      ty: targetPos.y,
      tz: targetPos.z,
      aim: { yaw: aimYawDeg * DEG_TO_RAD, pitch: aimPitchDeg * DEG_TO_RAD },
      keys: [],
      ads: false,
    };
    if (previousAimYawDeg !== undefined && previousAimPitchDeg !== undefined) {
      tickRecord.dYaw = (aimYawDeg - previousAimYawDeg) * DEG_TO_RAD;
      tickRecord.dPitch = (aimPitchDeg - previousAimPitchDeg) * DEG_TO_RAD;
    }
    previousAimYawDeg = aimYawDeg;
    previousAimPitchDeg = aimPitchDeg;
    ticks.push(tickRecord);
  }

  const payload = buildExportPayload(baseMeta, { ticks, events, recorderOverflow: false });
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

/** Sum-of-two-incommensurate-sinusoids target trajectory: smooth, non-periodic within the 250ms
 * lag-search window (periods ~1.6-3.3s), safely inside the H1 hitbox angular tolerance at 4u. */
function coreYawDeg(tSec: number): number {
  return 3 * Math.sin(2 * Math.PI * 0.3 * tSec + 0.4) + 1.5 * Math.sin(2 * Math.PI * 0.53 * tSec + 1.1);
}
function corePitchDeg(tSec: number): number {
  return 2 * Math.sin(2 * Math.PI * 0.37 * tSec + 0.9) + 1 * Math.sin(2 * Math.PI * 0.61 * tSec + 2.2);
}

// Lag/gain accuracy needs several full periods of the slowest yaw/pitch components (~2.7-3.3s) to
// average out finite-window correlation edge effects — 3200 ticks ~= 25s matches D-54.4's real
// scored-block duration and keeps the recovered lag within NFR-54-2's one-tick tolerance.
const DEFAULT_DYNAMICS_FIXTURE_TICKS = 3200;

function perfectFollowerPayload(totalTicks = DEFAULT_DYNAMICS_FIXTURE_TICKS): ExportPayload {
  return buildContinuousPayload({
    totalTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: coreYawDeg,
    aimPitchDeg: corePitchDeg,
  });
}

function fixedLagPayload(lagTicks: number, totalTicks = DEFAULT_DYNAMICS_FIXTURE_TICKS): ExportPayload {
  const lagSec = (lagTicks * TICK_MS) / 1000;
  return buildContinuousPayload({
    totalTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: (tSec) => coreYawDeg(tSec - lagSec),
    aimPitchDeg: (tSec) => corePitchDeg(tSec - lagSec),
  });
}

function knownGainPayload(gain: number, totalTicks = DEFAULT_DYNAMICS_FIXTURE_TICKS): ExportPayload {
  return buildContinuousPayload({
    totalTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: (tSec) => gain * coreYawDeg(tSec),
    aimPitchDeg: (tSec) => gain * corePitchDeg(tSec),
  });
}

function neverAcquirePayload(totalTicks = 200): ExportPayload {
  return buildContinuousPayload({
    totalTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: (tSec) => coreYawDeg(tSec) + 90,
    aimPitchDeg: (tSec) => corePitchDeg(tSec),
  });
}

/** Continuous (non-degenerate) target trajectory tracked almost perfectly by aim, except that a
 * caller-supplied yaw offset function pushes aim off-target for scripted tick ranges — used for the
 * scored_start-windowing and recovery-aggregation fixtures. A *static* target would make the target
 * omega series identically zero everywhere, which degenerates the lag/gain correlation search (every
 * candidate lag ties at zero correlation) and spuriously blocks on `lag-peak-ambiguous` — this keeps
 * a real, non-degenerate pursuit signal underneath the scripted drop/reacquire behavior. */
function dropRecoveryPayload(options: { totalTicks: number; prepTicks: number; offsetDegForTick(tick: number): number }): ExportPayload {
  return buildContinuousPayload({
    totalTicks: options.totalTicks,
    prepTicks: options.prepTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: (tSec, tick) => coreYawDeg(tSec) + options.offsetDegForTick(tick),
    aimPitchDeg: corePitchDeg,
  });
}

// ---------------------------------------------------------------------------
// Slice 1 — P0 reuse: scored_start-based window adapter excludes the prep window
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — scored_start windowing (P0 reuse)', () => {
  it('excludes a drop/reacquire that only happened during the prep window', () => {
    const prepTicks = 50;
    const payload = dropRecoveryPayload({
      totalTicks: prepTicks + 300,
      prepTicks,
      offsetDegForTick: (tick) => {
        if (tick < prepTicks) {
          // Prep window: on-target, then a deliberate drop+reacquire — must be excluded from analysis.
          return tick >= 10 && tick < 20 ? 90 : 0;
        }
        return 0; // scored window: flawless tracking throughout
      },
    });

    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.completedReacquireCount).toBe(0);
    expect(result.terminalDropCount).toBe(0);
    expect(result.dropRatePerSec).toBe(0);
    expect(result.longestOffTargetMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Truth fixture 1 — perfect follower (NFR-54-3)
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — perfect follower', () => {
  it('recovers lag~0, gain~1, near-zero RMSE, and P0 floor values', () => {
    const payload = perfectFollowerPayload();
    const p0 = deriveTrackingMetrics(payload);
    expect(p0.presentations[0].acquisitionFailure).toBe(false);
    expect(p0.presentations[0].totPercent).toBe(100);
    expect(p0.presentations[0].rmsEpsilonDeg!).toBeLessThan(1e-6);

    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Math.abs(result.lagMs)).toBeLessThanOrEqual(TICK_MS);
    expect(result.velocityGain).toBeCloseTo(1, 1);
    expect(result.velocityRmseDegPerSec).toBeLessThan(1e-3);
  });

  it('recovers a reasonable ok result under tri3 smoothing too', () => {
    const payload = perfectFollowerPayload();
    const result = deriveTrackingDynamics(payload, {
      ...DYNAMICS_OPTIONS,
      smoothingVersion: 'tracking-dynamics-smoothing-v1-tri3',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.velocityGain).toBeCloseTo(1, 1);
  });

  it('fails fast on an unknown smoothingVersion', () => {
    const payload = perfectFollowerPayload();
    expect(() =>
      deriveTrackingDynamics(payload, { ...DYNAMICS_OPTIONS, smoothingVersion: 'nonsense-v0' }),
    ).toThrow(/unknown smoothingVersion/);
  });
});

// ---------------------------------------------------------------------------
// Truth fixture 2 — fixed lag (NFR-54-2)
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — fixed lag', () => {
  it('recovers a known lag within one tick period', () => {
    const lagTicks = 16; // ~125ms, well inside [0,250]ms
    const payload = fixedLagPayload(lagTicks);
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const truthMs = lagTicks * TICK_MS;
    expect(Math.abs(result.lagMs - truthMs)).toBeLessThanOrEqual(1000 / SIM_HZ);
  });
});

// ---------------------------------------------------------------------------
// Truth fixture 3 — known gain 0.7 / 1.0 / 1.3 (NFR-54-3)
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — known gain', () => {
  for (const gain of [0.7, 1.0, 1.3]) {
    it(`recovers gain=${gain} within 0.02`, () => {
      const payload = knownGainPayload(gain);
      const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(Math.abs(result.velocityGain - gain)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(result.lagMs)).toBeLessThanOrEqual(TICK_MS);
    });
  }
});

// ---------------------------------------------------------------------------
// Truth fixture 4 — never acquire
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — never acquire', () => {
  it('blocks P1 with no-acquisition while P0 still reports the failure (not hidden/zeroed)', () => {
    const payload = neverAcquirePayload();
    const p0 = deriveTrackingMetrics(payload);
    expect(p0.presentations[0].acquisitionFailure).toBe(true);
    expect(p0.acquisitionFailureRate).toBe(1);

    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result).toEqual({ status: 'blocked', reason: 'no-acquisition' });
  });
});

// ---------------------------------------------------------------------------
// Truth fixture 5/6 — drop/reacquire and terminal drop
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — recovery aggregation', () => {
  it('counts a completed reacquisition with no terminal drop', () => {
    const prepTicks = 10;
    const payload = dropRecoveryPayload({
      totalTicks: prepTicks + 300,
      prepTicks,
      offsetDegForTick: (tick) => {
        const scoredTick = tick - prepTicks;
        if (scoredTick < 0) return 0;
        return scoredTick >= 50 && scoredTick < 70 ? 90 : 0; // one clean drop + reacquire
      },
    });

    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.completedReacquireCount).toBe(1);
    expect(result.terminalDropCount).toBe(0);
    expect(result.longestOffTargetMs).toBeGreaterThan(0);
    expect(result.dropRatePerSec).toBeGreaterThan(0);
  });

  it('counts a terminal drop separately and never folds it into a completed duration', () => {
    const prepTicks = 10;
    const totalScoredTicks = 300;
    const dropAtScoredTick = 250;
    const payload = dropRecoveryPayload({
      totalTicks: prepTicks + totalScoredTicks,
      prepTicks,
      offsetDegForTick: (tick) => {
        const scoredTick = tick - prepTicks;
        if (scoredTick < 0) return 0;
        return scoredTick >= dropAtScoredTick ? 90 : 0; // run ends off-target, never recovers
      },
    });

    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.terminalDropCount).toBe(1);
    expect(result.completedReacquireCount).toBe(0);
    const expectedLongestMs = (totalScoredTicks - dropAtScoredTick) * TICK_MS;
    expect(result.longestOffTargetMs).toBeCloseTo(expectedLongestMs, 0);
  });
});

// ---------------------------------------------------------------------------
// Blocked branch — protocol-incompatible
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — protocol-incompatible', () => {
  it('blocks when a protocol_violation falls inside the scored window', () => {
    const payload = buildContinuousPayload({
      totalTicks: 400,
      targetYawDeg: coreYawDeg,
      targetPitchDeg: corePitchDeg,
      aimYawDeg: coreYawDeg,
      aimPitchDeg: corePitchDeg,
      protocolViolationAtTick: 100,
    });
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result).toEqual({ status: 'blocked', reason: 'protocol-incompatible' });
  });

  it('does not block on fire-released (WP-54 T7: adequacy is a run-level threshold, D-54.50)', () => {
    // Under tracking-pilot-v2's zero-recoil weapon a brief release does not perturb the aiming
    // task, so held-fire adequacy is judged once by the run-level gate rather than duplicated
    // here — one criterion, one implementation (C-D4).
    const payload = buildContinuousPayload({
      totalTicks: 400,
      targetYawDeg: coreYawDeg,
      targetPitchDeg: corePitchDeg,
      aimYawDeg: coreYawDeg,
      aimPitchDeg: corePitchDeg,
      protocolViolationAtTick: 100,
      protocolViolationKind: 'fire-released',
    });
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result.status).not.toBe('blocked');
  });
});

// ---------------------------------------------------------------------------
// Blocked branch — insufficient-valid-ticks
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — insufficient-valid-ticks', () => {
  it('blocks when the scored window is shorter than minValidTicks', () => {
    const payload = perfectFollowerPayload(10);
    const result = deriveTrackingDynamics(payload, { ...DYNAMICS_OPTIONS, minValidTicks: 1000 });
    expect(result).toEqual({ status: 'blocked', reason: 'insufficient-valid-ticks' });
  });
});

// ---------------------------------------------------------------------------
// Blocked branch — missing-target-telemetry
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — missing-target-telemetry', () => {
  it('blocks when a tick in the analysis window has a null target position', () => {
    const payload = perfectFollowerPayload();
    payload.ticks[200] = { ...payload.ticks[200], tx: null, ty: null, tz: null };
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result).toEqual({ status: 'blocked', reason: 'missing-target-telemetry' });
  });

  it('blocks when a tick in the analysis window is missing dYaw/dPitch', () => {
    const payload = perfectFollowerPayload();
    const { dYaw: _dYaw, dPitch: _dPitch, ...rest } = payload.ticks[200];
    payload.ticks[200] = rest;
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result).toEqual({ status: 'blocked', reason: 'missing-target-telemetry' });
  });
});

// ---------------------------------------------------------------------------
// Blocked branch — lag-peak-ambiguous
// ---------------------------------------------------------------------------

describe('deriveTrackingDynamics — lag ambiguity', () => {
  it('blocks rather than silently picking one lag/gain for a periodic multi-peak signal', () => {
    const freqHz = 10; // period 100ms — several similarly-tall peaks fit inside [0,250]ms
    const amplitudeDeg = 5;
    const lagSec = 0.03;
    const payload = buildContinuousPayload({
      totalTicks: 500,
      targetYawDeg: (tSec) => amplitudeDeg * Math.sin(2 * Math.PI * freqHz * tSec),
      targetPitchDeg: () => 0,
      aimYawDeg: (tSec) => amplitudeDeg * Math.sin(2 * Math.PI * freqHz * (tSec - lagSec)),
      aimPitchDeg: () => 0,
    });
    const result = deriveTrackingDynamics(payload, DYNAMICS_OPTIONS);
    expect(result).toEqual({ status: 'blocked', reason: 'lag-peak-ambiguous' });
  });
});

// ---------------------------------------------------------------------------
// deriveTrackingReversalWindows
// ---------------------------------------------------------------------------

describe('deriveTrackingReversalWindows', () => {
  it('returns an empty window list for a pursuit-only run with zero motion-change events', () => {
    const payload = perfectFollowerPayload(100);
    const result = deriveTrackingReversalWindows(payload, REVERSAL_OPTIONS);
    expect(result.windows).toEqual([]);
  });

  it('reports a clear response-latency/overshoot/settling shape around one reversal', () => {
    const changeAtSec = 1.0;
    const amplitudeDeg = 5;
    const riseSec = 0.05;
    const decaySec = 0.1;
    const offsetYawDeg = (tSec: number): number => {
      if (tSec < changeAtSec) return 0;
      const dt = tSec - changeAtSec;
      if (dt <= riseSec) return amplitudeDeg * (dt / riseSec);
      return amplitudeDeg * Math.exp(-(dt - riseSec) / decaySec);
    };

    const payload = buildContinuousPayload({
      totalTicks: Math.round((changeAtSec + 1.0) / (TICK_MS / 1000)),
      targetYawDeg: () => 0,
      targetPitchDeg: () => 0,
      aimYawDeg: offsetYawDeg,
      aimPitchDeg: () => 0,
      motionChanges: [
        {
          atTick: Math.round((changeAtSec * 1000) / TICK_MS),
          yawBefore: 0,
          yawAfter: 10,
          pitchBefore: 0,
          pitchAfter: 0,
        },
      ],
    });

    const result = deriveTrackingReversalWindows(payload, REVERSAL_OPTIONS);
    expect(result.windows).toHaveLength(1);
    const w = result.windows[0];
    expect(w.excluded).toBe(false);
    expect(w.baselineErrorDeg!).toBeLessThan(0.1);
    expect(w.peakErrorDeg!).toBeGreaterThan(3);
    expect(w.overshootDeg!).toBeGreaterThan(3);
    expect(w.responseLatencyMs!).toBeGreaterThan(0);
    expect(w.responseLatencyMs!).toBeLessThan(50);
    expect(w.settlingTimeMs).toBeDefined();
    expect(w.settlingTimeMs!).toBeLessThanOrEqual(REVERSAL_OPTIONS.maxWindowMs);
  });

  it('excludes a change too close to the previous one (overlap) and one too close to the window end (insufficient-window-data), counting both rather than dropping them', () => {
    const totalTicks = Math.round(1.5 / (TICK_MS / 1000));
    const changeAMs = 400; // baseline before it is < minBaselineMs (200ms) is fine (it's the first)
    const changeBMs = changeAMs + 100; // < minBaselineMs(200) after A -> overlap
    const changeCMs = (totalTicks * TICK_MS) - 50; // too close to run end -> insufficient-window-data

    const payload = buildContinuousPayload({
      totalTicks,
      targetYawDeg: () => 0,
      targetPitchDeg: () => 0,
      aimYawDeg: () => 0,
      aimPitchDeg: () => 0,
      motionChanges: [
        { atTick: Math.round(changeAMs / TICK_MS), yawBefore: 0, yawAfter: 5, pitchBefore: 0, pitchAfter: 0 },
        { atTick: Math.round(changeBMs / TICK_MS), yawBefore: 5, yawAfter: -5, pitchBefore: 0, pitchAfter: 0 },
        { atTick: Math.round(changeCMs / TICK_MS), yawBefore: -5, yawAfter: 5, pitchBefore: 0, pitchAfter: 0 },
      ],
    });

    const result = deriveTrackingReversalWindows(payload, REVERSAL_OPTIONS);
    expect(result.windows).toHaveLength(3);
    expect(result.windows[1].excluded).toBe(true);
    expect(result.windows[1].excludedReason).toBe('overlap');
    expect(result.windows[2].excluded).toBe(true);
    expect(result.windows[2].excludedReason).toBe('insufficient-window-data');
  });
});
