import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { Meta } from '../data/metadata.ts';
import { evaluateTrackingRunEligibility, MIN_FIRE_HOLD_COVERAGE } from './trackingRunEligibility.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
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
  spawn: {
    seed: 54000,
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: 54000,
      durationMs: 25000,
      yawBoundDeg: 2,
      pitchBoundDeg: 2,
      targetRmsSpeedDegPerSec: 5,
      frequencyBandHz: [0.1, 0.7],
    },
  },
};

interface BuildOptions {
  prepTicks?: number;
  scoredTicks?: number;
  metaOverrides?: Partial<Meta>;
  /** Mutates the built ticks array in place before returning (e.g. to null out a target position). */
  mutateTicks?: (ticks: TickRecord[]) => void;
  /** Omit the `scored_start` event entirely. */
  omitScoredStart?: boolean;
  /** Appends a `protocol_violation` at this tick index (WP-54 T6 slice 7). */
  violationAtTick?: number;
  /** Kind for `violationAtTick` (WP-54 T7); defaults to the historically observed `ads`. */
  violationKind?: Extract<ExportPayload['events'][number], { type: 'protocol_violation' }>['kind'];
}

function buildPayload(options: BuildOptions = {}): ExportPayload {
  const prepTicks = options.prepTicks ?? 5;
  const scoredTicks = options.scoredTicks ?? 40;
  const totalTicks = prepTicks + scoredTicks;

  const ticks: TickRecord[] = [];
  for (let i = 0; i <= totalTicks; i++) {
    ticks.push({
      t: i * TICK_MS,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: 0,
      ty: 1.6,
      tz: -4,
      aim: { yaw: 0, pitch: 0 },
      keys: [],
      ads: false,
    });
  }
  options.mutateTicks?.(ticks);

  const events: ExportPayload['events'] = [
    { type: 'visible', targetId: TARGET_ID, side: 'R', t: 0, targetX: 0, targetY: 1.6, targetZ: -4 },
  ];
  if (!options.omitScoredStart) {
    events.push({
      type: 'scored_start',
      targetId: TARGET_ID,
      t: prepTicks * TICK_MS,
      targetX: 0,
      targetY: 1.6,
      targetZ: -4,
    });
  }

  if (options.violationAtTick !== undefined) {
    events.push({
      type: 'protocol_violation',
      kind: options.violationKind ?? 'ads',
      t: options.violationAtTick * TICK_MS,
    });
  }

  return {
    meta: { ...baseMeta, ...options.metaOverrides },
    ticks,
    events,
  };
}

describe('evaluateTrackingRunEligibility — eligible', () => {
  it('reports eligible with valid scored tick count and duration for a clean run', () => {
    const payload = buildPayload({ prepTicks: 5, scoredTicks: 40 });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
    if (result.status !== 'eligible') return;
    expect(result.validScoredTicks).toBe(41); // ticks [5..45] inclusive
    expect(result.durationMs).toBeCloseTo(40 * TICK_MS, 6);
  });
});

describe('evaluateTrackingRunEligibility — overflow', () => {
  it('blocks on recorder overflow', () => {
    const payload = buildPayload({ metaOverrides: { recorderOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['recorder-overflow'] });
  });

  it('blocks on input buffer overflow', () => {
    const payload = buildPayload({ metaOverrides: { bufferOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['input-buffer-overflow'] });
  });

  it('collects both overflow reasons at once rather than short-circuiting on the first', () => {
    const payload = buildPayload({ metaOverrides: { recorderOverflow: true, bufferOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toEqual(['recorder-overflow', 'input-buffer-overflow']);
  });
});

describe('evaluateTrackingRunEligibility — missing target', () => {
  it('blocks when a scored-window tick has a null target position', () => {
    const payload = buildPayload({
      prepTicks: 5,
      scoredTicks: 40,
      mutateTicks: (ticks) => {
        ticks[10] = { ...ticks[10], tx: null, ty: null, tz: null };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('missing-target-position');
  });

  it('does not flag a null target position that only occurs inside the prep window', () => {
    const payload = buildPayload({
      prepTicks: 5,
      scoredTicks: 40,
      mutateTicks: (ticks) => {
        ticks[1] = { ...ticks[1], tx: null, ty: null, tz: null };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
  });
});

describe('evaluateTrackingRunEligibility — timestamp', () => {
  it('blocks on a non-monotonic tick timestamp', () => {
    const payload = buildPayload({
      mutateTicks: (ticks) => {
        ticks[20] = { ...ticks[20], t: ticks[19].t };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('non-monotonic-timestamps');
  });
});

describe('evaluateTrackingRunEligibility — coverage', () => {
  it('blocks when scored-window tick coverage falls under the 99.5% floor', () => {
    const prepTicks = 5;
    const scoredTicks = 200;
    const payload = buildPayload({ prepTicks, scoredTicks });
    // Drop enough scored-window ticks to push coverage well under 99.5% while keeping the
    // last tick (and therefore `durationMs`) unchanged.
    const dropped = payload.ticks.filter((_tick, index) => !(index > prepTicks + 5 && index <= prepTicks + 10));
    const result = evaluateTrackingRunEligibility({ ...payload, ticks: dropped });
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('insufficient-scored-coverage');
  });

  it('does not flag coverage for a clean, gap-free run', () => {
    const payload = buildPayload({ prepTicks: 5, scoredTicks: 200 });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
  });
});

describe('evaluateTrackingRunEligibility — protocol violation (WP-54 T6 slice 7)', () => {
  it('blocks a scored run that recorded a protocol violation inside the scored window', () => {
    // Measured on a real block: the participant right-clicked (ADS) during a scored reversal
    // block. `deriveTrackingDynamics()` refused the run as `protocol-incompatible`, but the
    // run-level gate said "eligible", so the primary RMS(epsilon) was still aggregated.
    const result = evaluateTrackingRunEligibility(buildPayload({ violationAtTick: 20 }));
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('protocol-violation');
  });

  it('does not flag a violation that only occurs inside the prep window', () => {
    // The centring prep window is excluded from analysis by construction — same boundary the
    // missing-target check uses.
    const result = evaluateTrackingRunEligibility(buildPayload({ prepTicks: 5, violationAtTick: 2 }));
    expect(result.status).toBe('eligible');
  });

  it('reports the violation alongside other independent failures rather than short-circuiting', () => {
    const result = evaluateTrackingRunEligibility(
      buildPayload({ violationAtTick: 20, metaOverrides: { recorderOverflow: true } }),
    );
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('protocol-violation');
    expect(result.reasons).toContain('recorder-overflow');
  });
});

describe('evaluateTrackingRunEligibility — held-fire coverage (WP-54 T7, tracking-pilot-v2)', () => {
  const REQUIRE_FIRE: Partial<Meta> = { protocolGuard: { requireFire: true, noMovement: true } };

  /** Sets `fire` on every tick; prep ticks are always held, and the first `heldScored` scored
   * ticks are held. Scored ticks are those at index >= prepTicks (t >= scoredStartMs). */
  function fireFlags(prepTicks: number, heldScored: number): (ticks: TickRecord[]) => void {
    return (ticks) => {
      ticks.forEach((tick, i) => {
        const scoredIndex = i - prepTicks;
        tick.fire = scoredIndex < 0 || scoredIndex < heldScored;
      });
    };
  }

  it('pins the frozen threshold at 0.95 (D-54.50, preregistered before data collection)', () => {
    // README §2.2: thresholds must not move once collection starts. This assertion exists so an
    // edit to the constant fails loudly rather than silently re-defining the criterion.
    expect(MIN_FIRE_HOLD_COVERAGE).toBe(0.95);
  });

  it('is eligible when the participant held fire for the whole scored window', () => {
    const result = evaluateTrackingRunEligibility(
      buildPayload({ prepTicks: 5, scoredTicks: 40, metaOverrides: REQUIRE_FIRE, mutateTicks: fireFlags(5, 41) }),
    );
    expect(result.status).toBe('eligible');
  });

  it('is eligible exactly at the threshold (the rule rejects below it, not at it)', () => {
    // 20 scored ticks x 0.95 = 19 exactly, so this case pins the boundary's inclusive side.
    const scoredCount = 20;
    const held = scoredCount * MIN_FIRE_HOLD_COVERAGE;
    expect(Number.isInteger(held)).toBe(true);
    const result = evaluateTrackingRunEligibility(
      buildPayload({
        prepTicks: 5,
        scoredTicks: scoredCount - 1,
        metaOverrides: REQUIRE_FIRE,
        mutateTicks: fireFlags(5, held),
      }),
    );
    expect(result.status).toBe('eligible');
  });

  it('blocks one tick below the threshold', () => {
    const scoredCount = 41; // prepTicks 5 + scoredTicks 40 → indices 5..45 inclusive
    const lowestEligible = Math.ceil(scoredCount * MIN_FIRE_HOLD_COVERAGE);
    const result = evaluateTrackingRunEligibility(
      buildPayload({
        prepTicks: 5,
        scoredTicks: 40,
        metaOverrides: REQUIRE_FIRE,
        mutateTicks: fireFlags(5, lowestEligible - 1),
      }),
    );
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('insufficient-fire-hold-coverage');
  });

  it('ignores releases inside the prep window', () => {
    // Same boundary every other check uses: the participant has not pressed yet during centring.
    const result = evaluateTrackingRunEligibility(
      buildPayload({
        prepTicks: 5,
        scoredTicks: 40,
        metaOverrides: REQUIRE_FIRE,
        mutateTicks: (ticks) => {
          ticks.forEach((tick, i) => {
            tick.fire = i >= 5;
          });
        },
      }),
    );
    expect(result.status).toBe('eligible');
  });

  it('does not apply the rule to a run whose drill never declared requireFire', () => {
    // Every non-firing drill would otherwise compute 0% coverage and be rejected wholesale.
    const result = evaluateTrackingRunEligibility(
      buildPayload({ prepTicks: 5, scoredTicks: 40, mutateTicks: fireFlags(5, 0) }),
    );
    expect(result.status).toBe('eligible');
  });

  it('reports missing-fire-flag rather than zero coverage when the instrument recorded nothing', () => {
    // A pre-v2 recorder emits no `fire` key. Counting that as 0% would reject the run for
    // "the participant did not hold fire" when the truth is "it was never measured" (C-D3).
    const result = evaluateTrackingRunEligibility(buildPayload({ metaOverrides: REQUIRE_FIRE }));
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('missing-fire-flag');
    expect(result.reasons).not.toContain('insufficient-fire-hold-coverage');
  });

  it('does not let a single fire-released event void the run through the all-or-nothing rule', () => {
    // D-54.50 would be overridden by its own implementation if `fire-released` still routed
    // through `protocol-violation`; adequacy is decided by the coverage threshold alone.
    const result = evaluateTrackingRunEligibility(
      buildPayload({
        prepTicks: 5,
        scoredTicks: 40,
        metaOverrides: REQUIRE_FIRE,
        mutateTicks: fireFlags(5, 41),
        violationAtTick: 20,
        violationKind: 'fire-released',
      }),
    );
    expect(result.status).toBe('eligible');
  });

  it('still voids the run on the other violation kinds inside the scored window', () => {
    for (const kind of ['fire', 'ads', 'movement'] as const) {
      const result = evaluateTrackingRunEligibility(
        buildPayload({
          prepTicks: 5,
          scoredTicks: 40,
          metaOverrides: REQUIRE_FIRE,
          mutateTicks: fireFlags(5, 41),
          violationAtTick: 20,
          violationKind: kind,
        }),
      );
      expect(result.status, `kind=${kind}`).toBe('blocked');
      if (result.status !== 'blocked') continue;
      expect(result.reasons, `kind=${kind}`).toContain('protocol-violation');
    }
  });
});

describe('evaluateTrackingRunEligibility — protocol mismatch', () => {
  it('blocks when there is no scored_start event at all', () => {
    const payload = buildPayload({ omitScoredStart: true });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['missing-scored-start'] });
  });

  it('blocks on an unsupported schema version', () => {
    const payload = buildPayload({ metaOverrides: { schemaVersion: 1 as unknown as 2 } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unsupported-schema-version');
  });

  it('blocks when meta.spawn.trackingTrajectory is missing', () => {
    const payload = buildPayload({ metaOverrides: { spawn: { seed: 54000 } } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unrecognized-tracking-trajectory');
  });

  it('blocks when meta.spawn.trackingTrajectory.kind is unrecognized', () => {
    const payload = buildPayload({
      metaOverrides: { spawn: { seed: 54000, trackingTrajectory: { kind: 'legacy-static-v0' } } },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unrecognized-tracking-trajectory');
  });
});
