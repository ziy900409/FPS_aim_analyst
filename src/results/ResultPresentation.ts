/**
 * WP-49 T3 — pure payload→presentation domain (README §2.8). Extracted from `main.ts` so the
 * current in-session Result and a historical Assessment Result compute metrics/diagnosis/quality
 * flags through the exact same rules (D-49.P4). No DOM, filesystem, `HistoryClient`, or wall-clock
 * read here (`performance.now()`/`Date.now()` included) — everything is a pure function of the
 * `ExportPayload` passed in.
 */

import { CS2_PROFILE } from '../sim/MovementController.ts';
import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import { computeMetrics, type Metrics, type CompensationError, type RecoilCompensationPath, type Stat } from '../metrics/compute.ts';
import { computePromotedMetrics, type PromotedMetrics } from '../metrics/researchMetrics.ts';
import { checkQualityGate, type QualityGateStatus } from '../metrics/compatibilityKey.ts';
import {
  evaluateDiagnosis,
  DIAGNOSIS_THRESHOLDS_V1,
  type DiagnosisInputs,
  type DiagnosisResult,
} from '../metrics/diagnosisRules.ts';
import { deriveHoldClickMetrics } from '../metrics/holdClickMetrics.ts';
import { deriveTrackingMetrics } from '../metrics/trackingDerivation.ts';
import { resolveTargetHitbox } from '../drill/DrillConfig.ts';
import { HOLD_CLICK_ONSET_THRESHOLD, HOLD_CLICK_VISIBILITY_SAMPLE_COUNT, holdClickV1 } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { placeholderRoom } from '../scene/scenes/placeholder-room.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import { urbanHigh } from '../scene/scenes/urban-high.ts';
import { brField } from '../scene/scenes/br-field.ts';
import { peekCorridor } from '../scene/scenes/peek-corridor.ts';
import { peekAdCorridor } from '../scene/scenes/peek-ad-corridor.ts';

// ---------------------------------------------------------------------------
// View-model shapes shared by the current and historical Result presentation
// (README §2.8). `ResultDetailBody.ts` renders these; nothing here touches the DOM.
// ---------------------------------------------------------------------------

export interface ResultCard {
  id: string;
  title: string;
  value: string;
  detail: string;
  meta?: string;
}

export interface RecoilCompensationSummary {
  error: CompensationError;
  path: RecoilCompensationPath;
}

export interface ResultSummary {
  cards: ResultCard[];
  reactionValues: number[];
  recoilCompensation: RecoilCompensationSummary;
  methodNote: string;
}

export interface QualityFlagsInput {
  readonly lateEventCount: number;
  readonly bufferOverflow: boolean;
  readonly recorderOverflow: boolean;
  readonly suspect: boolean;
  readonly validity?: {
    readonly corridorExceeded: boolean;
    readonly perfFloor: boolean;
  };
}

/** Current in-session Result and a historical Assessment Result both render from this same shape
 * (D-49.P4) — `ResultDetailBody.createResultDetailBody().render()` is the single consumer. */
export interface ResultPresentation {
  readonly summary: ResultSummary;
  readonly promoted?: PromotedMetrics;
  readonly diagnosis?: DiagnosisResult;
  readonly qualityFlags?: QualityFlagsInput;
}

// ---------------------------------------------------------------------------
// Metrics/diagnosis/quality-flags pipeline (moved from `main.ts` — T0 extraction spike,
// WP-49 progress.md D-49 T0 entry). Every exact-drill branch below mirrors the pre-T3 mapping
// verbatim; nothing here changes hold-click/hold-track diagnosis semantics.
// ---------------------------------------------------------------------------

/** Static registry of every scene the app knows about, keyed by `sceneId` — mirrors `main.ts`'s
 * `availableScenes` UI list but without the live "currently selected scene" concept: a *historical*
 * payload's scene must resolve from the payload alone, never from whatever scene happens to be
 * active in the live session right now. `field-low` is the app's own default (`activeSceneConfig`'s
 * initial value) so the fallback below matches prior in-session behavior for payloads produced
 * before per-export `meta.scene` existed. */
const KNOWN_SCENES: readonly SceneConfig[] = [placeholderRoom, fieldLow, urbanHigh, brField, peekCorridor, peekAdCorridor];

function sceneForPayload(payload: ExportPayload): SceneConfig {
  const sceneId = payload.meta.scene?.sceneId;
  return KNOWN_SCENES.find((candidate) => candidate.sceneId === sceneId) ?? fieldLow;
}

function targetHitboxFromMeta(payload: ExportPayload): { width: number; height: number; depth: number } {
  const hitbox = payload.meta.targets?.hitbox;
  return hitbox === undefined
    ? resolveTargetHitbox()
    : { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU };
}

function qualityGateStatusFor(payload: ExportPayload): QualityGateStatus {
  const visibleSampleCount = payload.events.filter((event) => event.type === 'visible').length;
  return checkQualityGate({ n: visibleSampleCount, minN: 1, suspect: payload.meta.suspect, compatible: true });
}

function average(values: readonly number[]): number {
  if (values.length === 0) throw new Error('No finite samples are available for this history metric');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function diagnosisInputsForPayload(payload: ExportPayload): DiagnosisInputs {
  const trackingOptions = payload.meta.targets === undefined ? {} : { hitbox: targetHitboxFromMeta(payload) };
  if (payload.meta.drillId === holdClickV1.drill.drillId) {
    const scene = sceneForPayload(payload);
    return {
      holdClick: deriveHoldClickMetrics(payload, scene, {
        sampleCount: HOLD_CLICK_VISIBILITY_SAMPLE_COUNT,
        onsetThreshold: HOLD_CLICK_ONSET_THRESHOLD,
        ...trackingOptions,
      }),
    };
  }
  if (payload.meta.drillId === holdTrackV1.drill.drillId) {
    const tracking = deriveTrackingMetrics(payload, trackingOptions);
    const totValues = tracking.presentations.flatMap((presentation) =>
      presentation.totPercent === undefined ? [] : [presentation.totPercent],
    );
    return {
      holdTrack: {
        totPercent: average(totValues),
        dropCount: 0,
      },
    };
  }
  return {};
}

/** Moved verbatim from `main.ts` (T0 extraction spike) — shared by the current in-session Result
 * and every historical Assessment Result (D-49.P4). Unregistered drills fall through to `{}`
 * inputs, which `evaluateDiagnosis` reports as insufficient-data rather than throwing. */
export function diagnosisForPayload(payload: ExportPayload): DiagnosisResult {
  return evaluateDiagnosis(diagnosisInputsForPayload(payload), DIAGNOSIS_THRESHOLDS_V1, qualityGateStatusFor(payload));
}

/** Moved verbatim from `main.ts` (T0 extraction spike). */
export function qualityFlagsForPayload(payload: ExportPayload): QualityFlagsInput {
  return {
    lateEventCount: payload.meta.lateEventCount,
    bufferOverflow: payload.meta.bufferOverflow,
    recorderOverflow: payload.meta.recorderOverflow,
    suspect: payload.meta.suspect,
    ...(payload.meta.validity === undefined
      ? {}
      : {
          validity: {
            corridorExceeded: payload.meta.validity.corridorExceeded,
            perfFloor: payload.meta.validity.perfFloor,
          },
        }),
  };
}

/** Moved verbatim from `main.ts` (T0 extraction spike). */
export function snapshotFromExportPayload(payload: ExportPayload): DataRecorderSnapshot {
  return {
    ticks: payload.ticks,
    events: payload.events,
    recorderOverflow: payload.meta.recorderOverflow,
  };
}

/** Moved from `main.ts` — the download basename rule current and historical downloads must share
 * so two different runs' JSON/CSV exports stay distinguishable by filename (T3 Steps §7). */
export function exportBasename(payload: ExportPayload): string {
  const protocol = payload.meta.protocol;
  const condition = protocol === undefined ? '' : `-${protocol.conditionIndex + 1}-${protocol.conditionLabel}`;
  return `${payload.meta.drillId}${condition}-${payload.meta.startedAt}`;
}

// ---------------------------------------------------------------------------
// Result summary view-model (moved from `ui/ResultScreen.ts`) — pure formatting only, no DOM.
// ---------------------------------------------------------------------------

function formatNumber(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : 'N/A';
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`;
}

function formatStatMean(stat: Stat, unit: string, decimals: number): string {
  return stat.n > 0 ? `${formatNumber(stat.mean, decimals)} ${unit}` : 'N/A';
}

function statCard(id: string, title: string, stat: Stat, unit: string, decimals: number): ResultCard {
  return {
    id,
    title,
    value: formatStatMean(stat, unit, decimals),
    detail: stat.n > 0 ? `SD ${formatNumber(stat.sd, decimals)} ${unit} · n=${stat.n}` : 'No samples',
  };
}

export function summarizeResidualSpeed(stat: Stat): { detail: string; withinGate: number; overGate: number } {
  const values = stat.values ?? [];
  if (values.length === 0) return { detail: 'No fire samples', withinGate: 0, overGate: 0 };

  let withinGate = 0;
  let overGate = 0;
  for (const value of values) {
    if (Math.abs(value) < CS2_PROFILE.accuracyThreshold) withinGate++;
    else overGate++;
  }

  const detail = `p50 ${formatNumber(stat.p50, 1)} u/s · SD ${formatNumber(stat.sd, 1)} u/s · n=${stat.n} · ${withinGate}/${values.length} under ${formatNumber(CS2_PROFILE.accuracyThreshold, 0)} u/s gate`;
  return { detail, withinGate, overGate };
}

export function createResultSummary(metrics: Metrics): ResultSummary {
  const residual = summarizeResidualSpeed(metrics.residualSpeed);
  return {
    methodNote: 'Subject-relative values only. Interpret changes within the same participant; display-latency error bounds still apply.',
    reactionValues: metrics.counterReactionMs.values ?? [],
    recoilCompensation: {
      error: metrics.recoilCompensationError,
      path: metrics.recoilCompensationPath,
    },
    cards: [
      statCard('counterReactionMs', 'Counter reaction', metrics.counterReactionMs, 'ms', 0),
      {
        id: 'residualSpeed',
        title: 'Residual speed / overshoot',
        value: formatStatMean(metrics.residualSpeed, 'u/s', 1),
        detail: residual.detail,
      },
      statCard('fireTimingAlignmentMs', 'Fire timing alignment', metrics.fireTimingAlignmentMs, 'ms', 0),
      {
        id: 'firstShotHitRate',
        title: 'First-shot hit rate',
        value: formatPercent(metrics.firstShotHitRate),
        detail: 'First-shot hits / visible peeks',
      },
      statCard('crosshairOffset', 'Crosshair offset', metrics.crosshairOffset, 'deg', 2),
      statCard('switchTimeMs', 'Switch time', metrics.switchTimeMs, 'ms', 0),
      {
        id: 'rhythmStability',
        title: 'Rhythm stability',
        value: formatNumber(metrics.rhythmStability, 3),
        detail: 'Cycle coefficient of variation',
      },
      {
        id: 'leftRightSymmetry',
        title: 'Left / right symmetry',
        value: metrics.leftRightSymmetry.left.n > 0 && metrics.leftRightSymmetry.right.n > 0
          ? `${formatNumber(metrics.leftRightSymmetry.diff, 0)} ms`
          : 'N/A',
        detail: `L ${formatStatMean(metrics.leftRightSymmetry.left, 'ms', 0)} · R ${formatStatMean(metrics.leftRightSymmetry.right, 'ms', 0)}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Assembly (README §2.8 `buildResultPresentation`) — the single entry point both the current
// in-session Result (`main.ts`) and every historical Result (`HistoryLibraryController.ts`) call.
// ---------------------------------------------------------------------------

export function buildResultPresentation(payload: ExportPayload): ResultPresentation {
  return {
    summary: createResultSummary(computeMetrics(snapshotFromExportPayload(payload))),
    promoted: computePromotedMetrics(payload),
    diagnosis: diagnosisForPayload(payload),
    qualityFlags: qualityFlagsForPayload(payload),
  };
}
