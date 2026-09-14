import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { microFlickThreeTargetTestV9 } from '../drill/micro_flick_three_target_test_v9.ts';
import {
  MICRO_FLICK_END_CONDITION_BY_DRILL_ID,
  buildEndConditionByDrillId,
} from '../drill/microFlickEndConditions.ts';
import { createMicroFlickHarness } from '../loop/__tests__/microFlickDeterminismHarness.ts';
import { deriveMicroFlickMetrics } from './microFlickMetrics.ts';

/**
 * WP-68 / T2 — 計分窗**右界**依 `endCondition` 分流（FR-68.3／68.4／68.5）。
 *
 * 被修的錯：`validSpanMs = lastKillMs − firstVisibleMs` 是為 **kill-budget** drill 寫的（最後一顆被
 * 打掉，drill 就結束）。套到**計時制** drill 上，受試者在最後一次擊殺之後仍有真實的剩餘時間在打、
 * 在失手、在找靶，那段被整段排除出分母 ⇒ `killRateHz` 系統性**高估**。
 *
 * 本檔守三件事：計時制取到鐘的右界（FR-68.3）、**kill-budget drill 的四量逐位不變**（FR-68.4，
 * 期望值為 T1 後實測的寫死常數，不是再跑一次實作產生的）、以及右界所依據的事實查不到時一律具名
 * 退回而不猜（FR-68.5）。
 */

const TICK_MS = 1000 / 128;
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const TARGET_DISTANCE_U = 25;
/** `usp_s_laser` 的 cycletime，與 `microFlickMetrics.test.ts` 的合成慣例相同。 */
const MISS_LEAD_MS = 170;

interface PayloadSpec {
  readonly drillId: string;
  /** 擊殺時刻（ms）。每次擊殺前 `MISS_LEAD_MS` 另有一發失手。 */
  readonly killTimesMs: readonly number[];
  /** 最後一個 tick 的 `t`。計時制的右界就是它——刻意遠大於最後一次擊殺，好讓兩種右界分得開。 */
  readonly lastTickMs: number;
}

function positionAtYaw(yawDeg: number): { x: number; y: number; z: number } {
  const rad = (yawDeg * Math.PI) / 180;
  return {
    x: EYE.x + TARGET_DISTANCE_U * Math.sin(rad),
    y: EYE.y,
    z: EYE.z - TARGET_DISTANCE_U * Math.cos(rad),
  };
}

function tickAt(t: number): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: null,
    ty: null,
    tz: null,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

/**
 * 合成一份 micro-flick 形狀的匯出：三顆在 t = 0 同時現身，依序被殺，每次擊殺前一發失手。
 *
 * 關鍵是 `lastTickMs` 與最後一次擊殺**刻意拉開**——這正是 kill-budget 與計時制兩種右界的差別所在。
 * 決定性：無 `Math.random()`（GD-5）、無時鐘（ADR-4）。
 */
function buildPayload(spec: PayloadSpec): ExportPayload {
  const events: DrillEvent[] = [];
  const ids = ['t0', 't1', 't2'];
  const yaws = [0, -9, 9];
  ids.forEach((targetId, index) => {
    const pos = positionAtYaw(yaws[index]);
    events.push({
      type: 'visible',
      targetId,
      side: index % 2 === 0 ? 'L' : 'R',
      t: 0,
      targetX: pos.x,
      targetY: pos.y,
      targetZ: pos.z,
    });
  });

  spec.killTimesMs.forEach((tKillMs, index) => {
    events.push({
      type: 'fire',
      t: tKillMs - MISS_LEAD_MS,
      hit: false,
      firstShot: true,
      residualSpeed: 0,
      targetId: ids[0],
      ammo: 12,
    });
    events.push({
      type: 'fire',
      t: tKillMs,
      hit: true,
      firstShot: false,
      residualSpeed: 0,
      targetId: ids[index],
      ammo: 11,
    });
  });

  const ticks: TickRecord[] = [];
  for (let t = 0; t <= spec.lastTickMs + 1e-9; t += TICK_MS) ticks.push(tickAt(t));
  // 右界取「最後一個 tick 的 t」⇒ 讓它精確等於宣告值，斷言才能用 `toBe` 而不是 `toBeCloseTo`。
  ticks[ticks.length - 1] = tickAt(spec.lastTickMs);

  return {
    meta: {
      drillId: spec.drillId,
      simToWorld: 1,
      scene: { sceneId: 'micro-flick-room-v9', eye: { ...EYE } },
    } as ExportPayload['meta'],
    ticks,
    events,
  };
}

function outcomeFor(spec: PayloadSpec): ReturnType<typeof deriveMicroFlickMetrics>['outcome'] {
  return deriveMicroFlickMetrics(buildPayload(spec), { eye: { strictEyeOrigin: true } }).outcome;
}

const KILLS = [1000, 1600, 2300] as const;
/** 最後一殺在 2300 ms，鐘卻走到 10 000 ms ⇒ 7.7 s 的尾段正是舊定義整段丟掉的那一塊。 */
const LAST_TICK_MS = 10000;

describe('WP-68 T2 — FR-68.3：計時制 drill 的計分窗右界取到鐘尾，不截在最後一次擊殺', () => {
  const v9 = outcomeFor({
    drillId: microFlickThreeTargetTestV9.drill.drillId,
    killTimesMs: KILLS,
    lastTickMs: LAST_TICK_MS,
  });

  it('右界 = 最後一個 tick，而不是最後一次擊殺', () => {
    expect(v9.validSpanMs).toBe(LAST_TICK_MS);
    expect(v9.flags).not.toContain('scoring_window_truncated_at_last_kill');
    expect(v9.flags).not.toContain('unknown_end_condition');
  });

  it('killRateHz 用的是整段鐘 —— 舊定義會高估 335%', () => {
    expect(v9.n).toBe(3);
    expect(v9.killRateHz).toBe(3 / (LAST_TICK_MS / 1000));

    // 舊右界（截在最後一殺 2300 ms）下的同一份資料。
    const truncatedSpanMs = KILLS.at(-1)!;
    const truncatedKillRateHz = 3 / (truncatedSpanMs / 1000);
    expect(truncatedKillRateHz / v9.killRateHz!).toBeCloseTo(LAST_TICK_MS / truncatedSpanMs, 10);
    // 偏誤方向恆為高估（KI-037 恆向低估，方向相反、性質相同）。
    expect(truncatedKillRateHz).toBeGreaterThan(v9.killRateHz!);
  });

  it('尾段的失手也進分母：shotAccuracy 涵蓋整個計分窗', () => {
    // 3 中 3 失 ⇒ 6 發。尾段沒有額外開火，故此處與舊定義同值；下一條才是右界真的改變發數的案例。
    expect(v9.shotsPerKill).toBe(2);
    expect(v9.shotAccuracy).toBe(0.5);
  });

  it('最後一殺之後才開的槍，舊右界會整段漏掉、新右界會算進去', () => {
    const payload = buildPayload({
      drillId: microFlickThreeTargetTestV9.drill.drillId,
      killTimesMs: KILLS,
      lastTickMs: LAST_TICK_MS,
    });
    // 最後一殺（2300）之後、鐘尾（10 000）之前的三發空槍——真實計時制 run 的尾段就是長這樣。
    for (const t of [5000, 6000, 7000]) {
      payload.events.push({
        type: 'fire',
        t,
        hit: false,
        firstShot: false,
        residualSpeed: 0,
        targetId: 't0',
        ammo: 10,
      });
    }
    const outcome = deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } }).outcome;
    // 6 發 + 尾段 3 發 = 9 發 3 中。舊右界會停在 6 發 ⇒ shotAccuracy 0.5 而不是 1/3。
    expect(outcome.shotsPerKill).toBe(3);
    expect(outcome.shotAccuracy).toBe(1 / 3);
  });
});

describe('WP-68 T2 — FR-68.4：kill-budget drill（v8）的四量逐位不變', () => {
  /**
   * **期望值為 T1 後（commit `c81778f`）實測的寫死常數**，不是再跑一次實作產生的——後者會把任何
   * 回歸連同結果一起抄進測試，這條斷言就變成恆真（T2 Steps 4 的明文要求）。
   *
   * 取得方式：於 `c81778f` 的 worktree 上對同一份 harness canonical payload 跑
   * `deriveMicroFlickMetrics()`，印出 `outcome` 的四量。
   */
  const PRE_T2_V8_OUTCOME = {
    validSpanMs: 6832.1875,
    killRateHz: 2.634588116909848,
    shotsPerKill: 2,
    shotAccuracy: 0.5,
  } as const;

  const harness = createMicroFlickHarness(microFlickThreeTargetTestV8, {
    expectedTicks: 900,
    approachAmplitudeDeg: [1.5, 9],
    approachDecay: 0.97,
    clickPeriodMs: 190,
  });

  it('真 v8 run 的四量對 T1 後的值逐位 Object.is 相同（FM-1）', () => {
    const outcome = harness.canonicalMetrics.outcome;
    expect(Object.is(outcome.validSpanMs, PRE_T2_V8_OUTCOME.validSpanMs)).toBe(true);
    expect(Object.is(outcome.killRateHz, PRE_T2_V8_OUTCOME.killRateHz)).toBe(true);
    expect(Object.is(outcome.shotsPerKill, PRE_T2_V8_OUTCOME.shotsPerKill)).toBe(true);
    expect(Object.is(outcome.shotAccuracy, PRE_T2_V8_OUTCOME.shotAccuracy)).toBe(true);
  });

  it('v8 的右界語意被具名出來（旗標是新的，數字不是）', () => {
    expect(harness.canonicalMetrics.outcome.flags).toContain(
      'scoring_window_truncated_at_last_kill',
    );
    expect(harness.canonicalMetrics.outcome.flags).not.toContain('unknown_end_condition');
  });

  it('即使 tick 遠遠走到最後一殺之後，v8 的右界仍截在最後一殺', () => {
    const v8 = outcomeFor({
      drillId: microFlickThreeTargetTestV8.drill.drillId,
      killTimesMs: KILLS,
      lastTickMs: LAST_TICK_MS,
    });
    // 同一份資料、同一條 tick 尾巴，v9 得到 10 000（見上一個 describe），v8 必須得到 2300。
    expect(v8.validSpanMs).toBe(KILLS.at(-1));
    expect(v8.flags).toContain('scoring_window_truncated_at_last_kill');
  });
});

describe('WP-68 T2 — FR-68.5：右界的依據查不到時具名退回，不猜（FM-2）', () => {
  it('未知 drillId ⇒ unknown_end_condition + 退回既有語意', () => {
    const outcome = outcomeFor({
      drillId: 'some_drill_that_is_not_registered_v0',
      killTimesMs: KILLS,
      lastTickMs: LAST_TICK_MS,
    });
    expect(outcome.flags).toContain('unknown_end_condition');
    // 退回的是**既有**語意（截在最後一殺），不是猜成 timeLimit——猜錯的方向剛好讓 killRateHz 變好看。
    expect(outcome.flags).toContain('scoring_window_truncated_at_last_kill');
    expect(outcome.validSpanMs).toBe(KILLS.at(-1));
    expect(outcome.killRateHz).toBe(3 / (KILLS.at(-1)! / 1000));
  });

  it('計時制但 tick 紀錄截斷在最後一殺之前 ⇒ 退回，且 shotAccuracy 不得 > 1', () => {
    // 回歸：T2 導入鐘右界時曾讓這條路徑算出 **shotAccuracy 1.5**（機率 > 1）與
    // **shotsPerKill 0.667**（發數少於擊殺數），且**零旗標**。根因：tick 被 recorder 溢位
    // 截斷後，`n` 仍計全部擊殺而 `shots` 只數窗內的 ⇒ 分子與分母對不上同一個窗。
    // 舊實作不可能出這種值（右界恆為 `lastKillMs`，依定義涵蓋全部擊殺）。
    const payload = buildPayload({
      drillId: microFlickThreeTargetTestV9.drill.drillId,
      killTimesMs: KILLS,
      lastTickMs: LAST_TICK_MS,
    });
    // tick 停在 1200 ms，而最後一殺在 2300 ms。
    const truncated = payload.ticks.filter((tick) => tick.t <= 1200);
    const outcome = deriveMicroFlickMetrics(
      { ...payload, ticks: truncated },
      { eye: { strictEyeOrigin: true } },
    ).outcome;

    expect(outcome.flags).toContain('scoring_window_truncated_at_last_kill');
    expect(outcome.validSpanMs).toBe(KILLS.at(-1));
    // 不變式：分子與分母必須對的是同一個窗。
    expect(outcome.shotAccuracy).toBeLessThanOrEqual(1);
    expect(outcome.shotsPerKill).toBeGreaterThanOrEqual(1);
  });

  it('計時制但匯出沒有任何 tick ⇒ 無從定出鐘的右界，同樣具名退回', () => {
    const payload = buildPayload({
      drillId: microFlickThreeTargetTestV9.drill.drillId,
      killTimesMs: KILLS,
      lastTickMs: LAST_TICK_MS,
    });
    const outcome = deriveMicroFlickMetrics(
      { ...payload, ticks: [] },
      { eye: { strictEyeOrigin: true } },
    ).outcome;
    expect(outcome.flags).toContain('scoring_window_truncated_at_last_kill');
    // 結束條件本身是查得到的 ⇒ 不該亮 unknown_end_condition，兩件事不可混為一談。
    expect(outcome.flags).not.toContain('unknown_end_condition');
    expect(outcome.validSpanMs).toBe(KILLS.at(-1));
  });
});

describe('WP-68 T2 — endCondition 查表的建構期紀律', () => {
  it('九支 micro-flick 的結束條件全部讀自各自的 config，v1–v8 kill-budget、v9 計時制', () => {
    expect(MICRO_FLICK_END_CONDITION_BY_DRILL_ID.size).toBe(9);
    expect(
      MICRO_FLICK_END_CONDITION_BY_DRILL_ID.get(microFlickThreeTargetTestV8.drill.drillId),
    ).toEqual({ type: 'targetCount', value: 60 });
    expect(
      MICRO_FLICK_END_CONDITION_BY_DRILL_ID.get(microFlickThreeTargetTestV9.drill.drillId),
    ).toEqual({ type: 'timeLimit', value: 60000 });
  });

  it('同一個 drillId 登記兩次 ⇒ 模組建構期就炸，而不是靜默取先到的那筆', () => {
    expect(() =>
      buildEndConditionByDrillId([
        ['dup_v1', { type: 'targetCount', value: 60 }],
        ['dup_v1', { type: 'timeLimit', value: 60000 }],
      ]),
    ).toThrow(/declares both/);
  });
});
