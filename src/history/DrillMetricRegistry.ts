import type { ExportPayload } from '../data/export.ts';
import { buildCompatibilityKey, checkQualityGate, type CompatibilityKey, type QualityGateStatus } from '../metrics/compatibilityKey.ts';
import { buildPeekWindows, type FireEvent } from '../metrics/peekWindows.ts';
import { buildPeekClickTransferV1ConditionCell } from '../metrics/peekClickTransferConditions.ts';
import { derivePeekClickTransferMetrics } from '../metrics/peekClickTransferMetrics.ts';
import { deriveSpiderShotMetrics } from '../metrics/spiderShotMetrics.ts';
import {
  SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V2,
  SPIDER_SHOT_HITBOX_V2,
  spiderShotV2,
} from '../drill/spider_shot_v2.ts';
import { peekClickTransferV1, PEEK_CLICK_TRANSFER_V1_VISIBILITY } from '../drill/peek_click_transfer_v1.ts';
import { peekAdCorridor } from '../scene/scenes/peek-ad-corridor.ts';

/**
 * WP-49 T4 — exact-`drillId` history metric registry (README §2.5). `spider-shot-v2` is registered
 * (D-49.P9, research-design owner sign-off:
 * `docs/algorithm/spider_shot/spider-shot-v2-performance-metrics-design-2026-08-27.html`
 * §registry "第一版歷史趨勢指標"). `peek_click_transfer_v1` is also registered but is a **WP-53 / GD-28
 * placeholder scaffold** — the WP-53 formal freeze decision has not happened yet (real-human pilot
 * evidence is still pending), so its descriptors/primary-metric choice follow OQ-53-3's stated
 * default rather than a research sign-off, and its condition cell reads provisional config values
 * (see `peek_click_transfer_v1.ts`). No prefix/family fallback for either registration: an
 * unregistered drill id — including near-miss variants like `spider-shot-v2-alt` or any
 * `peek_click_transfer_pilot_*` id — always projects as `unregistered-drill`.
 */

export interface MetricDescriptor {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly direction: 'higher-is-better' | 'lower-is-better' | 'neutral';
  readonly primary: boolean;
  readonly format: 'integer' | 'decimal-1' | 'decimal-2' | 'percent';
}

export interface MetricObservation {
  readonly metricId: string;
  readonly unit: string;
  readonly value: number;
}

export type TrendCompatibilityKey = Omit<CompatibilityKey, 'qualityGateStatus'>;

/** Quality status is an eligibility gate (FR-49.9), not part of cohort identity — a suspect run
 * must not be treated as a different "condition" from an otherwise-identical ok run. */
export function toTrendCompatibilityKey(key: CompatibilityKey): TrendCompatibilityKey {
  const { qualityGateStatus: _qualityGateStatus, ...rest } = key;
  return rest;
}

export interface DrillMetricRegistration {
  readonly drillId: string;
  readonly label?: string;
  readonly version: string;
  readonly descriptors: readonly MetricDescriptor[];
  project(payload: ExportPayload): readonly MetricObservation[];
}

export interface DrillMetricRegistry {
  registrationForExactDrill(drillId: string): DrillMetricRegistration | undefined;
  project(payload: ExportPayload): HistoryProjectionResult;
}

export type HistoryProjectionResult =
  | {
      readonly status: 'ready';
      readonly compatibilityKey: CompatibilityKey;
      readonly qualityGateStatus: QualityGateStatus;
      readonly observations: readonly MetricObservation[];
    }
  | { readonly status: 'unregistered-drill'; readonly drillId: string }
  | { readonly status: 'invalid-metric'; readonly reasonCode: string };

// ---------------------------------------------------------------------------
// spider-shot-v2 registration
// ---------------------------------------------------------------------------

const SPIDER_SHOT_V2_REGISTRY_VERSION = '1.0.0';

const SPIDER_SHOT_V2_DESCRIPTORS: readonly MetricDescriptor[] = [
  {
    id: 'spider-v2.peripheral-hits-per-minute',
    label: '周邊有效命中速度',
    unit: 'hits/min',
    direction: 'higher-is-better',
    primary: true,
    format: 'decimal-1',
  },
  {
    id: 'spider-v2.peripheral-first-shot-hit-rate',
    label: '周邊首發命中率',
    unit: '%',
    direction: 'higher-is-better',
    primary: false,
    format: 'percent',
  },
  {
    id: 'spider-v2.median-peripheral-hit-time-ms',
    label: '周邊命中時間中位數',
    unit: 'ms',
    direction: 'lower-is-better',
    primary: false,
    format: 'decimal-1',
  },
  {
    id: 'spider-v2.median-fire-angle-error-deg',
    label: '首發角度誤差中位數',
    unit: 'deg',
    direction: 'lower-is-better',
    primary: false,
    format: 'decimal-2',
  },
  {
    id: 'spider-v2.median-overshoot-deg',
    label: '進靶後逸出角度中位數',
    unit: 'deg',
    direction: 'lower-is-better',
    primary: false,
    format: 'decimal-2',
  },
] as const;

/** Session-level condition cell (design doc §contract) — one stable identity per protocol
 * configuration, not the per-transition `spider:d=...;w=...` cell used by the frozen
 * `deriveSpiderShotTransitions()` construct. Derived once from the exact-frozen drill config so it
 * has a single geometric source (GD-7) instead of a second hardcoded literal; any config change
 * requires a registry version bump alongside it (task discipline #4). */
function buildSpiderShotV2ConditionCell(): string {
  const [minDeg, maxDeg] = SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V2;
  const grid = spiderShotV2.spiderShot?.kind === 'center-peripheral-stratified' ? spiderShotV2.spiderShot.grid : undefined;
  if (grid === undefined) throw new Error('spider-shot-v2 registration requires a stratified grid config');
  const timeoutMs = spiderShotV2.timing.peekTimeoutMs;
  if (timeoutMs === undefined) throw new Error('spider-shot-v2 registration requires timing.peekTimeoutMs');
  if (spiderShotV2.endCondition.type !== 'timeLimit') {
    throw new Error('spider-shot-v2 registration requires a timeLimit endCondition');
  }
  const durationS = spiderShotV2.endCondition.value / 1000;
  const widthDeg = (2 * Math.atan(SPIDER_SHOT_HITBOX_V2.widthU / 2 / spiderShotV2.targets.distance) * 180) / Math.PI;
  const shape = SPIDER_SHOT_HITBOX_V2.shape ?? 'box';
  return `spider-v2:radius=${minDeg}-${maxDeg}deg;width=${roundTo(widthDeg, 1)}deg;grid=${grid.azimuthQuadrants}x${grid.radiusTiers};timeout=${timeoutMs}ms;duration=${durationS}s;shape=${shape}`;
}

const SPIDER_SHOT_V2_CONDITION_CELL = buildSpiderShotV2ConditionCell();

function projectSpiderShotV2(payload: ExportPayload): readonly MetricObservation[] {
  const windows = buildPeekWindows(payload);
  const peripheralWindows = windows.filter((w) => w.visible.zone === 'peripheral');
  const observations: MetricObservation[] = [];

  const durationMs = validDurationMs(payload);
  if (durationMs !== undefined) {
    const peripheralHitCount = peripheralWindows.filter((w) => w.outcome === 'hit').length;
    observations.push({
      metricId: 'spider-v2.peripheral-hits-per-minute',
      unit: 'hits/min',
      value: (60000 * peripheralHitCount) / durationMs,
    });
  }

  if (peripheralWindows.length > 0) {
    const hitShotSeqs = buildHitShotSeqs(payload);
    const firstShotHitCount = peripheralWindows.filter(
      (w) => w.firstFire !== undefined && fireHitOutcome(w.firstFire, hitShotSeqs),
    ).length;
    observations.push({
      metricId: 'spider-v2.peripheral-first-shot-hit-rate',
      unit: '%',
      value: (100 * firstShotHitCount) / peripheralWindows.length,
    });
  }

  const hitTimes = peripheralWindows
    .filter((w): w is typeof w & { tHit: number } => w.outcome === 'hit' && w.tHit !== undefined)
    .map((w) => w.tHit - w.tVisible);
  const medianHitTime = median(hitTimes);
  if (medianHitTime !== undefined) {
    observations.push({ metricId: 'spider-v2.median-peripheral-hit-time-ms', unit: 'ms', value: medianHitTime });
  }

  const spiderMetrics = deriveSpiderShotMetrics(payload);
  const fireAngleErrors = spiderMetrics.firstShot
    .map((entry) => entry.fireAngleErrorDeg)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const medianFireAngleError = median(fireAngleErrors);
  if (medianFireAngleError !== undefined) {
    observations.push({ metricId: 'spider-v2.median-fire-angle-error-deg', unit: 'deg', value: medianFireAngleError });
  }

  const overshoots = spiderMetrics.stopControl
    .map((entry) => entry.overshootDeg)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const medianOvershoot = median(overshoots);
  if (medianOvershoot !== undefined) {
    observations.push({ metricId: 'spider-v2.median-overshoot-deg', unit: 'deg', value: medianOvershoot });
  }

  return observations;
}

const SPIDER_SHOT_V2_REGISTRATION: DrillMetricRegistration = {
  drillId: spiderShotV2.drillId,
  label: 'Spider Shot v2',
  version: SPIDER_SHOT_V2_REGISTRY_VERSION,
  descriptors: SPIDER_SHOT_V2_DESCRIPTORS,
  project: projectSpiderShotV2,
};

// ---------------------------------------------------------------------------
// peek_click_transfer_v1 registration — WP-53 / T3, GD-28 placeholder scaffold (see file header)
// ---------------------------------------------------------------------------

const PEEK_CLICK_TRANSFER_V1_REGISTRY_VERSION = '0.1.0-provisional';

/** Primary-metric choice follows OQ-53-3's stated default (validFirstShotRate + median
 * onsetToHitMs); not a research sign-off — revisit once WP-53 T0 actually freezes. */
const PEEK_CLICK_TRANSFER_V1_DESCRIPTORS: readonly MetricDescriptor[] = [
  {
    id: 'peek-click-transfer-v1.valid-first-shot-rate',
    label: '有效首發命中率',
    unit: '%',
    direction: 'higher-is-better',
    primary: true,
    format: 'percent',
  },
  {
    id: 'peek-click-transfer-v1.median-onset-to-hit-ms',
    label: '曝光起算命中時間中位數',
    unit: 'ms',
    direction: 'lower-is-better',
    primary: true,
    format: 'decimal-1',
  },
  {
    id: 'peek-click-transfer-v1.first-shot-hit-rate',
    label: '首發命中率',
    unit: '%',
    direction: 'higher-is-better',
    primary: false,
    format: 'percent',
  },
  {
    id: 'peek-click-transfer-v1.fire-before-gate-rate',
    label: '制動未完成即開火率',
    unit: '%',
    direction: 'lower-is-better',
    primary: false,
    format: 'percent',
  },
] as const;

function projectPeekClickTransferV1(payload: ExportPayload): readonly MetricObservation[] {
  const metrics = derivePeekClickTransferMetrics(payload, peekAdCorridor, PEEK_CLICK_TRANSFER_V1_VISIBILITY);
  const observations: MetricObservation[] = [
    { metricId: 'peek-click-transfer-v1.valid-first-shot-rate', unit: '%', value: 100 * metrics.validFirstShotRate },
    { metricId: 'peek-click-transfer-v1.first-shot-hit-rate', unit: '%', value: 100 * metrics.firstShotHitRate },
    { metricId: 'peek-click-transfer-v1.fire-before-gate-rate', unit: '%', value: 100 * metrics.fireBeforeGateRate },
  ];

  const onsetToHitTimes = metrics.presentations
    .map((presentation) => presentation.onsetToHitMs)
    .filter((value): value is number => value !== undefined);
  const medianOnsetToHit = median(onsetToHitTimes);
  if (medianOnsetToHit !== undefined) {
    observations.push({ metricId: 'peek-click-transfer-v1.median-onset-to-hit-ms', unit: 'ms', value: medianOnsetToHit });
  }

  return observations;
}

const PEEK_CLICK_TRANSFER_V1_REGISTRATION: DrillMetricRegistration = {
  drillId: peekClickTransferV1.drill.drillId,
  label: 'Peek-click Transfer v1',
  version: PEEK_CLICK_TRANSFER_V1_REGISTRY_VERSION,
  descriptors: PEEK_CLICK_TRANSFER_V1_DESCRIPTORS,
  project: projectPeekClickTransferV1,
};

const REGISTRATIONS: readonly DrillMetricRegistration[] = [SPIDER_SHOT_V2_REGISTRATION, PEEK_CLICK_TRANSFER_V1_REGISTRATION];

function targetConditionCellForRegistration(drillId: string): string {
  if (drillId === spiderShotV2.drillId) return SPIDER_SHOT_V2_CONDITION_CELL;
  if (drillId === peekClickTransferV1.drill.drillId) return buildPeekClickTransferV1ConditionCell();
  throw new Error(`no target condition cell configured for drill ${drillId}`);
}

// ---------------------------------------------------------------------------
// Registry factory
// ---------------------------------------------------------------------------

export function createDrillMetricRegistry(): DrillMetricRegistry {
  const byDrillId = new Map(REGISTRATIONS.map((registration) => [registration.drillId, registration]));

  function registrationForExactDrill(drillId: string): DrillMetricRegistration | undefined {
    return byDrillId.get(drillId);
  }

  function project(payload: ExportPayload): HistoryProjectionResult {
    const registration = registrationForExactDrill(payload.meta.drillId);
    if (registration === undefined) return { status: 'unregistered-drill', drillId: payload.meta.drillId };

    // Defense-in-depth (FM-49.3): the repository already refuses to archive Practice runs, but a
    // stale/malicious API response must not be trusted to have enforced that.
    if (payload.meta.assessment === undefined) {
      return { status: 'invalid-metric', reasonCode: 'not-assessment' };
    }

    try {
      const qualityGateStatus = qualityGateStatusForPayload(payload);
      const compatibilityKey = buildCompatibilityKey(
        payload.meta,
        registration.drillId,
        targetConditionCellForRegistration(registration.drillId),
        qualityGateStatus,
      );
      const observations = registration.project(payload);
      for (const observation of observations) {
        const descriptor = registration.descriptors.find((candidate) => candidate.id === observation.metricId);
        if (descriptor === undefined) return { status: 'invalid-metric', reasonCode: 'unknown-metric-id' };
        if (descriptor.unit !== observation.unit) return { status: 'invalid-metric', reasonCode: 'unit-mismatch' };
        if (!Number.isFinite(observation.value)) return { status: 'invalid-metric', reasonCode: 'non-finite-value' };
      }
      return { status: 'ready', compatibilityKey, qualityGateStatus, observations };
    } catch {
      return { status: 'invalid-metric', reasonCode: 'projection-failed' };
    }
  }

  return { registrationForExactDrill, project };
}

// ---------------------------------------------------------------------------
// Shared helpers (small, local re-derivations of canonical patterns already used elsewhere —
// `compute.ts`'s `fireHitOutcome`/`buildHitShotSeqs` and `sessionHistory.ts`'s `median` are private
// to those modules, so this mirrors their exact semantics rather than inventing a second one)
// ---------------------------------------------------------------------------

function validDurationMs(payload: ExportPayload): number | undefined {
  if (payload.ticks.length < 2) return undefined;
  const sorted = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const duration = sorted[sorted.length - 1].t - sorted[0].t;
  return duration > 0 ? duration : undefined;
}

function qualityGateStatusForPayload(payload: ExportPayload): QualityGateStatus {
  const visibleSampleCount = payload.events.filter((event) => event.type === 'visible').length;
  return checkQualityGate({ n: visibleSampleCount, minN: 1, suspect: payload.meta.suspect, compatible: true });
}

function buildHitShotSeqs(payload: ExportPayload): ReadonlySet<number> {
  const shotSeqs = new Set<number>();
  for (const event of payload.events) {
    if (event.type === 'hit') shotSeqs.add(event.shotSeq);
  }
  return shotSeqs;
}

/** Directly verifies the fire's own hit outcome — never `PeekWindowTs.outcome`, which is `'hit'` if
 * ANY fire in the window (including a corrective spray after a missed first shot) hit. That
 * distinction is exactly the risk the metric design doc flags: "現行 firstShot.hit 使用整個 window
 * 的 outcome；若第一發 miss、後續 fire 命中，可能仍被標為 hit". */
function fireHitOutcome(fire: FireEvent, hitShotSeqs: ReadonlySet<number>): boolean {
  return fire.hit || (fire.shotSeq !== undefined && hitShotSeqs.has(fire.shotSeq));
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
