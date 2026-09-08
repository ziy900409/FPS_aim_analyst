import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { SPIDER_SHOT_WIDE_HITBOX } from '../drill/spider_shot_wide_v1.ts';
import { SPIDER_WIDE_DISTANCE_U } from '../drill/spiderShotWide.ts';
import { deriveMouseThrow } from './mouseThrow.ts';
import { deriveRepositioningSuspicion } from './spiderShotRepositioning.ts';

/**
 * WP-57 / T5 —— FR-57.12：抬滑鼠疑慮標註。
 *
 * 合成訊號的**時間邊界一律由 builder 在產生時回報**（`BuiltTrial`），不手寫魔術常數：期望值因此
 * 綁在真正被記錄下來的 tick 上，而不是綁在我對 builder 的記憶上。
 *
 * ⚠️ **本檔的所有 run 都是合成的**，其 ground truth 是注入的。§E 因此只是**對偵測器機制**的刻畫：
 * 它能驗「偵測器有沒有把方向搞反」，**不能用來選門檻**。
 *
 * ⚠️ **2026-09-08：§E 的兩個結論已被真人資料推翻**（四份真人 run，見 WP-57 progress §T5-real）：
 * ① 交付門檻改為 `stallMinMs = 150`／`stallOmegaDegPerSec = 2`；本檔的 `SYNTHETIC_SEPARATION_OPTIONS`
 *    （`100 / 15`）在真人資料上會標掉 44% 的「全程不抬滑鼠」run，**不是交付值**。
 * ② 「分離兩者的是 ω 軸」錯了 —— 真人資料上四個 run 的最小 `|omega|` 全部是 0.0（取樣造成，見 KI-031），
 *    真正的分離軸是 **duration @ 緊 ω 門檻**。
 * 下方測試保留為**偵測器機制**的單元測試（窗界、最長區段、typed error、C-D3/C-D4 boundary），那部分未被推翻。
 */

const TICK_MS = 10;
const PERIPHERAL_YAW_DEG = 50;
const DEFAULT_CENTER_HOLD_MS = 200;
const DEFAULT_REACTION_MS = 20;
const DEFAULT_ON_TARGET_HOLD_MS = 100;
const LEG_MS = 30;
const HALFWAY = 0.5;

/** 合成訊號的 detection 參數：短 baseline + 單 tick 即算 onset，使 `tDetectMs` 落在可預測的 tick。 */
const DETECTION = { preStimulusMs: 50, sustainedTicks: 1, thresholdSdMultiplier: 0 } as const;

const CENTER = { x: 0, y: 0, z: -SPIDER_WIDE_DISTANCE_U };

interface TrialSpec {
  readonly targetId: string;
  readonly side: 'L' | 'R';
  /** 拉槍中途注入的停滯長度（ms）。0 = 一次到位。 */
  readonly stallMs: number;
  /** 停滯期間的殘餘角速度（deg/s）。抬滑鼠 = 手離開滑鼠 ⇒ 近零；刻意停頓 = 手仍在滑鼠上 ⇒ 微顫。 */
  readonly stallDriftDegPerSec?: number;
  /** 同一次拉槍的第二段停滯（ms），注入在 75% 進度處。用來驗「回報最長的那一段」。 */
  readonly secondStallMs?: number;
  /** onset 之前的靜止時間（ms）。加長即得「窗界外（movement onset 之前）的停滯」。 */
  readonly reactionMs?: number;
  /** 首次 on-target 之後的靜止時間（ms）。加長即得「窗界外（on-target 之後）的停滯」。 */
  readonly onTargetHoldMs?: number;
  readonly centerHoldMs?: number;
}

interface BuiltTrial {
  readonly targetId: string;
  readonly peripheralVisibleMs: number;
  /** 預期的 canonical movement onset（第一個離心率下降的 tick）。 */
  readonly onsetMs: number;
  /** 最長停滯區段第一個 ω 樣本的 tick；沒有停滯時為 `undefined`。 */
  readonly stallFirstTickMs?: number;
  /** 預期的 `stallDurationMs` = 最長注入段 `− TICK_MS`（ω 樣本描述的是區間右端點，見模組註解）。 */
  readonly stallDurationMs?: number;
  /** 預期的首次 on-target tick。 */
  readonly arrivalMs: number;
}

interface BuiltPayload {
  readonly payload: ExportPayload;
  readonly trials: readonly BuiltTrial[];
}

describe('WP-57 T5 — 四類合成訊號的分類（FR-57.12）', () => {
  it('flags a true mid-flick stall and reports the stall it actually found', () => {
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 200 }]);
    const trial = built.trials[0];

    const [suspicion] = deriveRepositioningSuspicion(built.payload, {
      stallMinMs: 100,
      stallOmegaDegPerSec: 30,
      detection: DETECTION,
    });

    expect(suspicion).toEqual({
      targetId: 'p1',
      suspected: true,
      stallStartMs: trial.stallFirstTickMs,
      stallDurationMs: trial.stallDurationMs,
    });
    // 量到的長度比注入的短恰一個 tick 間隔 —— 保守側，見 `RepositioningSuspicion.stallDurationMs`。
    expect(trial.stallDurationMs).toBe(200 - TICK_MS);
  });

  it('does not flag a deliberate pause shorter than the threshold', () => {
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 60 }]);

    expect(built.trials[0].stallDurationMs).toBe(50);
    expect(
      deriveRepositioningSuspicion(built.payload, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([{ targetId: 'p1', suspected: false }]);
  });

  it('does not flag a single ballistic flick with no stall at all', () => {
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 0 }]);

    expect(built.trials[0].stallFirstTickMs).toBeUndefined();
    expect(
      deriveRepositioningSuspicion(built.payload, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([{ targetId: 'p1', suspected: false }]);
  });

  it('ignores a long stall that sits before movement onset', () => {
    // 500 ms 完全靜止，但全部落在 `tDetectMs` 之前 —— 那是反應時間，不是拉槍中途抬滑鼠。
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 0, reactionMs: 500 }]);
    const trial = built.trials[0];

    expect(trial.onsetMs - trial.peripheralVisibleMs).toBe(500);
    expect(
      deriveRepositioningSuspicion(built.payload, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([{ targetId: 'p1', suspected: false }]);
  });

  it('ignores a long stall that sits after the first on-target sample', () => {
    // 命中後停在目標上 600 ms 是正常的射擊行為,不是拉槍被中斷。
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 0, onTargetHoldMs: 600 }]);

    expect(
      deriveRepositioningSuspicion(built.payload, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([{ targetId: 'p1', suspected: false }]);
  });
});

describe('WP-57 T5 — 窗界語意與型別邊界', () => {
  it('annotates every peripheral arrival in order and leaves center returns out of the母體', () => {
    const built = buildPayload([
      { targetId: 'p1', side: 'R', stallMs: 200 },
      { targetId: 'p2', side: 'L', stallMs: 0 },
      { targetId: 'p3', side: 'R', stallMs: 250 },
    ]);

    const suspicions = deriveRepositioningSuspicion(built.payload, {
      stallMinMs: 100,
      stallOmegaDegPerSec: 30,
      detection: DETECTION,
    });

    expect(suspicions.map((entry) => entry.targetId)).toEqual(['p1', 'p2', 'p3']);
    expect(suspicions.map((entry) => entry.suspected)).toEqual([true, false, true]);
    // 中心目標（`zone: 'center'`）確實存在於 payload,但不出現在輸出。
    expect(built.payload.events.filter((event) => event.type === 'visible' && event.zone === 'center').length).toBe(3);
  });

  it('reports the longest stall when one flick is interrupted twice', () => {
    // 兩段停滯,長的在後：輸出必須指向後面那一段,而不是先遇到的那一段。
    const lateLonger = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 120, secondStallMs: 300 }]);
    // 反過來：長的在前。
    const earlyLonger = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 300, secondStallMs: 120 }]);
    const options = { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION } as const;

    const late = deriveRepositioningSuspicion(lateLonger.payload, options)[0];
    const early = deriveRepositioningSuspicion(earlyLonger.payload, options)[0];

    expect(late).toEqual({
      targetId: 'p1',
      suspected: true,
      stallStartMs: lateLonger.trials[0].stallFirstTickMs,
      stallDurationMs: 290,
    });
    expect(early).toEqual({
      targetId: 'p1',
      suspected: true,
      stallStartMs: earlyLonger.trials[0].stallFirstTickMs,
      stallDurationMs: 290,
    });
    // 兩者指向的是不同的時刻 —— 否則上面兩條斷言可能只是同一個位置碰巧都對。
    expect(late.stallStartMs).not.toBe(early.stallStartMs);
  });

  it('returns suspected=false without fields when the window has no canonical end (acquisition failure)', () => {
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 200 }]);
    // 把所有 tick 的 aim 停在半途 ⇒ 永遠不 on-target ⇒ 窗右界不存在 ⇒ 無從判定。
    const stalled: ExportPayload = {
      ...built.payload,
      ticks: built.payload.ticks.map((tick) => ({ ...tick, aim: { yaw: tick.aim.yaw * HALFWAY, pitch: 0 } })),
    };

    expect(
      deriveRepositioningSuspicion(stalled, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([{ targetId: 'p1', suspected: false }]);
  });

  it('returns an empty list for a payload with no peripheral presentation', () => {
    const built = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 200 }]);
    const centerOnly: ExportPayload = {
      ...built.payload,
      events: built.payload.events.filter((event) => event.type !== 'visible' || event.zone !== 'peripheral'),
    };

    expect(
      deriveRepositioningSuspicion(centerOnly, { stallMinMs: 100, stallOmegaDegPerSec: 30, detection: DETECTION }),
    ).toEqual([]);
  });

  it('throws typed errors instead of silently degrading on non-finite thresholds', () => {
    const { payload } = buildPayload([{ targetId: 'p1', side: 'R', stallMs: 200 }]);

    expect(() => deriveRepositioningSuspicion(payload, { stallMinMs: -1, stallOmegaDegPerSec: 30 })).toThrow(
      /stallMinMs must be a non-negative finite number/,
    );
    expect(() => deriveRepositioningSuspicion(payload, { stallMinMs: Number.NaN, stallOmegaDegPerSec: 30 })).toThrow(
      /stallMinMs/,
    );
    expect(() => deriveRepositioningSuspicion(payload, { stallMinMs: 100, stallOmegaDegPerSec: 0 })).toThrow(
      /stallOmegaDegPerSec must be a positive finite number/,
    );
  });
});

describe('WP-57 T5 — C-D4：沒有第二套 ω 或第二套窗界', () => {
  const source = readFileSync(fileURLToPath(new URL('./spiderShotRepositioning.ts', import.meta.url)), 'utf-8');
  // 掃描對象是**程式碼**,不是註解 —— 沿用 `domain-purity-boundary.test.ts` 的既有教訓:註解正當地
  // 「提到」禁用符號來解釋為什麼不用它們,拿 prose 當違規會逼人把說明刪掉。
  const code = codeOnly(source);

  it('takes omega, movement onset and first on-target from the canonical modules', () => {
    expect(code).toMatch(/import \{ omegaDegPerSec \} from '\.\/angularKinematics\.ts'/);
    expect(code).toMatch(/deriveDetectionMetrics.*from '\.\/detectionDerivation\.ts'/);
    expect(code).toMatch(/deriveTrackingSamples.*from '\.\/trackingDerivation\.ts'/);
  });

  it('contains no local angular-speed arithmetic of its own', () => {
    // ω 的定義是 `hypot(dYaw·cos(midPitch), dPitch)/dt`（`angularKinematics.ts`）。本模組的程式碼
    // 若出現這些符號,就代表它開始自己算角速度了。
    for (const pattern of [/\bdYaw\b/, /\bdPitch\b/, /Math\.hypot/, /Math\.atan2/, /180 \/ Math\.PI/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('stays a pure function: no DOM, three, node builtins, clock or randomness', () => {
    for (const pattern of [
      /from ['"]three/,
      /from ['"]node:/,
      /Date\.now\s*\(/,
      /performance\.now\s*\(/,
      /Math\.random\s*\(/,
      /document\./,
      /window\./,
      /readFileSync/,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });
});

describe('WP-57 T5 — C-D3：品質標註不得進教練報告、診斷規則或 registry', () => {
  const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));
  const MODULE_NAME = 'spiderShotRepositioning';

  it('is imported by nothing in src/ other than its own test', () => {
    const importers = tsFilesUnder(SRC_ROOT).filter((file) => {
      if (file.endsWith(`${MODULE_NAME}.ts`) || file.endsWith(`${MODULE_NAME}.test.ts`)) return false;
      return readFileSync(file, 'utf-8').includes(MODULE_NAME);
    });

    // 一個「不進教練報告」的宣稱,只有在**沒有任何生產模組看得到它**時才成立。這比逐檔列黑名單強:
    // 新增一條 diagnosis rule 或一個 report builder 也會被這條抓到。
    expect(importers).toEqual([]);
  });

  it('exposes no rate/count shaped output that could be read as a metric', () => {
    const code = codeOnly(readFileSync(fileURLToPath(new URL('./spiderShotRepositioning.ts', import.meta.url)), 'utf-8'));
    for (const pattern of [/repositioningCount/, /repositioningRate/, /suspicionRate/, /Score\b/]) {
      expect(code).not.toMatch(pattern);
    }
  });
});

/** 去掉區塊與行註解，讓 boundary scan 只看得到程式碼。 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * §E —— OQ-57.5 的門檻敏感度與 `cm/360` 方向性檢查。
 *
 * **模型（明確標示為假設，非觀測）**：一次中心↔周邊來回的峰對峰角位移為 `2 × 50°`；換算成實體行程
 * 即 `(100/360) × cm360` cm。可用墊面行程假設 `PAD_FREE_TRAVEL_CM`；超出的比例即被迫抬滑鼠的比例。
 * 抬滑鼠時手離開滑鼠 ⇒ 殘餘角速度近零；刻意停頓時手仍在滑鼠上 ⇒ 有微顫。
 */
const PAD_FREE_TRAVEL_CM = 12;
const LIFT_STALL_MS = 180;
const LIFT_DRIFT_DEG_PER_SEC = 2;
const PAUSE_STALL_MS = 60;
const PAUSE_DRIFT_DEG_PER_SEC = 30;
const COHORT_LIFT_CANDIDATES = 9;
const COHORT_DELIBERATE_PAUSES = 3;
const COHORT_SIZE = COHORT_LIFT_CANDIDATES + COHORT_DELIBERATE_PAUSES;
/**
 * 這個**合成 cohort** 的分離點 —— **不是交付門檻**。交付值由真人資料校準為 `150 / 2`
 * （WP-57 progress §T5-real）；此處保留 `100 / 15` 只是為了讓下方兩個測試描述合成 cohort 自身的行為。
 */
const SYNTHETIC_SEPARATION_OPTIONS = { stallMinMs: 100, stallOmegaDegPerSec: 15 } as const;

describe('WP-57 T5 — OQ-57.5：門檻敏感度與 cm/360 方向性', () => {
  it('reproduces the requested cm/360 through the canonical mouseThrow derivation', () => {
    for (const cmPer360 of [20, 60, 100]) {
      const { payload } = buildCohort(cmPer360);
      expect(deriveMouseThrow(payload).cmPer360).toBeCloseTo(cmPer360, 9);
    }
  });

  it('annotation rate rises with cm/360 rather than falling or staying flat', () => {
    const rates = [20, 30, 45, 60, 80, 100].map((cmPer360) => annotationRate(cmPer360, SYNTHETIC_SEPARATION_OPTIONS));

    // 方向性檢查（T5 step 5）：若這條反向或全平,就是偵測器有問題的訊號,不是資料的性質。
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    // progress.md §T5 的 cm/360 表逐格釘死（分母恆為 12 個 trial）。
    expect(rates.map((rate) => Math.round(rate * COHORT_SIZE))).toEqual([0, 0, 0, 4, 8, 9]);
    expect(rates[rates.length - 1]).toBeGreaterThan(rates[0]);
  });

  it('separates lifts from pauses on the omega axis IN THIS SYNTHETIC COHORT (overturned by real data)', () => {
    const cohort = buildCohort(100); // 全部 9 個候選都被迫抬滑鼠

    // ω 門檻低於刻意停頓的微顫 ⇒ 刻意停頓根本形不成停滯區段,任何 `stallMinMs` 都標不到它。
    // ⚠️ 這是**注入的**微顫（30 °/s）造成的。真人資料上量不到這個微顫（KI-031 的交替取樣讓最小 ω
    // 恆為 0），所以這條性質**只成立於本 cohort**,不可外推 —— 見檔頭 ⚠️ 與 progress §T5-real。
    const tight = deriveRepositioningSuspicion(cohort.payload, { ...SYNTHETIC_SEPARATION_OPTIONS, detection: DETECTION });
    expect(cohort.liftIds.every((id) => flagged(tight, id))).toBe(true);
    expect(cohort.pauseIds.some((id) => flagged(tight, id))).toBe(false);

    // 放寬 ω 門檻到微顫之上、同時把 `stallMinMs` 降到停頓長度以下 ⇒ 刻意停頓開始被誤標。
    const loose = deriveRepositioningSuspicion(cohort.payload, {
      stallMinMs: 40,
      stallOmegaDegPerSec: 60,
      detection: DETECTION,
    });
    expect(cohort.pauseIds.every((id) => flagged(loose, id))).toBe(true);
  });

  it('pins the stallMinMs × stallOmegaDegPerSec sensitivity grid (progress.md §T5 表)', () => {
    // cm/360 = 60 的 cohort：4 個被迫抬滑鼠、3 個刻意停頓、5 個一次到位。表格記 `TP/FP` ——
    // TP = 抬滑鼠被標到（上限 4），FP = 刻意停頓被誤標（上限 3）。
    const expected: Record<number, Record<number, string>> = {
      40: { 5: '4/0', 15: '4/0', 25: '4/0', 45: '4/3' },
      60: { 5: '4/0', 15: '4/0', 25: '4/0', 45: '4/0' },
      80: { 5: '4/0', 15: '4/0', 25: '4/0', 45: '4/0' },
      100: { 5: '4/0', 15: '4/0', 25: '4/0', 45: '4/0' },
      150: { 5: '4/0', 15: '4/0', 25: '4/0', 45: '4/0' },
      200: { 5: '0/0', 15: '0/0', 25: '0/0', 45: '0/0' },
    };
    const cohort = buildCohort(60);
    expect([cohort.liftIds.length, cohort.pauseIds.length, cohort.cleanIds.length]).toEqual([4, 3, 5]);

    const actual: Record<number, Record<number, string>> = {};
    for (const stallMinMs of [40, 60, 80, 100, 150, 200]) {
      actual[stallMinMs] = {};
      for (const stallOmegaDegPerSec of [5, 15, 25, 45]) {
        const suspicions = deriveRepositioningSuspicion(cohort.payload, {
          stallMinMs,
          stallOmegaDegPerSec,
          detection: DETECTION,
        });
        const tp = cohort.liftIds.filter((id) => flagged(suspicions, id)).length;
        const fp = cohort.pauseIds.filter((id) => flagged(suspicions, id)).length;
        // 一次到位的 trial 在整張表上都不該被標到 —— 若被標到,偵測器就是在標移動本身。
        expect(cohort.cleanIds.some((id) => flagged(suspicions, id))).toBe(false);
        actual[stallMinMs][stallOmegaDegPerSec] = `${tp}/${fp}`;
      }
    }

    expect(actual).toEqual(expected);
  });
});

function annotationRate(cmPer360: number, options: { stallMinMs: number; stallOmegaDegPerSec: number }): number {
  const { payload } = buildCohort(cmPer360);
  const suspicions = deriveRepositioningSuspicion(payload, { ...options, detection: DETECTION });
  return suspicions.filter((entry) => entry.suspected).length / suspicions.length;
}

function flagged(suspicions: readonly { targetId: string; suspected: boolean }[], targetId: string): boolean {
  return suspicions.find((entry) => entry.targetId === targetId)?.suspected === true;
}

/** 超出可用墊面行程的比例；0 = 從不需要抬滑鼠，1 = 每一次都要。 */
function liftFraction(cmPer360: number): number {
  const travelCm = ((2 * PERIPHERAL_YAW_DEG) / 360) * cmPer360;
  return Math.min(1, Math.max(0, (travelCm - PAD_FREE_TRAVEL_CM) / PAD_FREE_TRAVEL_CM));
}

interface Cohort {
  readonly payload: ExportPayload;
  readonly liftIds: readonly string[];
  readonly pauseIds: readonly string[];
  readonly cleanIds: readonly string[];
}

function buildCohort(cmPer360: number): Cohort {
  const liftCount = Math.round(liftFraction(cmPer360) * COHORT_LIFT_CANDIDATES);
  const liftIds: string[] = [];
  const pauseIds: string[] = [];
  const cleanIds: string[] = [];
  const specs: TrialSpec[] = [];

  for (let i = 0; i < COHORT_SIZE; i++) {
    const targetId = `p${i}`;
    const side = i % 2 === 0 ? 'R' : 'L';
    if (i >= COHORT_LIFT_CANDIDATES) {
      pauseIds.push(targetId);
      specs.push({ targetId, side, stallMs: PAUSE_STALL_MS, stallDriftDegPerSec: PAUSE_DRIFT_DEG_PER_SEC });
      continue;
    }
    if (i < liftCount) {
      liftIds.push(targetId);
      specs.push({ targetId, side, stallMs: LIFT_STALL_MS, stallDriftDegPerSec: LIFT_DRIFT_DEG_PER_SEC });
      continue;
    }
    cleanIds.push(targetId);
    specs.push({ targetId, side, stallMs: 0 });
  }

  return { payload: buildPayload(specs, cmPer360).payload, liftIds, pauseIds, cleanIds };
}

/**
 * 逐 tick 生成一段 center↔peripheral 交替的 run，並回報每個 trial 的真實時間邊界。
 *
 * `sensitivityCmPer360` 給定時，`meta.sensitivity` 由 `deriveMouseThrow()` 自身的線性關係反解
 * （`cm/360 ∝ 1/sensitivity`），故 x 軸來自 T4 交付的正規推導，而不是測試裡另寫一條換算式。
 */
function buildPayload(trials: readonly TrialSpec[], sensitivityCmPer360?: number): BuiltPayload {
  const ticks: ExportPayload['ticks'] = [];
  const events: ExportPayload['events'] = [];
  const built: BuiltTrial[] = [];
  let t = 0;
  let yaw = 0;

  const emit = (target: typeof CENTER, nextYaw: number): number => {
    const at = t;
    ticks.push({
      t: at,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      aim: { yaw: nextYaw, pitch: 0 },
      keys: [],
      ads: false,
      dYaw: nextYaw - yaw,
      dPitch: 0,
    });
    yaw = nextYaw;
    t += TICK_MS;
    return at;
  };
  const hold = (ms: number, target: typeof CENTER, driftRadPerTick = 0): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) emit(target, yaw + driftRadPerTick);
  };
  /** 回傳最後一個 tick 的時間戳（= 抵達 `to` 的那一刻）。 */
  const ramp = (ms: number, target: typeof CENTER, to: number): number => {
    const steps = ms / TICK_MS;
    const from = yaw;
    let last = t;
    for (let step = 1; step <= steps; step++) last = emit(target, from + ((to - from) * step) / steps);
    return last;
  };

  for (const spec of trials) {
    const peripheral = peripheralPoint(spec.side);
    const peripheralYaw = aimYaw(peripheral);

    events.push(visible(`c-${spec.targetId}`, 'center', CENTER, t, spec.side));
    ramp(LEG_MS, CENTER, 0);
    hold(spec.centerHoldMs ?? DEFAULT_CENTER_HOLD_MS, CENTER);

    const peripheralVisibleMs = t;
    events.push(visible(spec.targetId, 'peripheral', peripheral, peripheralVisibleMs, spec.side));
    hold(spec.reactionMs ?? DEFAULT_REACTION_MS, peripheral);

    const onsetMs = t;
    ramp(LEG_MS, peripheral, peripheralYaw * HALFWAY);

    const drift = degPerSecToRadPerTick(spec.stallDriftDegPerSec ?? 0);
    const firstStallTickMs = spec.stallMs > 0 ? t : undefined;
    hold(spec.stallMs, peripheral, drift);

    let secondStallTickMs: number | undefined;
    if (spec.secondStallMs !== undefined) {
      ramp(LEG_MS, peripheral, peripheralYaw * 0.75);
      secondStallTickMs = spec.secondStallMs > 0 ? t : undefined;
      hold(spec.secondStallMs, peripheral, drift);
    }
    const arrivalMs = ramp(LEG_MS, peripheral, peripheralYaw);
    hold(spec.onTargetHoldMs ?? DEFAULT_ON_TARGET_HOLD_MS, peripheral);

    const longest =
      (spec.secondStallMs ?? 0) > spec.stallMs
        ? { ms: spec.secondStallMs as number, tick: secondStallTickMs }
        : { ms: spec.stallMs, tick: firstStallTickMs };

    built.push({
      targetId: spec.targetId,
      peripheralVisibleMs,
      onsetMs,
      ...(longest.tick !== undefined
        ? { stallFirstTickMs: longest.tick, stallDurationMs: longest.ms - TICK_MS }
        : {}),
      arrivalMs,
    });
  }

  return { payload: { meta: metaFor(sensitivityCmPer360), ticks, events }, trials: built };
}

function peripheralPoint(side: 'L' | 'R'): typeof CENTER {
  const radians = (PERIPHERAL_YAW_DEG * Math.PI) / 180;
  return {
    x: (side === 'R' ? 1 : -1) * Math.sin(radians) * SPIDER_WIDE_DISTANCE_U,
    y: 0,
    z: -Math.cos(radians) * SPIDER_WIDE_DISTANCE_U,
  };
}

function aimYaw(point: typeof CENTER): number {
  return Math.atan2(-point.x, -point.z);
}

function degPerSecToRadPerTick(degPerSec: number): number {
  return ((degPerSec * Math.PI) / 180) * (TICK_MS / 1000);
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: typeof CENTER,
  t: number,
  side: 'L' | 'R',
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, side, zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}

/** `sensitivity = 1` 時的 cm/360，用來把想要的 cm/360 反解成 `meta.sensitivity`（見 buildPayload）。 */
const CM_PER_360_AT_UNIT_SENSITIVITY = deriveMouseThrow({
  meta: baseMeta(1),
  ticks: [],
  events: [],
}).cmPer360 as number;

function metaFor(cmPer360: number | undefined): Meta {
  return baseMeta(cmPer360 === undefined ? 1 : CM_PER_360_AT_UNIT_SENSITIVITY / cmPer360);
}

function baseMeta(sensitivity: number): Meta {
  return {
    schemaVersion: 2,
    drillId: 'spider-shot-wide-v1',
    weaponId: 'usp_s_laser',
    weaponSeed: 0,
    rngSeed: 57001,
    backend: 'webgpu',
    displayHz: 144,
    simHz: 100,
    browser: 'test-browser',
    sensitivity,
    dpi: 800,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    crossOriginIsolated: true,
    startedAt: '2026-09-08T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 300,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    simToWorld: 1,
    scene: {
      sceneId: 'wide-flick-arena',
      assetPackVersion: 'synthetic-v1',
      clutterTier: 'low',
      fallback: false,
      eye: { x: 0, y: 0, z: 0 },
    },
    targets: {
      hitbox: {
        widthU: SPIDER_SHOT_WIDE_HITBOX.widthU,
        heightU: SPIDER_SHOT_WIDE_HITBOX.heightU,
        depthU: SPIDER_SHOT_WIDE_HITBOX.depthU,
        shape: SPIDER_SHOT_WIDE_HITBOX.shape,
      },
    },
    spawn: { seed: 57001 },
  };
}

function tsFilesUnder(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = `${root}/${entry}`;
    if (statSync(path).isDirectory()) {
      found.push(...tsFilesUnder(path));
      continue;
    }
    if (entry.endsWith('.ts')) found.push(path);
  }
  return found;
}
