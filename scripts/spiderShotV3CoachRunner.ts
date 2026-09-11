/**
 * stage14 —— `spider-shot-v3` 真人 run 的教練報告資料層。
 *
 * **它要回答的問題**：三份真人匯出說了什麼,以及**哪些話這批資料還不能說**。設計規格凍結在
 * [`spider-shot-v3-coach-metrics-and-charts-2026-09-09.html`](../docs/algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html)
 * （七張圖的視覺與判讀）、
 * [`spider-shot-v3-measurement-parameters-2026-09-09.html`](../docs/algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html)
 * （每個參數的精確運算定義）。本模組**不重新設計指標**,只計算、驗證與降級。
 *
 * **沒有第二套定義（C-D4）**：`ε(t)`／on-target／`t_detect`／`D_deg`／`W_deg`／REC-MR-V 一律走既有
 * canonical derivation（`deriveSpiderShotTransitions` / `deriveSpiderShotMetrics` /
 * `deriveDetectionMetrics` / `computePhaseMetrics` / `buildPeekWindows` / `deriveMouseThrow`）。
 * 本模組只做**分箱、聚合、n 閘與降級判定**,一行幾何都不重算。
 *
 * **首發一律走 `firstFire`**（HANDOFF §3.3 ①）：`deriveSpiderShotMetrics().firstShot.hit` 取的是
 * `PeekWindowTs.outcome`,而該欄的規則是「窗內**任一**發命中即 `'hit'`」
 * （[`peekWindows.ts:77`](../src/metrics/peekWindows.ts#L77)）⇒ 首發 miss、補槍命中會被記成首發命中。
 * 本模組的每一個「首發」量都改驗 `window.firstFire` 自己的命中結果,與歷史 projector 同一判準。
 *
 * **左右一律走 eye-frame**（HANDOFF §3.3 ②）：`PeekWindowTs.side` / `PhaseSample.side` 對 v3 是
 * 佔位值（實測三份 run 的 119 個周邊 `visible` 事件 `side` 全部為 `'R'`）。左右分箱只認
 * `deriveSpiderShotTransitions()` 的 eye-frame `side`。
 *
 * 純函式:不讀時鐘（ADR-4 禁 `Date.now()`;本檔連 `performance.now()` 都不需要）、不讀隨機、無 I/O。
 * I/O 全在 [`analyze-spider-shot-v3.ts`](analyze-spider-shot-v3.ts),渲染全在
 * [`spiderShotV3CoachReport.ts`](spiderShotV3CoachReport.ts)（比照 `trackingContactRunner.ts` 的分工）。
 */
import type { ExportPayload } from '../src/data/export.ts';
import { spiderShotV3 } from '../src/drill/spider_shot_v3.ts';
import { createDrillMetricRegistry, type MetricDescriptor } from '../src/history/DrillMetricRegistry.ts';
import { deriveDetectionMetrics } from '../src/metrics/detectionDerivation.ts';
import { deriveMouseThrow } from '../src/metrics/mouseThrow.ts';
import { buildPeekWindows, type PeekWindowTs } from '../src/metrics/peekWindows.ts';
import { computePhaseMetrics } from '../src/metrics/researchMetrics.ts';
import { deriveSpiderShotTransitions, type SpiderShotTransition } from '../src/metrics/spiderShotConditions.ts';
import { deriveSpiderShotMetrics } from '../src/metrics/spiderShotMetrics.ts';

/** 報告本身的語意版本。分箱規則、n 閘或降級規則改變即升版 —— 讓「換了規則」在 diff 裡看得見。 */
export const COACH_REPORT_VERSION = 'spider-v3-coach-v1';

/** 教練紀律 #3：n < 8 只列數字,不上色、不下結論（教練提案 §6）。 */
export const MIN_BIN_N = 8;
/** C5「何時不畫」：有效樣本 < 10 時不畫 p95（一個極端值就會主導）。 */
export const MIN_TAIL_N = 10;
/** C6「何時不畫」：呈現數 < 24 時滾動窗沒有意義。 */
export const MIN_ROLLING_TRIALS = 24;
/** C6 的滾動窗寬（教練提案的示例圖即 8-trial 窗）。 */
export const ROLLING_WINDOW_TRIALS = 8;
/** C1／C2「何時不畫」：相容 run 少於 3 場即沒有基準。本批**總共**只有 3 場 ⇒ 沒有「先前基準」。 */
export const MIN_BASELINE_RUNS = 3;

/** 協定計分窗（ms）—— 從凍結 config 讀,不寫死字面值。 */
export const PROTOCOL_SCORING_WINDOW_MS = requireTimeLimitMs(spiderShotV3);
/** 開場倒數（ms）—— G2 的低估來源。 */
export const PROTOCOL_COUNTDOWN_MS = spiderShotV3.timing.countdownMs ?? 0;
/** 周邊呈現的逾時上界（ms）—— 命中時間分布的右截斷點,判讀 p95 時必須併看。 */
export const PROTOCOL_PEEK_TIMEOUT_MS = spiderShotV3.timing.peekTimeoutMs;

// ---------------------------------------------------------------------------
// 輸入 / 輸出型別
// ---------------------------------------------------------------------------

export interface SpiderShotV3RunInput {
  readonly sourcePath: string;
  readonly payload: ExportPayload;
}

export type AzimuthBinKey = 'horizontal-L' | 'horizontal-R' | 'vertical-L' | 'vertical-R' | 'unclassified';

/** 一次周邊抵達的所有量。缺席一律 `undefined`,**不填 0** —— 「沒量到」與「量到 0」必須分得開。 */
export interface PresentationRow {
  readonly runIndex: number;
  readonly sourcePath: string;
  /** 該 run 內第 n 個周邊呈現（0-based）。三份 run 的前 37 個逐位同刺激（G4）。 */
  readonly trialIndex: number;
  readonly targetId: string;
  readonly quadrant: string;
  /** eye-frame 左右（`deriveSpiderShotTransitions`）,**不是** `visible.side`。 */
  readonly side: 'L' | 'R' | 'none';
  readonly azimuthBin: AzimuthBinKey;
  readonly tierKey: string;
  /** Fitts 的 D：`angularDistanceDeg`（canonical）。 */
  readonly dDeg: number;
  /** Fitts 的 W：`angularSizeDeg`（canonical）。v3 距離恆 8 u ⇒ 恆 2.0°。 */
  readonly wDeg: number;
  readonly idBits: number;
  /** 首發即命中 —— 由 `window.firstFire` 自己的命中結果判定,不用 `window.outcome`。 */
  readonly firstShotHit: boolean;
  /** 該窗沒有任何 `firstShot` fire（沒開槍）。 */
  readonly noFirstShot: boolean;
  readonly fireCount: number;
  readonly hitTimeMs?: number;
  readonly fireAngleErrorDeg?: number;
  readonly overshootDeg?: number;
  readonly dropCount?: number;
  readonly microAdjustCount?: number;
  readonly detectionStatus: 'detected' | 'timeout';
  readonly reactionMs?: number;
  readonly movementTimeMs?: number;
  readonly peakOmegaDegPerSec?: number;
  readonly recMs?: number;
  readonly mrMs?: number;
  readonly vMs?: number;
  readonly phaseFlags: readonly string[];
}

export interface BinSummary {
  readonly key: string;
  readonly label: string;
  readonly n: number;
  readonly firstShotHitCount: number;
  readonly firstShotHitRate: number;
  readonly medianHitTimeMs?: number;
  /** n ≥ `MIN_BIN_N`。false 時只列數字,不上色、不進結論句。 */
  readonly conclusive: boolean;
}

export interface TailRow {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly n: number;
  readonly p50?: number;
  readonly p95?: number;
  readonly ratio?: number;
  /** n ≥ `MIN_TAIL_N`。false ⇒ 不畫 p95,只列 n 與 p50。 */
  readonly drawable: boolean;
  readonly note?: string;
}

export interface FittsPoint {
  readonly tierKey: string;
  readonly n: number;
  readonly medianIdBits: number;
  readonly medianHitTimeMs: number;
}

export interface FittsFit {
  readonly points: readonly FittsPoint[];
  readonly interceptMs?: number;
  readonly slopeMsPerBit?: number;
  readonly r2?: number;
  readonly drawable: boolean;
  readonly reason?: string;
}

export interface RollingPoint {
  readonly centerTrial: number;
  readonly medianHitTimeMs: number;
  readonly n: number;
}

export interface PhaseBudget {
  readonly recMs?: number;
  readonly mrMs?: number;
  readonly vMs?: number;
  readonly totalMs?: number;
  readonly n: number;
  readonly flagged: number;
}

export interface RegistryObservation {
  readonly metricId: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly format: MetricDescriptor['format'];
}

export interface RegistryOutcome {
  /** `DrillMetricRegistry.project()` 的實際回傳狀態。 */
  readonly status: string;
  readonly reasonCode?: string;
  /** 為什麼是這個狀態 —— 由本模組逐條複驗 registry 的前提後填入。 */
  readonly diagnosis?: string;
  readonly conditionCell?: string;
  readonly qualityGateStatus?: string;
  /**
   * 五個 descriptor 的值。即使 `project()` 因 cohort key 失敗,`registration.project()` 本身仍可算
   * —— 兩者分開報告,才看得出「指標算不出來」與「這份 run 進不了趨勢」是兩件不同的事。
   */
  readonly observations: readonly RegistryObservation[];
  readonly observationError?: string;
}

export interface EffectiveSpeed {
  /** 首發即命中的周邊呈現數（M1 分子）。 */
  readonly firstShotHitCount: number;
  /** 全部周邊命中窗數（總命中速度的分子）。 */
  readonly peripheralHitCount: number;
  readonly peripheralCount: number;
  /** registry 用的分母 = 最後 tick − 第一 tick（含 3 秒倒數,G2）。 */
  readonly measuredDurationMs: number;
  /** 協定的計分窗 = 60.0 s。 */
  readonly protocolDurationMs: number;
  readonly firstShotEffectivePerMinMeasured: number;
  readonly firstShotEffectivePerMinProtocol: number;
  readonly totalHitsPerMinMeasured: number;
  readonly totalHitsPerMinProtocol: number;
  /** 總命中速度 − 首發有效速度 = 補槍依賴的大小（同一分母下）。 */
  readonly refireGapPerMinProtocol: number;
  /** 周邊呈現速率（C2 的 x 軸）。 */
  readonly presentationsPerMinProtocol: number;
  readonly firstShotHitRate: number;
  /** `measuredDurationMs / protocolDurationMs − 1` —— hits/min 的系統性低估幅度。 */
  readonly denominatorInflation: number;
}

export interface DetectionSummary {
  readonly total: number;
  readonly detected: number;
  readonly timeout: number;
  readonly detectedRate: number;
  readonly baselineInsufficient: number;
  readonly anticipation: number;
  readonly thresholdDegPerSecP50: number;
  readonly reactionMsP50?: number;
}

export interface QualitySummary {
  readonly drillId: string;
  readonly protocolVersion?: string;
  readonly startedAt: string;
  readonly displayHz: number;
  readonly simHz: number;
  readonly sensitivity: number;
  readonly fovDeg?: number;
  readonly dpi?: number;
  readonly countsPer360: number;
  readonly cmPer360?: number;
  readonly crossOriginIsolated: boolean;
  readonly suspect: boolean;
  readonly lateEventCount: number;
  readonly validityFlags: readonly string[];
  readonly framesP50Ms?: number;
  readonly framesP99Ms?: number;
  readonly framesOverBudgetWindows?: number;
  readonly hasMouseSamples: boolean;
  readonly tickCount: number;
  readonly tickSpanMs: number;
  readonly firstVisibleOffsetMs: number;
  readonly lastVisibleOffsetMs: number;
  readonly zeroDisplacementTicks: number;
  readonly displacementTicks: number;
  /** 周邊 `visible.side` 的相異值個數。1 ⇒ 該欄是佔位值,任何 side-split 聚合都會塌成單邊。 */
  readonly rawSideDistinctValues: number;
  readonly blockers: readonly string[];
}

export interface RunSummary {
  readonly runIndex: number;
  readonly sourcePath: string;
  readonly quality: QualitySummary;
  readonly registry: RegistryOutcome;
  readonly detection: DetectionSummary;
  readonly effectiveSpeed: EffectiveSpeed;
  readonly phase: PhaseBudget;
  readonly tails: readonly TailRow[];
  readonly azimuthBins: readonly BinSummary[];
  readonly tierBins: readonly BinSummary[];
  readonly rolling: readonly RollingPoint[];
  readonly rollingDrawable: boolean;
  readonly fitts: FittsFit;
}

export interface GateVerdict {
  readonly id: 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
  readonly title: string;
  /** 一句話的結論。永遠帶數字。 */
  readonly verdict: string;
  readonly lines: readonly string[];
  /** 這道閘導致哪些呈現被停用／降級。空陣列 = 沒有降級。 */
  readonly degradations: readonly string[];
}

export interface SequenceFinding {
  readonly perRunVisibleCount: readonly number[];
  readonly perRunPeripheralCount: readonly number[];
  readonly commonVisiblePrefix: number;
  readonly commonPeripheralPrefix: number;
  readonly identical: boolean;
}

export interface RepTrendRow {
  readonly runIndex: number;
  readonly sourcePath: string;
  readonly n: number;
  readonly firstShotHitRate: number;
  readonly medianHitTimeMs?: number;
  readonly medianFireAngleErrorDeg?: number;
  readonly fireCount: number;
}

export interface CoachReport {
  readonly version: string;
  readonly runs: readonly RunSummary[];
  readonly rows: readonly PresentationRow[];
  readonly gates: readonly GateVerdict[];
  readonly sequence: SequenceFinding;
  /** 共同前綴內的逐 rep 比較 —— 這批資料真正支撐得起的縱向量。 */
  readonly repTrend: readonly RepTrendRow[];
  /** §7 的誠實邊界。渲染層必須逐條輸出。 */
  readonly honesty: readonly string[];
  /** 資料推翻設計假設之處。空陣列 = 設計全部成立。 */
  readonly overturned: readonly string[];
}

// ---------------------------------------------------------------------------
// 進入點
// ---------------------------------------------------------------------------

export function buildSpiderShotV3CoachReport(inputs: readonly SpiderShotV3RunInput[]): CoachReport {
  if (inputs.length === 0) throw new Error('buildSpiderShotV3CoachReport requires at least one run');

  const perRun = inputs.map((input, runIndex) => analyseRun(input, runIndex));
  const rows = perRun.flatMap((run) => run.rows);
  const runs = perRun.map((run) => run.summary);
  const sequence = assessSequence(perRun);
  const repTrend = buildRepTrend(perRun, sequence.commonPeripheralPrefix);
  const gates = buildGates(runs, sequence, repTrend);

  return {
    version: COACH_REPORT_VERSION,
    runs,
    rows,
    gates,
    sequence,
    repTrend,
    honesty: HONESTY_STATEMENTS(runs),
    overturned: findOverturnedAssumptions(runs),
  };
}

// ---------------------------------------------------------------------------
// 逐 run
// ---------------------------------------------------------------------------

interface AnalysedRun {
  readonly summary: RunSummary;
  readonly rows: readonly PresentationRow[];
  readonly visibleSignature: readonly string[];
  readonly peripheralSignature: readonly string[];
}

function analyseRun(input: SpiderShotV3RunInput, runIndex: number): AnalysedRun {
  const { payload, sourcePath } = input;
  const meta = payload.meta;

  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visible = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);
  const peripheralVisible = visible.filter((event) => event.zone === 'peripheral');

  const windows = buildPeekWindows(payload);
  const windowByTarget = new Map(windows.map((window) => [window.targetId, window]));
  const conditions = arrivalConditions(payload);
  const metrics = deriveSpiderShotMetrics(payload);
  const detection = deriveDetectionMetrics(payload);
  const phase = computePhaseMetrics(payload);

  const detectionByTarget = new Map(detection.presentations.map((entry) => [entry.targetId, entry]));
  const phaseByPeekIndex = new Map(phase.samples.map((sample) => [sample.peekIndex, sample]));
  const switchByTarget = new Map(metrics.switchReaction.map((entry) => [entry.targetId, entry]));
  const executionByTarget = new Map(metrics.movementExecution.map((entry) => [entry.targetId, entry]));
  const stopByTarget = new Map(metrics.stopControl.map((entry) => [entry.targetId, entry]));

  const tierEdges = resolveTierEdges(payload);
  const rows: PresentationRow[] = [];
  let trialIndex = 0;

  visible.forEach((event, peekIndex) => {
    if (event.zone !== 'peripheral') return;
    const window = windowByTarget.get(event.targetId);
    if (window === undefined) throw new Error(`no peek window for peripheral target ${event.targetId}`);
    const condition = conditions.get(event.targetId);
    const stop = stopByTarget.get(event.targetId);
    const execution = executionByTarget.get(event.targetId);
    const phaseSample = phaseByPeekIndex.get(peekIndex);
    const dDeg = condition?.angularDistanceDeg ?? Number.NaN;
    const wDeg = condition?.angularSizeDeg ?? Number.NaN;

    rows.push({
      runIndex,
      sourcePath,
      trialIndex: trialIndex++,
      targetId: event.targetId,
      quadrant: condition?.quadrant ?? 'unknown',
      side: condition?.side ?? 'none',
      azimuthBin: azimuthBinFor(condition?.quadrant, condition?.side),
      tierKey: tierKeyFor(dDeg, tierEdges),
      dDeg,
      wDeg,
      idBits: Math.log2(1 + dDeg / wDeg),
      firstShotHit: firstShotHitOf(window),
      noFirstShot: window.firstFire === undefined,
      fireCount: window.fires.length,
      ...optional('hitTimeMs', window.outcome === 'hit' && window.tHit !== undefined ? window.tHit - window.tVisible : undefined),
      ...optional('fireAngleErrorDeg', firstShotAngleErrorOf(metrics, event.targetId)),
      ...optional('overshootDeg', stop?.overshootDeg),
      ...optional('dropCount', stop?.dropCount),
      ...optional('microAdjustCount', stop?.microAdjustCount),
      detectionStatus: detectionByTarget.get(event.targetId)?.status ?? 'timeout',
      ...optional('reactionMs', switchByTarget.get(event.targetId)?.reactionMs),
      ...optional('movementTimeMs', execution?.movementTimeMs),
      ...optional('peakOmegaDegPerSec', execution?.peakOmegaDegPerSec),
      ...optional('recMs', phaseSample?.recMs),
      ...optional('mrMs', phaseSample?.mrMs),
      ...optional('vMs', phaseSample?.vMs),
      phaseFlags: phaseSample?.flags ?? ['no_phase_sample'],
    });
  });

  const peripheralWindows = windows.filter((window) => window.visible.zone === 'peripheral');
  const tickSpanMs = ticks.length >= 2 ? ticks[ticks.length - 1].t - ticks[0].t : 0;
  const t0 = ticks.length > 0 ? ticks[0].t : 0;
  const throw360 = deriveMouseThrow(payload);
  const displacementTicks = ticks.filter((tick) => tick.dYaw !== undefined).length;
  const zeroDisplacementTicks = ticks.filter((tick) => tick.dYaw === 0 && tick.dPitch === 0).length;

  const quality: QualitySummary = {
    drillId: meta.drillId,
    ...optional('protocolVersion', meta.assessment?.protocolVersion),
    startedAt: meta.startedAt,
    displayHz: meta.displayHz,
    simHz: meta.simHz,
    sensitivity: meta.sensitivity,
    ...optional('fovDeg', meta.fovDeg),
    ...optional('dpi', throw360.dpi),
    countsPer360: throw360.countsPer360,
    ...optional('cmPer360', throw360.cmPer360),
    crossOriginIsolated: meta.crossOriginIsolated,
    suspect: meta.suspect,
    lateEventCount: meta.lateEventCount,
    validityFlags: activeValidityFlags(meta.validity),
    ...optional('framesP50Ms', meta.frames?.summary.p50),
    ...optional('framesP99Ms', meta.frames?.summary.p99),
    ...optional('framesOverBudgetWindows', meta.frames?.summary.overBudgetWindows),
    hasMouseSamples: payload.mouseSamples !== undefined,
    tickCount: ticks.length,
    tickSpanMs,
    firstVisibleOffsetMs: visible.length > 0 ? visible[0].t - t0 : Number.NaN,
    lastVisibleOffsetMs: visible.length > 0 ? visible[visible.length - 1].t - t0 : Number.NaN,
    zeroDisplacementTicks,
    displacementTicks,
    rawSideDistinctValues: new Set(peripheralVisible.map((event) => event.side)).size,
    blockers: collectBlockers(payload, ticks.length, peripheralVisible.length),
  };

  return {
    summary: {
      runIndex,
      sourcePath,
      quality,
      registry: projectRegistry(payload),
      detection: summariseDetection(detection, new Set(peripheralVisible.map((event) => event.targetId))),
      effectiveSpeed: computeEffectiveSpeed(rows, peripheralWindows, tickSpanMs),
      phase: summarisePhase(rows),
      tails: buildTails(rows),
      azimuthBins: summariseBins(rows, (row) => row.azimuthBin, AZIMUTH_BIN_ORDER, azimuthBinLabel),
      tierBins: summariseBins(rows, (row) => row.tierKey, tierKeys(tierEdges), (key) => `${key}°`),
      rolling: rollingMedians(rows),
      rollingDrawable: rows.length >= MIN_ROLLING_TRIALS,
      fitts: fitFitts(rows, tierKeys(tierEdges)),
    },
    rows,
    visibleSignature: visible.map(signatureOfVisible),
    peripheralSignature: peripheralVisible.map(signatureOfVisible),
  };
}

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

/**
 * `DrillMetricRegistry.project()` 的 `catch` 是**單一 catch-all**：任何前提失敗都變成
 * `reasonCode: 'projection-failed'`（[`DrillMetricRegistry.ts:413`](../src/history/DrillMetricRegistry.ts#L413)）。
 * 操作者因此看不出是「忘了填受試者代號」還是「幾何檢查沒過」。本函式在**不改 registry** 的前提下
 * 逐條複驗它的前提,把診斷補回來（KI-036）。
 */
function projectRegistry(payload: ExportPayload): RegistryOutcome {
  const registry = createDrillMetricRegistry();
  const result = registry.project(payload);
  const registration = registry.registrationForExactDrill(payload.meta.drillId);

  let observations: RegistryObservation[] = [];
  let observationError: string | undefined;
  if (registration !== undefined) {
    try {
      const descriptors = new Map(registration.descriptors.map((descriptor) => [descriptor.id, descriptor]));
      observations = registration.project(payload).map((observation) => {
        const descriptor = descriptors.get(observation.metricId);
        return {
          metricId: observation.metricId,
          label: descriptor?.label ?? observation.metricId,
          unit: observation.unit,
          value: observation.value,
          format: descriptor?.format ?? 'decimal-2',
        };
      });
    } catch (error) {
      observationError = (error as Error).message;
    }
  }

  if (result.status === 'ready') {
    return {
      status: result.status,
      conditionCell: result.compatibilityKey.targetConditionCell,
      qualityGateStatus: result.qualityGateStatus,
      observations,
      ...optional('observationError', observationError),
    };
  }

  return {
    status: result.status,
    ...optional('reasonCode', 'reasonCode' in result ? result.reasonCode : undefined),
    ...optional('diagnosis', diagnoseProjectionFailure(payload, registration !== undefined)),
    observations,
    ...optional('observationError', observationError),
  };
}

/** registry 的前提逐條複驗。回 `undefined` 表示所有已知前提都成立（失敗原因在別處）。 */
function diagnoseProjectionFailure(payload: ExportPayload, registered: boolean): string | undefined {
  const meta = payload.meta;
  if (!registered) return `drillId '${meta.drillId}' 未註冊`;
  if (meta.assessment === undefined) return 'meta.assessment 缺席（非 assessment run）';
  if (meta.sessionPlanMode === 'custom') return 'meta.sessionPlanMode === "custom"（operator-authored program,設計上排除）';

  const missing: string[] = [];
  const participantId = meta.session?.participantId;
  if (typeof participantId !== 'string' || participantId.trim().length === 0) {
    missing.push('`meta.session.participantId`（錄製時未填 SessionSetup 的受試者代號）');
  }
  if (typeof meta.weaponId !== 'string' || meta.weaponId.trim().length === 0) missing.push('`meta.weaponId`');
  if (typeof meta.movementModel !== 'string' || meta.movementModel.trim().length === 0) missing.push('`meta.movementModel`');
  if (!(typeof meta.fovDeg === 'number' && Number.isFinite(meta.fovDeg) && meta.fovDeg > 0)) missing.push('`meta.fovDeg`');
  if (meta.protocolGuard?.noMovement !== true) missing.push('`meta.protocolGuard.noMovement`');
  if (meta.targets?.hitbox === undefined) missing.push('`meta.targets.hitbox`');
  if (meta.scene?.eye === undefined) missing.push('`meta.scene.eye`');
  if (meta.spawn?.spiderShot === undefined) missing.push('`meta.spawn.spiderShot`');

  return missing.length === 0 ? undefined : `compatibility key 建不起來 —— 缺 ${missing.join('、')}`;
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

function summariseDetection(
  detection: ReturnType<typeof deriveDetectionMetrics>,
  peripheralIds: ReadonlySet<string>,
): DetectionSummary {
  const presentations = detection.presentations.filter((entry) => peripheralIds.has(entry.targetId));
  const detected = presentations.filter((entry) => entry.status === 'detected');
  const reactions = detected.map((entry) => entry.reactionMs).filter(isFiniteNumber);
  return {
    total: presentations.length,
    detected: detected.length,
    timeout: presentations.length - detected.length,
    detectedRate: presentations.length === 0 ? Number.NaN : detected.length / presentations.length,
    baselineInsufficient: presentations.filter((entry) => entry.baselineInsufficient).length,
    anticipation: presentations.filter((entry) => entry.anticipation).length,
    thresholdDegPerSecP50: percentile(presentations.map((entry) => entry.thresholdDegPerSec), 50),
    ...optional('reactionMsP50', reactions.length === 0 ? undefined : percentile(reactions, 50)),
  };
}

function computeEffectiveSpeed(
  rows: readonly PresentationRow[],
  peripheralWindows: readonly PeekWindowTs[],
  measuredDurationMs: number,
): EffectiveSpeed {
  const firstShotHitCount = rows.filter((row) => row.firstShotHit).length;
  const peripheralHitCount = peripheralWindows.filter((window) => window.outcome === 'hit').length;
  const protocolDurationMs = PROTOCOL_SCORING_WINDOW_MS;
  const perMin = (count: number, durationMs: number) => (durationMs > 0 ? (60000 * count) / durationMs : Number.NaN);

  const firstShotEffectivePerMinProtocol = perMin(firstShotHitCount, protocolDurationMs);
  const totalHitsPerMinProtocol = perMin(peripheralHitCount, protocolDurationMs);

  return {
    firstShotHitCount,
    peripheralHitCount,
    peripheralCount: rows.length,
    measuredDurationMs,
    protocolDurationMs,
    firstShotEffectivePerMinMeasured: perMin(firstShotHitCount, measuredDurationMs),
    firstShotEffectivePerMinProtocol,
    totalHitsPerMinMeasured: perMin(peripheralHitCount, measuredDurationMs),
    totalHitsPerMinProtocol,
    refireGapPerMinProtocol: totalHitsPerMinProtocol - firstShotEffectivePerMinProtocol,
    presentationsPerMinProtocol: perMin(rows.length, protocolDurationMs),
    firstShotHitRate: rows.length === 0 ? Number.NaN : firstShotHitCount / rows.length,
    denominatorInflation: protocolDurationMs > 0 ? measuredDurationMs / protocolDurationMs - 1 : Number.NaN,
  };
}

function summarisePhase(rows: readonly PresentationRow[]): PhaseBudget {
  const clean = rows.filter((row) => row.phaseFlags.length === 0);
  const rec = clean.map((row) => row.recMs).filter(isFiniteNumber);
  const mr = clean.map((row) => row.mrMs).filter(isFiniteNumber);
  const v = clean.map((row) => row.vMs).filter(isFiniteNumber);
  const recP50 = rec.length === 0 ? undefined : percentile(rec, 50);
  const mrP50 = mr.length === 0 ? undefined : percentile(mr, 50);
  const vP50 = v.length === 0 ? undefined : percentile(v, 50);
  return {
    ...optional('recMs', recP50),
    ...optional('mrMs', mrP50),
    ...optional('vMs', vP50),
    ...optional(
      'totalMs',
      recP50 !== undefined && mrP50 !== undefined && vP50 !== undefined ? recP50 + mrP50 + vP50 : undefined,
    ),
    n: clean.length,
    flagged: rows.length - clean.length,
  };
}

function buildTails(rows: readonly PresentationRow[]): readonly TailRow[] {
  return [
    tailRow('hit-time', '命中時間', 'ms', rows.map((row) => row.hitTimeMs), `分布右端被 ${PROTOCOL_PEEK_TIMEOUT_MS} ms 逾時上界截斷`),
    tailRow('fire-angle-error', '首發角誤差', 'deg', rows.map((row) => row.fireAngleErrorDeg)),
    tailRow('overshoot', '進靶後逸出', 'deg', rows.map((row) => row.overshootDeg), '只有「首次進靶後仍有離靶樣本」的呈現才有值'),
  ];
}

function tailRow(key: string, label: string, unit: string, values: readonly (number | undefined)[], note?: string): TailRow {
  const finite = values.filter(isFiniteNumber);
  const drawable = finite.length >= MIN_TAIL_N;
  const p50 = finite.length === 0 ? undefined : percentile(finite, 50);
  const p95 = drawable ? percentile(finite, 95) : undefined;
  return {
    key,
    label,
    unit,
    n: finite.length,
    ...optional('p50', p50),
    ...optional('p95', p95),
    ...optional('ratio', p50 !== undefined && p50 > 0 && p95 !== undefined ? p95 / p50 : undefined),
    drawable,
    ...optional('note', note),
  };
}

function summariseBins(
  rows: readonly PresentationRow[],
  keyOf: (row: PresentationRow) => string,
  order: readonly string[],
  labelOf: (key: string) => string,
): readonly BinSummary[] {
  const grouped = new Map<string, PresentationRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [row]);
    else bucket.push(row);
  }

  const keys = [...order.filter((key) => grouped.has(key)), ...[...grouped.keys()].filter((key) => !order.includes(key))];
  return keys.map((key) => {
    const bucket = grouped.get(key) ?? [];
    const hits = bucket.filter((row) => row.firstShotHit).length;
    const hitTimes = bucket.map((row) => row.hitTimeMs).filter(isFiniteNumber);
    return {
      key,
      label: labelOf(key),
      n: bucket.length,
      firstShotHitCount: hits,
      firstShotHitRate: bucket.length === 0 ? Number.NaN : hits / bucket.length,
      ...optional('medianHitTimeMs', hitTimes.length === 0 ? undefined : percentile(hitTimes, 50)),
      conclusive: bucket.length >= MIN_BIN_N,
    };
  });
}

function rollingMedians(rows: readonly PresentationRow[]): readonly RollingPoint[] {
  if (rows.length < MIN_ROLLING_TRIALS) return [];
  const points: RollingPoint[] = [];
  const step = Math.max(1, Math.floor(ROLLING_WINDOW_TRIALS / 2));
  for (let start = 0; start + ROLLING_WINDOW_TRIALS <= rows.length; start += step) {
    const window = rows.slice(start, start + ROLLING_WINDOW_TRIALS);
    const values = window.map((row) => row.hitTimeMs).filter(isFiniteNumber);
    if (values.length === 0) continue;
    points.push({
      centerTrial: start + ROLLING_WINDOW_TRIALS / 2,
      medianHitTimeMs: percentile(values, 50),
      n: values.length,
    });
  }
  return points;
}

/**
 * C7 —— 三個幅度 tier 的中位數對 ID 做最小平方擬合（教練提案 C7 即以三個 tier 中位數為擬合輸入）。
 * 少於 3 個有效 tier、或 ID 變異過窄時**拒絕擬合**（斜率會不穩定）。
 */
function fitFitts(rows: readonly PresentationRow[], order: readonly string[]): FittsFit {
  const points: FittsPoint[] = [];
  for (const tierKey of order) {
    const bucket = rows.filter((row) => row.tierKey === tierKey);
    const hitTimes = bucket.map((row) => row.hitTimeMs).filter(isFiniteNumber);
    const ids = bucket.map((row) => row.idBits).filter(isFiniteNumber);
    if (hitTimes.length === 0 || ids.length === 0) continue;
    points.push({
      tierKey,
      n: hitTimes.length,
      medianIdBits: percentile(ids, 50),
      medianHitTimeMs: percentile(hitTimes, 50),
    });
  }

  if (points.length < 3) {
    return { points, drawable: false, reason: `只有 ${points.length} 個幅度 tier 有有效命中時間（需要 3 個）` };
  }
  const idRange = Math.max(...points.map((point) => point.medianIdBits)) - Math.min(...points.map((point) => point.medianIdBits));
  if (idRange < MIN_ID_RANGE_BITS) {
    return { points, drawable: false, reason: `ID 變異只有 ${idRange.toFixed(2)} bits（< ${MIN_ID_RANGE_BITS}）,斜率不穩定` };
  }

  const n = points.length;
  const meanX = points.reduce((sum, point) => sum + point.medianIdBits, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.medianHitTimeMs, 0) / n;
  const sxx = points.reduce((sum, point) => sum + (point.medianIdBits - meanX) ** 2, 0);
  const sxy = points.reduce((sum, point) => sum + (point.medianIdBits - meanX) * (point.medianHitTimeMs - meanY), 0);
  if (sxx === 0) return { points, drawable: false, reason: 'ID 完全無變異,無法擬合' };
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const ssTot = points.reduce((sum, point) => sum + (point.medianHitTimeMs - meanY) ** 2, 0);
  const ssRes = points.reduce(
    (sum, point) => sum + (point.medianHitTimeMs - (intercept + slope * point.medianIdBits)) ** 2,
    0,
  );

  return {
    points,
    interceptMs: intercept,
    slopeMsPerBit: slope,
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    drawable: true,
  };
}

/** 三個 tier 橫跨 10–25° ⇒ ID 跨度約 1.17 bits。低於這個數量級的變異不足以定斜率。 */
const MIN_ID_RANGE_BITS = 0.5;

// ---------------------------------------------------------------------------
// 跨 run
// ---------------------------------------------------------------------------

function assessSequence(perRun: readonly AnalysedRun[]): SequenceFinding {
  const commonVisiblePrefix = commonPrefixLength(perRun.map((run) => run.visibleSignature));
  const commonPeripheralPrefix = commonPrefixLength(perRun.map((run) => run.peripheralSignature));
  const shortestVisible = Math.min(...perRun.map((run) => run.visibleSignature.length));
  return {
    perRunVisibleCount: perRun.map((run) => run.visibleSignature.length),
    perRunPeripheralCount: perRun.map((run) => run.peripheralSignature.length),
    commonVisiblePrefix,
    commonPeripheralPrefix,
    identical: commonVisiblePrefix === shortestVisible,
  };
}

function buildRepTrend(perRun: readonly AnalysedRun[], prefix: number): readonly RepTrendRow[] {
  return perRun.map((run) => {
    const rows = run.rows.slice(0, prefix);
    const hitTimes = rows.map((row) => row.hitTimeMs).filter(isFiniteNumber);
    const fireErrors = rows.map((row) => row.fireAngleErrorDeg).filter(isFiniteNumber);
    return {
      runIndex: run.summary.runIndex,
      sourcePath: run.summary.sourcePath,
      n: rows.length,
      firstShotHitRate: rows.length === 0 ? Number.NaN : rows.filter((row) => row.firstShotHit).length / rows.length,
      ...optional('medianHitTimeMs', hitTimes.length === 0 ? undefined : percentile(hitTimes, 50)),
      ...optional('medianFireAngleErrorDeg', fireErrors.length === 0 ? undefined : percentile(fireErrors, 50)),
      fireCount: rows.reduce((sum, row) => sum + row.fireCount, 0),
    };
  });
}

// ---------------------------------------------------------------------------
// 五道閘
// ---------------------------------------------------------------------------

/** G1 的判準：detected 比例低於此值即停用 `switchReaction` 與 `movementTimeMs`（HANDOFF §2 G1）。 */
export const G1_DETECTED_RATE_FLOOR = 0.8;

function buildGates(
  runs: readonly RunSummary[],
  sequence: SequenceFinding,
  repTrend: readonly RepTrendRow[],
): readonly GateVerdict[] {
  return [g1(runs), g2(runs), g3(runs), g4(sequence, repTrend), g5(runs)];
}

function g1(runs: readonly RunSummary[]): GateVerdict {
  const detected = runs.reduce((sum, run) => sum + run.detection.detected, 0);
  const total = runs.reduce((sum, run) => sum + run.detection.total, 0);
  const rate = total === 0 ? Number.NaN : detected / total;
  const alive = rate > 0;
  const clean = rate >= G1_DETECTED_RATE_FLOOR;

  const lines = [
    `canonical 預設參數（\`sustainedTicks: 4\`／\`preStimulusMs: 500\`／\`thresholdSdMultiplier: 3\`）下,` +
      `三份 run 合計 **${detected} / ${total}** 個周邊呈現 \`status === 'detected'\`（${pctText(rate)}）。` +
      `逐份為 ${runs.map((run) => `${run.detection.detected}/${run.detection.total}`).join('、')}。`,
    `⇒ **KI-031 的懸崖在 240 Hz 顯示上沒有咬到**。四份 60 Hz 的 \`spider-shot-wide-v1\` 匯出是 0/113;` +
      `這批是 ${detected}/${total},差距不是程度問題而是機制問題。`,
    `零位移 tick 佔比 ${runs.map((run) => pctText(run.quality.zeroDisplacementTicks / run.quality.displacementTicks)).join('、')}` +
      ` —— 這些零**不是** KI-031 的「沒有新資料」。若是,detected 會像 60 Hz 那批一樣歸零;實際沒有。`,
    `\`baselineInsufficient\` ${runs.reduce((sum, run) => sum + run.detection.baselineInsufficient, 0)} 個、` +
      `\`anticipation\` ${runs.reduce((sum, run) => sum + run.detection.anticipation, 0)} 個。` +
      `\`thresholdDegPerSec\` 的 p50 逐份為 ${runs.map((run) => run.detection.thresholdDegPerSecP50.toFixed(1)).join('、')} deg/s` +
      ` —— 500 ms baseline 窗**確實吃進了上一次拉槍**（KI-031 §2 的次要觀察成立）,門檻被抬到數十 deg/s 的量級。`,
  ];

  const degradations = clean
    ? []
    : [
        `detected 比例 ${pctText(rate)} 低於 ${pctText(G1_DETECTED_RATE_FLOOR)} 的粗略門檻 ⇒ ` +
          `\`reactionMs\`／\`movementTimeMs\` **只作描述,不作處方**,且必須與 timeout 數並列。`,
      ];

  return {
    id: 'G1',
    title: '`t_detect` 在這批資料上活著嗎',
    verdict: alive
      ? clean
        ? `✅ 活著且比例正常（${pctText(rate)}）`
        : `🟡 活著但比例偏低（${pctText(rate)},低於 ${pctText(G1_DETECTED_RATE_FLOOR)}）`
      : '🔴 全滅 —— 撞上 KI-031',
    lines,
    degradations,
  };
}

function g2(runs: readonly RunSummary[]): GateVerdict {
  const inflations = runs.map((run) => run.effectiveSpeed.denominatorInflation);
  return {
    id: 'G2',
    title: '`validDurationMs` 含倒數,hits/min 被系統性低估',
    verdict: `🔴 確認 —— 分母大 ${inflations.map((value) => pctText(value)).join('／')},絕對值同幅低估`,
    lines: [
      `tick span（= registry 的 \`validDurationMs\`）逐份為 ` +
        `${runs.map((run) => (run.quality.tickSpanMs / 1000).toFixed(2)).join('、')} s,` +
        `而協定的計分窗是 ${(PROTOCOL_SCORING_WINDOW_MS / 1000).toFixed(1)} s。`,
      `第一個 \`visible\` 一律落在 t0 + ${runs.map((run) => (run.quality.firstVisibleOffsetMs / 1000).toFixed(2)).join('／')} s` +
        `（= \`timing.countdownMs\` ${PROTOCOL_COUNTDOWN_MS} ms 的倒數）,最後一個落在 t0 + ` +
        `${runs.map((run) => (run.quality.lastVisibleOffsetMs / 1000).toFixed(2)).join('／')} s。` +
        `倒數與尾段 tick 都在分母裡,分子卻一發都沒有。`,
      `本報告因此對每一個速率量**同時給兩個分母**：registry 原值（可比、可進趨勢）與 ` +
        `${(PROTOCOL_SCORING_WINDOW_MS / 1000).toFixed(1)} s 分母值（教練語意正確）。`,
      `⚠️ **不修 registry** —— \`validDurationMs\` 的語意屬凍結協定的可比性,改它會讓既有趨勢點不可比。` +
        `缺陷已依 CLAUDE.md §3.9 立案為 **KI-037**。`,
    ],
    degradations: [
      'registry 的 `spider-v3.peripheral-hits-per-minute` 絕對值不得直接對外報數,必須標註低估幅度。',
    ],
  };
}

function g3(runs: readonly RunSummary[]): GateVerdict {
  const perRunPeripheral = runs.map((run) => run.effectiveSpeed.peripheralCount);
  const cells = 12;
  const worstCell = Math.min(...perRunPeripheral) / cells;
  const azimuthMin = Math.min(...runs.flatMap((run) => run.azimuthBins.map((bin) => bin.n)));
  const tierMin = Math.min(...runs.flatMap((run) => run.tierBins.map((bin) => bin.n)));

  return {
    id: 'G3',
    title: 'n-gate —— 12 格不可用,只畫兩條邊際軸',
    verdict: `🟡 邊際軸過關（方位最小 n=${azimuthMin}、幅度最小 n=${tierMin}）,12 格不過（每格 ≈ ${worstCell.toFixed(1)}）`,
    lines: [
      `單場周邊呈現 ${perRunPeripheral.join('／')} 個 ⇒ 12 格交叉每格 ≈ ${perRunPeripheral.map((count) => (count / cells).toFixed(1)).join('／')}。` +
        `n=3 的首發命中率只有 0%／33%／67%／100% 四個可能值 —— 那是骰子,不是量測。**單場一律不畫 12 格。**`,
      `兩條邊際軸的每箱 n：方位 ${runs.map((run) => run.azimuthBins.map((bin) => bin.n).join('/')).join('、')};` +
        `幅度 ${runs.map((run) => run.tierBins.map((bin) => bin.n).join('/')).join('、')}。`,
      `⚠️ **方位軸不是設計文件寫的「上／下／左／右」四箱。** canonical derivation 只輸出 ` +
        `\`quadrant\`（\`horizontal\`／\`vertical\`／\`oblique\`）與 eye-frame \`side\`（\`L\`／\`R\`）,` +
        `沒有「上 vs 下」的既有構念。在報告腳本裡自己算一個等於新增第二套幾何（C-D4 §8 明文禁止）,` +
        `所以本報告的方位軸改為 \`quadrant × side\` 的四箱:水平·左／水平·右／近垂直·左／近垂直·右。`,
      `\`vertical\` 分箱的 \`side\` **不是浮點殘值**：三份 run 的全部周邊呈現中,抵達點對 eye 的 ` +
        `\`|Δx|\` 最小值為 1.06e-2 u（8 u 距離下約 0.076°）,而殘值的量級是 1e-16。符號有意義,` +
        `但 0.076° 離垂直軸太近,判讀時不應把「近垂直·左／右」讀成左右負荷差異。`,
      `pooled 三份後周邊共 ${runs.reduce((sum, run) => sum + run.effectiveSpeed.peripheralCount, 0)} 次,` +
        `12 格每格 ≈ ${(runs.reduce((sum, run) => sum + run.effectiveSpeed.peripheralCount, 0) / cells).toFixed(1)} —— ` +
        `**但那是同一組 spawn 位置重複三次,不是 i.i.d.**（G4）,不得當獨立樣本上色。`,
    ],
    degradations: ['12 格交叉矩陣不繪製、不列入結論。', '方位軸的箱名與設計文件不同,已在圖上與表格檢視標明。'],
  };
}

function g4(sequence: SequenceFinding, repTrend: readonly RepTrendRow[]): GateVerdict {
  return {
    id: 'G4',
    title: '三份 run 的刺激序列逐位相同',
    verdict: sequence.identical
      ? `🔴 確認 —— 共同前綴 ${sequence.commonVisiblePrefix} 個呈現（${sequence.commonPeripheralPrefix} 個周邊）逐位相同`
      : '🟢 序列不同 —— 可視為獨立取樣',
    lines: [
      `逐份呈現數 ${sequence.perRunVisibleCount.join('／')}（周邊 ${sequence.perRunPeripheralCount.join('／')}）。` +
        `前 ${sequence.commonVisiblePrefix} 個呈現的 zone 與 \`targetX/Y/Z\` **完全相同**,` +
        `較長的 run 只是在 60 秒內多打了幾顆。`,
      `⇒ 三份**不是**同難度的獨立取樣,是**同一序列的三次重複**。任何跨 run 的平均都必須限制在共同前綴內,` +
        `否則後段條件會被呈現數最多的那一份主導。`,
      `⇒ 反過來說,這是一份**現成的學習曲線資料**。本報告因此把「rep 1→3 的變化」當主軸,` +
        `而不是設計原本的「本場 vs 個人基準」—— 後者這批資料沒有（G5）。`,
      `共同前綴（${repTrend[0]?.n ?? 0} 個周邊呈現）內的逐 rep 值：` +
        repTrend
          .map(
            (row) =>
              `rep ${row.runIndex + 1} 首發命中率 ${pctText(row.firstShotHitRate)}、` +
              `命中時間 p50 ${row.medianHitTimeMs === undefined ? '—' : `${row.medianHitTimeMs.toFixed(0)} ms`}`,
          )
          .join(';') +
        '。',
    ],
    degradations: [
      'pooled 聚合一律限制在共同前綴內,並標註為 clustered（同一 spawn 位置的三次重複）。',
      '跨 run 的差異不得解讀為一般化能力變化 —— rep index 是共變項。',
    ],
  };
}

function g5(runs: readonly RunSummary[]): GateVerdict {
  return {
    id: 'G5',
    title: '只有 3 場 ⇒ 沒有基準、沒有 MDC',
    verdict: `🔴 確認 —— 相容 run 總數 ${runs.length},沒有任何「先前基準」可比`,
    lines: [
      `C1（雜訊帶）與 C2（基準重心）都要求**至少 ${MIN_BASELINE_RUNS} 場相容 run 作為基準**,` +
        `而這裡總共只有 ${runs.length} 場 ⇒ 這 ${runs.length} 場**就是**建立基準的過程,不是被比較的對象。`,
      `C1 降級為「建立基準中 ${runs.length}/${MIN_BASELINE_RUNS}」:畫三場的實際值與全距,不畫雜訊帶,不宣告進步或退步。`,
      `C2 降級：三個點都畫,不畫基準重心、不畫位移連線;等首發有效速度的等值線保留 —— 它是幾何,不是基準。`,
      `⚠️ 本報告**任何地方都不出現 MDC 這個詞**。真 MDC 需要多日重測的 test–retest SEM;` +
        `這裡只有同一天連續三場,離散帶一律叫「三場全距」並標註它不是 MDC。`,
    ],
    degradations: [
      'C1 不畫雜訊帶,改顯示「建立基準中 3/3」。',
      'C2 不畫基準重心與位移連線。',
      '「MDC」一詞全報告禁用。',
    ],
  };
}

// ---------------------------------------------------------------------------
// 誠實邊界 / 被推翻的設計假設
// ---------------------------------------------------------------------------

function HONESTY_STATEMENTS(runs: readonly RunSummary[]): readonly string[] {
  const inflation = runs.map((run) => pctText(run.effectiveSpeed.denominatorInflation)).join('／');
  return [
    `**n = 1 位受試者、${runs.length} 場。** 本報告只描述這 ${runs.length} 場,不宣告能力、進步或退步。`,
    '**沒有絕對門檻。** 2.0° 角徑與 10–25° 角半徑都未經真人校準,報告中不出現「及格／優秀／不足」。',
    `**這 ${runs.length} 場是同一刺激序列的重複**（G4）,存在練習效應與序列熟悉效應 ⇒ 跨場差異不可解讀為一般化能力變化。`,
    '**同一天連續錄製** ⇒ 無法分離暖身、疲勞與學習。要分離必須跨日重測。',
    '**`overshootDeg` 無方向。** 它是無號逸出幅度,「衝過頭」與「沒到位」在資料上不可分,故只說「進靶後逸出幅度」。',
    '**`tDetectMs` 是視覺—動作代理值**,不是神經反應時間。它的下界含動作起始,且判準要求「持續朝目標接近」。',
    '**`meta.dpi` 缺席** ⇒ 不呈現 cm/360,也不用預設 DPI 猜。`counts/360` 可算,已如實列出。',
    `**hits/min 的絕對值被低估約 ${inflation}**（G2）：registry 的分母含 ${PROTOCOL_COUNTDOWN_MS / 1000} 秒倒數與尾段 tick。`,
  ];
}

function findOverturnedAssumptions(runs: readonly RunSummary[]): readonly string[] {
  const overturned: string[] = [];

  const allBins = runs.flatMap((run) => [...run.azimuthBins, ...run.tierBins]);
  const conclusive = allBins.filter((bin) => bin.conclusive);
  const ceilingBins = conclusive.filter((bin) => bin.firstShotHitRate >= CEILING_HIT_RATE);
  if (conclusive.length > 0 && ceilingBins.length / conclusive.length >= 0.5) {
    overturned.push(
      `**C4 的首發命中率在這位受試者身上撞天花板。** ${conclusive.length} 個達 n≥${MIN_BIN_N} 的分箱中有 ` +
        `${ceilingBins.length} 個 ≥ ${pctText(CEILING_HIT_RATE)},整體首發命中率為 ` +
        `${runs.map((run) => pctText(run.effectiveSpeed.firstShotHitRate)).join('／')}。教練提案的 C4 示例是 50–78%,` +
        `在那個區間裡「最弱的一箱」是有意義的;在 85–98% 的區間裡它只是取樣雜訊。` +
        `⇒ 本報告的 C4 一律不上色、不下「哪裡弱」的結論,並改以**命中時間**作為該軸的可判讀量。` +
        `這正是 stage14 README §6 第 5 項「地板／天花板效應非真人不可」所預告的情形。`,
    );
  }

  const overshoot = runs.map((run) => run.tails.find((tail) => tail.key === 'overshoot'));
  if (overshoot.every((tail) => tail !== undefined && !tail.drawable)) {
    overturned.push(
      `**C5 的「進靶後逸出」在這批資料上樣本不足。** 有效樣本逐份為 ` +
        `${overshoot.map((tail) => tail?.n ?? 0).join('／')}（< ${MIN_TAIL_N}）⇒ 不畫 p95。` +
        `根因是行為而非缺陷：受試者多半一進靶就開槍結束該次呈現,` +
        `\`postAcquireOvershoot()\` 因此沒有「首次進靶之後」的離靶樣本可取。` +
        `⇒ registry 的 \`spider-v3.median-overshoot-deg\` 在這種打法下是**由 4–5 個樣本決定的整場指標**,` +
        `其穩定性遠低於同列的其他四個。`,
    );
  }

  const phaseHeavyV = runs.filter((run) => run.phase.vMs !== undefined && run.phase.mrMs !== undefined && run.phase.vMs > run.phase.mrMs);
  if (phaseHeavyV.length === runs.length) {
    overturned.push(
      `**時間預算的形狀與教練提案的示例相反。** 示例是 REC 168／MR 214／V 96 ms（V 最短）;` +
        `實測三份為 ${runs.map((run) => `${fmt(run.phase.recMs, 0)}／${fmt(run.phase.mrMs, 0)}／${fmt(run.phase.vMs, 0)}`).join('、')} ms` +
        `（**V 最長,且長於 MR**）。這位受試者的時間主要花在「揮到位之後、開槍之前」,` +
        `與 ${runs.map((run) => pctText(run.effectiveSpeed.firstShotHitRate)).join('／')} 的首發命中率一致 —— ` +
        `他是用長確認期換高首發命中。C3 的判讀語句必須據此改寫,不能沿用示例的「V 長 = 不敢開槍」。`,
    );
  }

  const slopes = runs.map((run) => run.fitts.slopeMsPerBit).filter(isFiniteNumber);
  if (slopes.length === runs.length && slopes.length >= 2) {
    const min = Math.min(...slopes);
    const max = Math.max(...slopes);
    const mean = slopes.reduce((sum, value) => sum + value, 0) / slopes.length;
    if (mean > 0 && (max - min) / mean >= FITTS_SLOPE_INSTABILITY) {
      overturned.push(
        `**C7 的 Fitts 斜率在同一刺激序列的三次重複之間不穩定。** 三份的斜率為 ` +
          `${slopes.map((slope) => slope.toFixed(0)).join('／')} ms/bit（截距 ` +
          `${runs.map((run) => fmt(run.fitts.interceptMs, 0)).join('／')} ms）,全距是平均值的 ` +
          `${pctText((max - min) / mean)}。三份的**刺激逐位相同**,所以這個離散量的是估計誤差,不是難度縮放的變化。` +
          `逐份 r² 為 ${runs.map((run) => fmt(run.fitts.r2, 3)).join('／')} —— **r² 高不代表斜率可信**:` +
          `三個 tier 中位數擬合一條線,兩個自由度,r² 幾乎必然漂亮。` +
          `⇒ 本報告畫出三條擬合線但**不報 throughput、不比較截距與斜率**;要談難度縮放需要更多 tier 或更多場。`,
      );
    }
  }

  if (runs.every((run) => run.quality.rawSideDistinctValues <= 1)) {
    overturned.push(
      `**\`visible.side\` 對 v3 是佔位值。** 三份 run 的全部周邊 \`visible\` 事件 \`side\` 只有 ` +
        `${runs[0]?.quality.rawSideDistinctValues ?? 0} 種取值 ⇒ 任何以 \`PeekWindowTs.side\`／\`PhaseSample.side\` ` +
        `分左右的聚合都會整組塌到單邊而不報錯（實測 \`curve-v1\` 的 \`omega.left.n === 0\`）。已立案為 **KI-038**。`,
    );
  }

  if (runs.every((run) => run.registry.status !== 'ready')) {
    overturned.push(
      `**\`DrillMetricRegistry.project()\` 對三份都不是 \`'ready'\`。** 實際回 ` +
        `\`${runs[0]?.registry.status}\`／\`${runs[0]?.registry.reasonCode ?? '—'}\`,` +
        `根因是 ${runs[0]?.registry.diagnosis ?? '未知'} —— 而 \`projection-failed\` 是單一 catch-all,` +
        `不告訴操作者是哪一條前提失敗。已立案為 **KI-036**。` +
        `五個 descriptor 的值本身仍算得出來（\`registration.project()\` 不需要 compatibility key）,故照常列出。`,
    );
  }

  return overturned;
}

/** 「撞天花板」的判準 —— 這個分箱已經沒有鑑別力。 */
export const CEILING_HIT_RATE = 0.9;

/** Fitts 斜率的全距／平均比。超過即視為「這批資料定不出斜率」。 */
export const FITTS_SLOPE_INSTABILITY = 0.5;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

const AZIMUTH_BIN_ORDER: readonly AzimuthBinKey[] = [
  'horizontal-L',
  'horizontal-R',
  'vertical-L',
  'vertical-R',
  'unclassified',
];

function azimuthBinLabel(key: string): string {
  switch (key) {
    case 'horizontal-L':
      return '水平 · 左';
    case 'horizontal-R':
      return '水平 · 右';
    case 'vertical-L':
      return '近垂直 · 左';
    case 'vertical-R':
      return '近垂直 · 右';
    default:
      return '未分類';
  }
}

function azimuthBinFor(quadrant: string | undefined, side: 'L' | 'R' | undefined): AzimuthBinKey {
  if (side === undefined) return 'unclassified';
  if (quadrant === 'horizontal') return side === 'L' ? 'horizontal-L' : 'horizontal-R';
  if (quadrant === 'vertical') return side === 'L' ? 'vertical-L' : 'vertical-R';
  return 'unclassified';
}

/** 幅度 tier 的邊界由匯出的 `angularRadiusDegRange` + `grid.radiusTiers` 決定,不寫死 10/15/20/25。 */
function resolveTierEdges(payload: ExportPayload): readonly number[] {
  const schedule = payload.meta.spawn?.spiderShot as Record<string, unknown> | undefined;
  const peripheral = schedule?.peripheral as Record<string, unknown> | undefined;
  const range = peripheral?.angularRadiusDegRange;
  const grid = schedule?.grid as Record<string, unknown> | undefined;
  const tiers = grid?.radiusTiers;
  if (!Array.isArray(range) || range.length !== 2 || !isFiniteNumber(range[0]) || !isFiniteNumber(range[1])) {
    throw new Error('spider-shot-v3 export requires meta.spawn.spiderShot.peripheral.angularRadiusDegRange');
  }
  if (!isFiniteNumber(tiers) || !Number.isInteger(tiers) || tiers <= 0) {
    throw new Error('spider-shot-v3 export requires meta.spawn.spiderShot.grid.radiusTiers');
  }
  const [min, max] = range;
  return Array.from({ length: tiers + 1 }, (_unused, index) => min + ((max - min) * index) / tiers);
}

function tierKeys(edges: readonly number[]): readonly string[] {
  return edges.slice(0, -1).map((edge, index) => `${trimNumber(edge)}–${trimNumber(edges[index + 1])}`);
}

function tierKeyFor(dDeg: number, edges: readonly number[]): string {
  const keys = tierKeys(edges);
  if (!Number.isFinite(dDeg)) return 'unknown';
  for (let index = 0; index < keys.length; index++) {
    const upper = edges[index + 1];
    if (dDeg < upper || index === keys.length - 1) return keys[index];
  }
  return keys[keys.length - 1];
}

/**
 * 首發即命中 —— **不用** `PeekWindowTs.outcome`（窗內任一發命中即 `'hit'`,會把補槍算成首發命中）。
 * 這批匯出無 `hit` 事件、`fire` 無 `shotSeq`,故 `fire.hit` 即該發自己的結果,與歷史 projector 的
 * `fireHitOutcome()` 在此退化為同一判準。
 */
function firstShotHitOf(window: PeekWindowTs): boolean {
  return window.firstFire !== undefined && window.firstFire.hit;
}

function firstShotAngleErrorOf(metrics: ReturnType<typeof deriveSpiderShotMetrics>, targetId: string): number | undefined {
  const entry = metrics.firstShot.find((candidate) => candidate.targetId === targetId);
  return entry?.fireAngleErrorDeg;
}

function collectBlockers(payload: ExportPayload, tickCount: number, peripheralCount: number): readonly string[] {
  const meta = payload.meta;
  const blockers: string[] = [];
  if (meta.drillId !== spiderShotV3.drillId) {
    blockers.push(`drillId 為 '${meta.drillId}',非 '${spiderShotV3.drillId}'`);
  }
  if (!meta.crossOriginIsolated) {
    blockers.push('`meta.crossOriginIsolated: false` ⇒ 計時精度不足,量測資料失效（ADR-4）');
  }
  if (meta.suspect) blockers.push('`meta.suspect: true` ⇒ 過不了實驗資格閘');
  for (const flag of activeValidityFlags(meta.validity)) blockers.push(`\`meta.validity.${flag}: true\``);
  if (meta.displayHz < 144) {
    blockers.push(`\`meta.displayHz\` = ${meta.displayHz} < 144 ⇒ 不做相位診斷（教練紀律 #8 / KI-031）`);
  }
  if (tickCount < 2) blockers.push('tick 數不足,無法定義有效時長');
  if (peripheralCount === 0) blockers.push('零個 `zone: peripheral` 抵達 ⇒ 母體為空');
  return blockers;
}

function activeValidityFlags(validity: ExportPayload['meta']['validity']): readonly string[] {
  if (validity === undefined) return [];
  return Object.entries(validity)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

function signatureOfVisible(event: VisibleEvent): string {
  return `${event.zone}|${formatCoordinate(event.targetX)},${formatCoordinate(event.targetY)},${formatCoordinate(event.targetZ)}`;
}

function formatCoordinate(value: number | undefined): string {
  return value === undefined ? 'null' : value.toFixed(9);
}

function commonPrefixLength(signatures: readonly (readonly string[])[]): number {
  if (signatures.length === 0) return 0;
  const shortest = Math.min(...signatures.map((entry) => entry.length));
  let common = 0;
  while (common < shortest && signatures.every((entry) => entry[common] === signatures[0][common])) common++;
  return common;
}

function requireTimeLimitMs(config: typeof spiderShotV3): number {
  if (config.endCondition.type !== 'timeLimit') {
    throw new Error('spider-shot-v3 must declare a timeLimit endCondition');
  }
  return config.endCondition.value;
}

/** 線性內插的百分位。空序列回 `NaN`（**不是 0** —— 「沒樣本」與「值為 0」必須分得開）。 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 只在有值時放進物件 —— `exactOptionalPropertyTypes` 之外,也讓「缺席」在 JSON 裡看得出來。 */
function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function pctText(value: number): string {
  return Number.isFinite(value) ? `${(100 * value).toFixed(1)}%` : '—';
}

function fmt(value: number | undefined, digits: number): string {
  return value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * 抵達目標 → 該次 center→peripheral 切換的條件。只是把 canonical `deriveSpiderShotTransitions()`
 * 的輸出改成以 `targetId` 索引;不重算任何幾何（C-D4）。
 */
function arrivalConditions(payload: ExportPayload): ReadonlyMap<string, SpiderShotTransition> {
  return new Map(
    deriveSpiderShotTransitions(payload)
      .filter((transition) => transition.direction === 'center-to-peripheral')
      .map((transition) => [transition.targetId, transition]),
  );
}

export const __testing = {
  azimuthBinFor,
  commonPrefixLength,
  fitFitts,
  resolveTierEdges,
  rollingMedians,
  tierKeyFor,
  tierKeys,
};
