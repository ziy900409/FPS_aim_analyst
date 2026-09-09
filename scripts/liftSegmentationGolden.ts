/**
 * WP-61 T2 —— Stage 1 切段的 committed golden（OQ-61.4／F7、D-61.P4）。
 *
 * **為什麼是 golden 而不是在 Python 重寫切段**：`research/` 若另寫一套 `segmentByTimeGap()`，T3 的
 * 結果就無法歸因 —— 差異來自特徵，還是來自兩套切段？那形同對一個已凍結的原語建立第二定義（C-D4）。
 * ⇒ TS 是切段的唯一定義，Python 只讀這裡產出的 JSON（C-D1 允許讀 committed golden）。
 *
 * **golden 內嵌 `input.dtUs`（時間通道），不含 `dx`／`dy`。**
 * T2 step 5 明文「只含 index／時間／長度等衍生量，不含逐筆 `dx`／`dy`」——`dx`／`dy` 才是真人的
 * 移動軌跡（D-57.T5-8 保護的東西）；`dtUs` 是取樣時序，沒有它就**無法**逐位重現切段，而「重現不了」
 * 正是 golden 靜默過期的入口：原語一改，golden 只會安靜地與新行為脫節。⇒ 內嵌時間通道，換得
 * `verifyLiftSegmentationGolden()` 這個真正有偵測力的斷言。真人 run 的 golden 沿用
 * `research/README.md` 的既有 fixture 政策（匿名化、≤ 30 s）。
 *
 * 純函式：不讀時鐘、不讀隨機、無 I/O（I/O 全在 `record-lift-segmentation-golden.ts`）。
 */
import type { ExportPayload } from '../src/data/export.ts';
import type { MouseSampleBlock } from '../src/data/mouseSampleArena.ts';
import { deriveUnlockedIntervals, segmentByTimeGap, type TimeInterval } from '../src/metrics/mouseSampleGaps.ts';
import {
  extractAnnotationIntervals,
  GAP_THRESHOLD_SWEEP_MS,
  LIFT_VALIDATION_CONTRACT,
  type AnnotationInterval,
  type InstructionClass,
} from './liftCohortAudit.ts';

/** golden 格式版本。語意或欄位變動 ⇒ 升版並重跑產生腳本，不得原地改語意（C-D5 的同一紀律）。 */
export const LIFT_SEGMENTATION_GOLDEN_VERSION = 'lift-segments-v1';

export interface LiftSegmentationAtTheta {
  readonly thetaMs: number;
  readonly segments: readonly { readonly startIndex: number; readonly endIndex: number }[];
  readonly gaps: readonly {
    readonly startMs: number;
    readonly endMs: number;
    readonly durationMs: number;
    readonly beforeIndex: number;
    readonly afterIndex: number;
  }[];
  readonly lockGapIndices: readonly number[];
}

export interface LiftSegmentationGolden {
  readonly version: typeof LIFT_SEGMENTATION_GOLDEN_VERSION;
  readonly contract: typeof LIFT_VALIDATION_CONTRACT;
  /** 匿名化的 run 識別名。**不得**由 `meta.session.participantId` 推導。 */
  readonly runId: string;
  readonly sessionId: string;
  readonly instructionClass: InstructionClass;
  readonly displayHz: number;
  readonly sampleCount: number;
  /** 時間通道 —— 逐位重現切段所需的最小輸入。刻意不含 `dx`／`dy`。 */
  readonly input: { readonly t0Ms: number; readonly dtUs: readonly number[] };
  readonly unlockedIntervals: readonly TimeInterval[];
  /** 自報標註區間（`KeyL` down→up）。標籤本身在 Python 側配給候選空洞，這裡只是原始標註。 */
  readonly annotationIntervals: readonly AnnotationInterval[];
  readonly segmentationsByTheta: readonly LiftSegmentationAtTheta[];
}

export interface LiftGoldenInput {
  readonly runId: string;
  readonly sessionId: string;
  readonly instructionClass: InstructionClass;
  readonly payload: ExportPayload;
}

/** 由一份匯出建 golden。缺 `mouseSamples` 是呼叫端的錯 —— 沒有樣本流就沒有切段可言。 */
export function buildLiftSegmentationGolden(input: LiftGoldenInput): LiftSegmentationGolden {
  const block = input.payload.mouseSamples;
  if (block === undefined) {
    throw new Error(`buildLiftSegmentationGolden: ${input.runId} has no mouseSamples block`);
  }

  const unlockedIntervals = deriveUnlockedIntervals(input.payload.events, lastSampleMs(block));
  return {
    version: LIFT_SEGMENTATION_GOLDEN_VERSION,
    contract: LIFT_VALIDATION_CONTRACT,
    runId: input.runId,
    sessionId: input.sessionId,
    instructionClass: input.instructionClass,
    displayHz: input.payload.meta.displayHz,
    sampleCount: block.dtUs.length,
    input: { t0Ms: block.t0Ms, dtUs: [...block.dtUs] },
    unlockedIntervals,
    annotationIntervals: extractAnnotationIntervals(input.payload.events).intervals,
    segmentationsByTheta: GAP_THRESHOLD_SWEEP_MS.map((thetaMs) => segmentationAt(block, thetaMs, unlockedIntervals)),
  };
}

function segmentationAt(
  block: MouseSampleBlock,
  thetaMs: number,
  unlockedIntervals: readonly TimeInterval[],
): LiftSegmentationAtTheta {
  const segmentation = segmentByTimeGap(block, thetaMs, unlockedIntervals);
  return {
    thetaMs,
    segments: segmentation.segments.map((segment) => ({ ...segment })),
    gaps: segmentation.gaps.map((gap) => ({ ...gap })),
    lockGapIndices: [...segmentation.lockGapIndices],
  };
}

function lastSampleMs(block: MouseSampleBlock): number {
  let elapsedUs = 0;
  for (let i = 1; i < block.dtUs.length; i++) elapsedUs += block.dtUs[i];
  return block.t0Ms + elapsedUs / 1000;
}

/**
 * 對 golden 內嵌的時間通道重跑 `segmentByTimeGap()`，回傳**逐位**不符之處。空陣列 = 重現。
 *
 * 這支斷言的用途是防止**靜默過期**：原語的語意日後變動時，golden 不會自己變紅 —— 它只是一份 JSON。
 * 有了重現斷言，變動當下就會有一個具名的紅燈，而不是等到 T3 拿著一份與現行原語不一致的切段做消融。
 */
export function verifyLiftSegmentationGolden(golden: LiftSegmentationGolden): readonly string[] {
  const mismatches: string[] = [];
  if (golden.version !== LIFT_SEGMENTATION_GOLDEN_VERSION) {
    mismatches.push(`version ${golden.version} !== ${LIFT_SEGMENTATION_GOLDEN_VERSION}`);
  }
  if (golden.sampleCount !== golden.input.dtUs.length) {
    mismatches.push(`sampleCount ${golden.sampleCount} !== input.dtUs.length ${golden.input.dtUs.length}`);
  }
  if (golden.segmentationsByTheta.map((entry) => entry.thetaMs).join(',') !== GAP_THRESHOLD_SWEEP_MS.join(',')) {
    mismatches.push(
      `theta sweep [${golden.segmentationsByTheta.map((entry) => entry.thetaMs).join(', ')}] !== ` +
        `frozen [${GAP_THRESHOLD_SWEEP_MS.join(', ')}]`,
    );
  }

  // `dx`／`dy` 不影響切段（`segmentByTimeGap()` 只讀 `dtUs`），但它要求三個陣列等長。以零填充重建
  // 一個等長的 block —— 這不是在還原軌跡，是在滿足原語的形狀契約。
  const zeros = golden.input.dtUs.map(() => 0);
  const block: MouseSampleBlock = { t0Ms: golden.input.t0Ms, dtUs: golden.input.dtUs, dx: zeros, dy: zeros };

  for (const expected of golden.segmentationsByTheta) {
    const actual = segmentationAt(block, expected.thetaMs, golden.unlockedIntervals);
    const path = `theta=${expected.thetaMs}`;
    if (JSON.stringify(actual.segments) !== JSON.stringify(expected.segments)) {
      mismatches.push(`${path}.segments: ${expected.segments.length} recorded vs ${actual.segments.length} recomputed`);
    }
    if (JSON.stringify(actual.gaps) !== JSON.stringify(expected.gaps)) {
      mismatches.push(`${path}.gaps: ${expected.gaps.length} recorded vs ${actual.gaps.length} recomputed`);
    }
    if (JSON.stringify(actual.lockGapIndices) !== JSON.stringify(expected.lockGapIndices)) {
      mismatches.push(`${path}.lockGapIndices differs`);
    }
  }
  return mismatches;
}
