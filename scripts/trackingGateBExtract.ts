/**
 * WP-54 / T7 — turns exported pilot blocks into the per-run records Gate B's criteria consume.
 *
 * Kept apart from `trackingGateBAggregates.ts` so the criteria stay testable against literal
 * inputs. Everything here is glue over *shipped* implementations — `buildTrackingPilotEvidence()`
 * for eligibility and P0, layer 5 for B-1's ratio, layer 6 for B-3c's Δ. Nothing is re-derived
 * (C-D4), and nothing is read that the payload does not carry itself.
 */
import type { ExportPayload } from '../src/data/export.ts';
import { buildTrackingPilotEvidence } from '../src/pilot/trackingPilotEvidence.ts';
import { TRACKING_CORE_PR_PILOT_V1_CANDIDATES } from '../src/drill/tracking_core_pr_pilot_v1.ts';
import { trackingPilotBlockRole } from '../src/session/trackingPilotManifest.ts';
import { computeTrackingFrozenCrosshairRatio } from './trackingFrozenCrosshairRatio.ts';
import { computeTrackingTimeOnTaskSlope } from './trackingTimeOnTaskSlope.ts';
import type { TrackingGateBCellFamily, TrackingGateBRun } from './trackingGateBAggregates.ts';

/** `meta.session.sessionLabel` is written by `main.ts` as the manifest's counterbalance cell,
 * `tracking-pilot-v1:<participantId>:session-<index>` — the only place the seed family survives
 * into an export. Anything that does not end in `session-1` is treated as family A, because a
 * missing/foreign label means the run was not an alternate-seed session. */
const ALTERNATE_SESSION_SUFFIX = 'session-1';

const CORE_DRILL_IDS: ReadonlySet<string> = new Set(
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((config) => config.drillId),
);

export interface TrackingGateBExtractResult {
  readonly runs: readonly TrackingGateBRun[];
  /** Payloads whose `drillId` is not in the WP-54 registry — reported rather than silently
   * dropped, since a foreign payload in the batch usually means a wrong directory. */
  readonly unknownDrillIds: readonly string[];
}

export function extractTrackingGateBRuns(payloads: readonly ExportPayload[]): TrackingGateBExtractResult {
  // One evidence build over the whole batch, so eligibility and P0 come from the same shipped
  // aggregation the report uses — not a second pass with its own options.
  const evidence = buildTrackingPilotEvidence(payloads);
  const byRunId = new Map(
    evidence.conditions.flatMap((condition) => condition.runs.map((run) => [run.runId, run] as const)),
  );

  const runs: TrackingGateBRun[] = [];
  const unknownDrillIds: string[] = [];
  for (const payload of payloads) {
    const cellFamily = classify(payload.meta.drillId);
    if (cellFamily === undefined) {
      unknownDrillIds.push(payload.meta.drillId);
      continue;
    }
    // Practice is excluded from the evidence conditions by design (FR-54-5), so it has no run
    // entry; it is still emitted here and counted out by `aggregateTrackingGateB()`.
    const run = byRunId.get(`${payload.meta.drillId}@${payload.meta.startedAt}`);
    const p0 = run?.p0;
    const ratio = computeTrackingFrozenCrosshairRatio(payload);
    const slope = computeTrackingTimeOnTaskSlope(payload);

    runs.push({
      condition: payload.meta.drillId,
      participantId: payload.meta.session?.participantId ?? 'unknown',
      seedFamily: (payload.meta.session?.sessionLabel ?? '').endsWith(ALTERNATE_SESSION_SUFFIX) ? 'B' : 'A',
      cellFamily,
      eligible: run?.quality.status === 'eligible',
      acquisitionFailure: p0?.acquisitionFailure ?? false,
      ...(p0?.rmsEpsilonDeg !== undefined ? { rmsEpsilonDeg: p0.rmsEpsilonDeg } : {}),
      ...(p0?.totPercent !== undefined ? { totPercent: p0.totPercent } : {}),
      ...(ratio.status === 'ok' ? { frozenCrosshairRatio: ratio.ratio } : {}),
      ...(slope.status === 'ok' ? { timeOnTaskDeltaFraction: slope.deltaFraction } : {}),
      ...angularSize(payload),
      ...nominalSpeed(payload),
    });
  }

  return { runs, unknownDrillIds };
}

function classify(drillId: string): TrackingGateBCellFamily | undefined {
  let role: ReturnType<typeof trackingPilotBlockRole>;
  try {
    role = trackingPilotBlockRole(drillId);
  } catch {
    return undefined;
  }
  if (role === 'practice') return 'practice';
  if (role === 'calibration') return 'calibration';
  return CORE_DRILL_IDS.has(drillId) ? 'core' : 'reversal';
}

/**
 * Delivered angular size from the payload's own hitbox — the size axis of B-3a's 2×2. The hitbox
 * is a sphere of diameter `2 · d · tan(size/2)` at the 4u sight line (`analysis-tracking.md`
 * "刺激語意"), so this inverts that rather than trusting a label; `meta` carries no engagement
 * distance, so the pilot's fixed 4u is the reference, exactly as `targetHitboxWidthU` in the
 * compatibility key (D-54.41).
 */
function angularSize(payload: ExportPayload): { targetAngularSizeDeg?: number } {
  const widthU = payload.meta.targets?.hitbox?.widthU;
  if (widthU === undefined) return {};
  return { targetAngularSizeDeg: (2 * Math.atan(widthU / 2 / PILOT_SIGHT_LINE_U) * 180) / Math.PI };
}

/** Every WP-54 pilot block places the target on the same 4u sight line (T2 slice 5). */
const PILOT_SIGHT_LINE_U = 4;

function nominalSpeed(payload: ExportPayload): { nominalSpeedDegPerSec?: number } {
  const speed = payload.meta.spawn?.trackingTrajectory?.targetRmsSpeedDegPerSec;
  return typeof speed === 'number' ? { nominalSpeedDegPerSec: speed } : {};
}
