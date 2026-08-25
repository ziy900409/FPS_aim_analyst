import type { QualityGateStatus } from './compatibilityKey.ts';
import type { CounterstrafeMetrics, SidedStat } from './counterstrafeMetrics.ts';
import type { HoldClickMetrics, HoldClickPresentationMetrics } from './holdClickMetrics.ts';
import type { SpiderShotMetrics } from './spiderShotMetrics.ts';

/** A diagnosis is intentionally a training direction, never a composite ability score. */
export type DiagnosisLabel =
  | 'preaim-placement'
  | 'visual-motor-onset'
  | 'flick-control'
  | 'click-timing'
  | 'tracking-maintenance'
  | 'counterstrafe-braking'
  | 'fire-commitment';

export interface DiagnosisEvidence {
  readonly metricId: string;
  readonly value: number;
  readonly n: number;
  readonly flags: readonly string[];
}

export interface DiagnosisFinding {
  readonly label: DiagnosisLabel;
  readonly evidence: readonly DiagnosisEvidence[];
  readonly nextTrainingDirection: string;
}

export type DiagnosisResult =
  | {
      readonly status: 'ok';
      readonly primary?: DiagnosisFinding;
      readonly secondary?: DiagnosisFinding;
      readonly recommendationVersion: string;
    }
  | { readonly status: 'insufficient-data'; readonly reason: string };

/**
 * Pilot-only candidate thresholds. These are injected into evaluateDiagnosis so that a future
 * calibrated version can be evaluated without rewriting historical conclusions.
 */
export interface DiagnosisThresholds {
  readonly version: string;
  readonly preAimHighDeg: number;
  readonly onsetSlowMs: number;
  readonly acquisitionSlowMs: number;
  readonly overshootHighDeg: number;
  readonly firstShotSlowMs: number;
  readonly totLowPercent: number;
  readonly residualSpeedHighUPerS: number;
  readonly fireCommitmentSlowMs: number;
}

export interface HoldTrackSummary {
  readonly totPercent: number;
  readonly dropCount: number;
}

export interface DiagnosisInputs {
  readonly holdClick?: HoldClickMetrics;
  readonly holdTrack?: HoldTrackSummary;
  readonly spiderShot?: SpiderShotMetrics;
  readonly counterstrafe?: CounterstrafeMetrics;
}

/**
 * Candidate values only; WP-39's calibration pilot must replace these with a versioned,
 * pre-registered set before they are used for athlete-facing conclusions.
 */
export const PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS: DiagnosisThresholds = {
  version: 'recommendation-pilot-candidate-v1',
  preAimHighDeg: 2,
  onsetSlowMs: 250,
  acquisitionSlowMs: 300,
  overshootHighDeg: 2,
  firstShotSlowMs: 150,
  totLowPercent: 70,
  residualSpeedHighUPerS: 100,
  fireCommitmentSlowMs: 250,
};

const TRAINING_DIRECTIONS: Readonly<Record<DiagnosisLabel, string>> = {
  'preaim-placement': '架槍線與弱側位置校準',
  'visual-motor-onset': '隨機 foreperiod 出現偵測',
  'flick-control': '降速 Spider Shot、一次乾淨停止',
  'click-timing': '首次進靶後開火控制',
  'tracking-maintenance': '固定速度持續控制',
  'counterstrafe-braking': '反向制動，不提高瞄準難度',
  'fire-commitment': 'gate 後快速首發',
};

type NumericSample = { readonly value: number; readonly flags: readonly string[] };

interface Aggregate {
  readonly value: number;
  readonly n: number;
  readonly flags: readonly string[];
}

/**
 * Applies the framework-v1 evidence table in its published order. A matched evidence chain is a
 * hard exclusion for all later chains, so one session receives one deterministic primary finding
 * and no duplicate secondary label.
 */
export function evaluateDiagnosis(
  inputs: DiagnosisInputs,
  thresholds: DiagnosisThresholds,
  qualityGateStatus: QualityGateStatus,
): DiagnosisResult {
  if (qualityGateStatus !== 'ok') {
    return { status: 'insufficient-data', reason: `quality gate status: ${qualityGateStatus}` };
  }

  const preAim = aggregatePresentationMetric(inputs.holdClick?.presentations, (presentation) => presentation.preAim?.eccentricityDeg);
  const holdOnset = aggregatePresentationMetric(inputs.holdClick?.presentations, (presentation) => presentation.detectionLatencyFromOnsetMs);
  const spiderOnset = aggregateSpiderMetric(inputs.spiderShot?.switchReaction, (metric) => metric.reactionMs);
  const holdAcquisition = aggregatePresentationMetric(inputs.holdClick?.presentations, (presentation) => presentation.acquisitionFromDetectMs);
  const spiderAcquisition = aggregateSpiderMetric(inputs.spiderShot?.movementExecution, (metric) => metric.movementTimeMs);
  const firstShot = aggregatePresentationMetric(inputs.holdClick?.presentations, (presentation) => presentation.firstShotAfterOnTargetMs);
  const overshoot = aggregateSpiderMetric(inputs.spiderShot?.stopControl, (metric) => metric.overshootDeg);
  const counterOverReversal = aggregateSidedMetric(inputs.counterstrafe?.overReversalUPerS);
  const counterToFire = aggregateSidedMetric(inputs.counterstrafe?.counterToFireMs);
  const accuracyGate = aggregateSidedMetric(inputs.counterstrafe?.timeToAccuracyGateMs);

  const preAimEvidence = evidence('hold-click.pre-aim-eccentricity-deg', preAim);
  const onsetEvidence =
    evidence('hold-click.detection-latency-from-onset-ms', holdOnset) ??
    evidence('spider-shot.switch-reaction-ms', spiderOnset);
  const acquisitionEvidence =
    evidence('hold-click.acquisition-from-detect-ms', holdAcquisition) ??
    evidence('spider-shot.movement-execution-ms', spiderAcquisition);
  const firstShotEvidence = evidence('hold-click.first-shot-after-on-target-ms', firstShot);
  const overshootEvidence = evidence('spider-shot.stop-control-overshoot-deg', overshoot);
  const totEvidence = evidence('hold-track.tot-percent', aggregateScalar(inputs.holdTrack?.totPercent));
  const dropsEvidence = evidence('hold-track.drop-count', aggregateScalar(inputs.holdTrack?.dropCount));
  const overReversalEvidence = evidence('counterstrafe.over-reversal-u-per-s', counterOverReversal);
  const counterToFireEvidence = evidence('counterstrafe.counter-to-fire-ms', counterToFire);
  const accuracyGateEvidence = evidence('counterstrafe.time-to-accuracy-gate-ms', accuracyGate);

  const preAimValue = valueOf(preAimEvidence);
  const onsetValue = valueOf(onsetEvidence);
  const acquisitionValue = valueOf(acquisitionEvidence);
  const firstShotValue = valueOf(firstShotEvidence);
  const overshootValue = valueOf(overshootEvidence);
  const totValue = valueOf(totEvidence);
  const overReversalValue = valueOf(overReversalEvidence);
  const counterToFireValue = valueOf(counterToFireEvidence);
  const accuracyGateValue = valueOf(accuracyGateEvidence);

  const firstMatch =
    match('preaim-placement', [preAimEvidence, onsetEvidence], preAimValue > thresholds.preAimHighDeg && onsetValue <= thresholds.onsetSlowMs) ??
    match('visual-motor-onset', [preAimEvidence, onsetEvidence], preAimValue <= thresholds.preAimHighDeg && onsetValue > thresholds.onsetSlowMs) ??
    match(
      'flick-control',
      [onsetEvidence, acquisitionEvidence, overshootEvidence],
      onsetValue <= thresholds.onsetSlowMs &&
        acquisitionValue > thresholds.acquisitionSlowMs &&
        overshootValue > thresholds.overshootHighDeg,
    ) ??
    match(
      'click-timing',
      [acquisitionEvidence, firstShotEvidence],
      acquisitionValue <= thresholds.acquisitionSlowMs && firstShotValue > thresholds.firstShotSlowMs,
    ) ??
    match(
      'tracking-maintenance',
      [acquisitionEvidence, totEvidence, dropsEvidence],
      acquisitionValue <= thresholds.acquisitionSlowMs && totValue < thresholds.totLowPercent,
    ) ??
    match(
      'counterstrafe-braking',
      [overReversalEvidence],
      overReversalValue > thresholds.residualSpeedHighUPerS,
    ) ??
    match(
      'fire-commitment',
      [overReversalEvidence, accuracyGateEvidence, counterToFireEvidence],
      overReversalValue <= thresholds.residualSpeedHighUPerS &&
        accuracyGateValue <= thresholds.fireCommitmentSlowMs &&
        counterToFireValue > thresholds.fireCommitmentSlowMs,
    );

  return {
    status: 'ok',
    recommendationVersion: thresholds.version,
    ...(firstMatch === undefined ? {} : { primary: firstMatch }),
  };
}

function match(label: DiagnosisLabel, evidenceItems: readonly (DiagnosisEvidence | undefined)[], condition: boolean): DiagnosisFinding | undefined {
  if (!condition || evidenceItems.some((item) => item === undefined)) return undefined;
  return {
    label,
    evidence: evidenceItems.filter((item): item is DiagnosisEvidence => item !== undefined),
    nextTrainingDirection: TRAINING_DIRECTIONS[label],
  };
}

function evidence(metricId: string, aggregate: Aggregate | undefined): DiagnosisEvidence | undefined {
  return aggregate === undefined ? undefined : { metricId, ...aggregate };
}

function valueOf(evidenceItem: DiagnosisEvidence | undefined): number {
  return evidenceItem?.value ?? Number.NaN;
}

function aggregatePresentationMetric(
  presentations: readonly HoldClickPresentationMetrics[] | undefined,
  selector: (presentation: HoldClickPresentationMetrics) => number | undefined,
): Aggregate | undefined {
  return aggregate((presentations ?? []).map((presentation) => ({ value: selector(presentation), flags: presentation.flags })));
}

function aggregateSpiderMetric<T>(
  metrics: readonly T[] | undefined,
  selector: (metric: T) => number | undefined,
): Aggregate | undefined {
  return aggregate((metrics ?? []).map((metric) => ({ value: selector(metric), flags: [] })));
}

function aggregateSidedMetric(stat: SidedStat | undefined): Aggregate | undefined {
  if (stat === undefined) return undefined;
  const sides = [stat.left, stat.right].filter((side) => side.n > 0 && Number.isFinite(side.mean));
  const n = sides.reduce((sum, side) => sum + side.n, 0);
  if (n === 0) return undefined;
  return {
    value: sides.reduce((sum, side) => sum + side.mean * side.n, 0) / n,
    n,
    flags: [],
  };
}

function aggregateScalar(value: number | undefined): Aggregate | undefined {
  return aggregate(value === undefined ? [] : [{ value, flags: [] }]);
}

function aggregate(samples: readonly { readonly value: number | undefined; readonly flags: readonly string[] }[]): Aggregate | undefined {
  const valid = samples.filter((sample): sample is NumericSample => sample.value !== undefined && Number.isFinite(sample.value));
  if (valid.length === 0) return undefined;
  return {
    value: valid.reduce((sum, sample) => sum + sample.value, 0) / valid.length,
    n: valid.length,
    flags: [...new Set(valid.flatMap((sample) => sample.flags))],
  };
}
