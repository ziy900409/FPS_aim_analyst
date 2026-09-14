import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import {
  MICRO_FLICK_V8_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV8,
} from '../drill/micro_flick_three_target_test_v8.ts';
import { microFlickThreeTargetTestV1 } from '../drill/micro_flick_three_target_test_v1.ts';
import { microFlickThreeTargetTestV2 } from '../drill/micro_flick_three_target_test_v2.ts';
import { microFlickThreeTargetTestV3 } from '../drill/micro_flick_three_target_test_v3.ts';
import { microFlickThreeTargetTestV4 } from '../drill/micro_flick_three_target_test_v4.ts';
import { microFlickThreeTargetTestV5 } from '../drill/micro_flick_three_target_test_v5.ts';
import { microFlickThreeTargetTestV6 } from '../drill/micro_flick_three_target_test_v6.ts';
import { microFlickThreeTargetTestV7 } from '../drill/micro_flick_three_target_test_v7.ts';
import { aimForward, angularDistanceDeg } from './eyeOrigin.ts';
import { createRan1 } from '../recoil/rng.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { Vec3 } from '../state/types.ts';
import {
  DEFAULT_DIRECTION_WINDOWS_MS,
  MICRO_FLICK_DIRECTION_FLAG_VOCABULARY,
  MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY,
  MICRO_FLICK_MICRO_ADJUST_FLAG_VOCABULARY,
  MICRO_FLICK_OUTCOME_FLAG_VOCABULARY,
  MICRO_FLICK_SELECTION_FLAG_VOCABULARY,
  deriveMicroFlickMetrics,
  type MicroFlickGeometryMetrics,
  type MicroFlickMetrics,
  type MicroFlickTargetMicroAdjust,
} from './microFlickMetrics.ts';

const TICK_MS = 1000 / 128;
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const TARGET_DISTANCE_U = 25;

// ---------------------------------------------------------------------------
// 手算 3-target 小案例（T4 Steps 5）
//
// 三顆都放在通過 eye 的同一個水平面上、距 eye 等距,方位角為 `yawDeg`。於是任意兩顆之間以 eye
// 為頂點的球面角**恰好等於 yawDeg 之差** —— 每個期望值都可以用紙筆寫下來,不需要跑實作來產生
// 「期望值」（那會讓測試變成把實作抄一遍）。
// ---------------------------------------------------------------------------

describe('WP-63 T4 — L0 結果層（FR-63.6）', () => {
  const payload = scenario(HAND_CASE);
  const metrics = deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } });

  it('這份 hitscan fixture 完全沒有 hit 事件——擊殺時刻只能來自 fire.hit === true（README §0.3）', () => {
    expect(payload.events.some((event) => event.type === 'hit')).toBe(false);
    expect(payload.events.filter((event) => event.type === 'fire' && event.hit).length).toBe(4);
    // 照抄 `t_hit` 的實作在這裡會拿到空陣列而靜默回 0 樣本;下面四條期望值就是它的照妖鏡。
    expect(metrics.outcome.n).toBe(4);
    expect(metrics.outcome.killIntervalP50Ms).toBeCloseTo(700, 10);
    expect(metrics.outcome.killIntervalP90Ms).toBeCloseTo(1100, 10);
    expect(metrics.outcome.validSpanMs).toBeCloseTo(3500, 10);
  });

  it('五量對上手算期望值', () => {
    // T_valid = [第一個 visible 0 ms, 最後一次擊殺 3500 ms] = 3500 ms;4 kills。
    expect(metrics.outcome.killRateHz).toBeCloseTo(4 / 3.5, 10);
    // 每次擊殺前各一發失手 ⇒ 8 發 4 中。
    expect(metrics.outcome.shotsPerKill).toBeCloseTo(2, 10);
    expect(metrics.outcome.shotAccuracy).toBeCloseTo(0.5, 10);
    // 擊殺於 1000 / 1600 / 2300 / 3500 ⇒ 間隔 [600, 700, 1200]。
    expect(metrics.outcome.killIntervalP50Ms).toBeCloseTo(700, 10);
    expect(metrics.outcome.killIntervalP90Ms).toBeCloseTo(700 + (1200 - 700) * 0.8, 10);
  });

  it('首顆間隔單獨回報,不併入 killInterval 分布', () => {
    expect(metrics.outcome.firstKillLatencyMs).toBeCloseTo(1000, 10);
    // 1000 若被併進分布,[600,700,1000,1200] 的 P50 會變成 850。
    expect(metrics.outcome.killIntervalP50Ms).not.toBeCloseTo(850, 6);
  });

  it('攜帶 n、flags 與 version（FR-63.15）', () => {
    expect(metrics.version).toBe('micro-flick-v1');
    expect(metrics.eyeOriginSource).toBe('meta');
    expect(metrics.outcome.n).toBe(4);
    expect(metrics.outcome.flags).toEqual(['idle_span_unbounded']);
    expect(metrics.selection.n).toBe(3);
  });

  it('idle_span_unbounded 恆亮:匯出沒有暫停／失焦的區間可扣', () => {
    expect(metrics.outcome.flags).toContain('idle_span_unbounded');
  });

  it('meta.validity.pointerLockLost 讓 T_valid 標 focus_lost_during_run', () => {
    const lost = scenario(HAND_CASE);
    lost.meta = {
      ...lost.meta,
      validity: {
        corridorExceeded: false,
        perfFloor: false,
        recorderOverflow: false,
        bufferOverflow: false,
        pointerLockLost: true,
      },
    };
    const flags = deriveMicroFlickMetrics(lost).outcome.flags;
    expect(flags).toContain('focus_lost_during_run');
    // 旗標不影響數值本身——它描述的是 T_valid 多算了未知長度,不是這一場算不出來。
    expect(deriveMicroFlickMetrics(lost).outcome.killRateHz).toBeCloseTo(4 / 3.5, 10);
  });
});

describe('WP-63 T4 — L3 選擇策略層（FR-63.4／63.5）', () => {
  const metrics = deriveMicroFlickMetrics(scenario(HAND_CASE), {
    eye: { strictEyeOrigin: true },
  });

  it('nearest2Deg / nearest3Deg 逐次擊殺對上手算角距', () => {
    // 擊殺 A(0°):倖存 B(5°)、C(17°);補位 D(40°)  ⇒ n2 = 5,  n3 = 5
    // 擊殺 C(17°):倖存 B(5°)、D(40°);補位 E(60°) ⇒ n2 = 12, n3 = 12
    // 擊殺 B(5°):倖存 D(40°)、E(60°);補位 F(80°) ⇒ n2 = 35, n3 = 35
    // 擊殺 D(40°):倖存 E(60°)、F(80°);補位 G(95°)⇒ n2 = 20, n3 = 20
    expect(metrics.selection.nearest2Deg.map(round6)).toEqual([5, 12, 35, 20]);
    expect(metrics.selection.nearest3Deg.map(round6)).toEqual([5, 12, 35, 20]);
  });

  it('nearestFirstRate 與 selectionCostRatio 對上手算值', () => {
    // 擊殺順序 A → C → B → D,候選集角距如上:
    //   A→C：實際 17,最近 5   ⇒ rank 2
    //   C→B：實際 12,最近 12  ⇒ rank 1
    //   B→D：實際 35,最近 35  ⇒ rank 1
    expect(metrics.selection.n).toBe(3);
    expect(metrics.selection.nearestFirstRate).toBeCloseTo(2 / 3, 10);
    expect(metrics.selection.selectionCostRatio).toBeCloseTo((17 + 12 + 35) / (5 + 12 + 35), 9);
  });

  it('selectionRankEntropy 是被選中 rank 分布的 Shannon 熵（bits）', () => {
    // rank 分布 {1: 2, 2: 1} ⇒ H = −(2/3)log2(2/3) − (1/3)log2(1/3) = 0.9182958…
    const expected = -(2 / 3) * Math.log2(2 / 3) - (1 / 3) * Math.log2(1 / 3);
    expect(metrics.selection.selectionRankEntropy).toBeCloseTo(expected, 10);
  });

  it('完全按最近鄰順序擊殺的序列 ⇒ selectionCostRatio === 1.0、nearestFirstRate === 1.0、熵 === 0', () => {
    const greedy = deriveMicroFlickMetrics(scenario(GREEDY_CASE), {
      eye: { strictEyeOrigin: true },
    });
    expect(greedy.selection.n).toBe(3);
    expect(greedy.selection.selectionCostRatio).toBeCloseTo(1, 12);
    expect(greedy.selection.nearestFirstRate).toBe(1);
    expect(greedy.selection.selectionRankEntropy).toBe(0);
  });

  it('replacement 比倖存者更近時,nearest3Deg 嚴格小於 nearest2Deg', () => {
    const near = deriveMicroFlickMetrics(scenario(NEAR_REPLACEMENT_CASE), {
      eye: { strictEyeOrigin: true },
    });
    // 擊殺 A(0°):倖存 B(5°)、C(17°);補位 D(2°)。
    expect(round6(near.selection.nearest2Deg[0])).toBe(5);
    expect(round6(near.selection.nearest3Deg[0])).toBe(2);
    expect(near.selection.nearest3Deg[0]).toBeLessThan(near.selection.nearest2Deg[0]);
  });

  it('nearest2Deg 與 nearest3Deg 逐位對齊,且 nearest3 恆不大於 nearest2', () => {
    for (const spec of [HAND_CASE, GREEDY_CASE, NEAR_REPLACEMENT_CASE, NO_REPLACEMENT_CASE]) {
      const selection = deriveMicroFlickMetrics(scenario(spec)).selection;
      expect(selection.nearest3Deg.length, JSON.stringify(spec.kills)).toBe(
        selection.nearest2Deg.length,
      );
      for (let i = 0; i < selection.nearest2Deg.length; i++) {
        expect(selection.nearest3Deg[i]).toBeLessThanOrEqual(selection.nearest2Deg[i] + 1e-12);
      }
    }
  });

  it('角距頂點是 eye:改變 meta.scene.eye 會改變角距(不是拿目標座標直接相減)', () => {
    const raised = scenario(HAND_CASE);
    raised.meta = { ...raised.meta, scene: { ...raised.meta.scene!, eye: { x: 0, y: 6, z: 0 } } };
    const moved = deriveMicroFlickMetrics(raised, { eye: { strictEyeOrigin: true } });
    expect(moved.selection.nearest2Deg[0]).not.toBeCloseTo(5, 3);
  });

  it('擊殺後沒有補位時標 no_replacement_for_kill,且該次 nearest3 退化為 nearest2', () => {
    const metricsNoReplacement = deriveMicroFlickMetrics(scenario(NO_REPLACEMENT_CASE));
    expect(metricsNoReplacement.selection.flags).toContain('no_replacement_for_kill');
    expect(metricsNoReplacement.selection.nearest3Deg.at(-1)).toBeCloseTo(
      metricsNoReplacement.selection.nearest2Deg.at(-1)!,
      12,
    );
  });

  it('同距候選一律同 rank,不以陣列順序決勝（FM-2 的同一條紀律）', () => {
    // 倖存者 B(−9°)、C(+9°) 與被殺的 A(0°) 等距 ⇒ 不論玩家打哪一顆都算 rank 1。
    const tie = deriveMicroFlickMetrics(scenario(TIE_CASE), { eye: { strictEyeOrigin: true } });
    expect(tie.selection.n).toBe(1);
    expect(tie.selection.nearestFirstRate).toBe(1);
    expect(tie.selection.selectionCostRatio).toBeCloseTo(1, 12);
  });
});

describe('WP-63 T4 — 缺失一律 undefined + 具名旗標（FR-63.15）', () => {
  it('零擊殺 ⇒ 五量全 undefined、n === 0,不補零', () => {
    const metrics = deriveMicroFlickMetrics(scenario({ ...HAND_CASE, kills: [] }));
    expect(metrics.outcome.n).toBe(0);
    for (const value of [
      metrics.outcome.killRateHz,
      metrics.outcome.shotsPerKill,
      metrics.outcome.shotAccuracy,
      metrics.outcome.killIntervalP50Ms,
      metrics.outcome.killIntervalP90Ms,
      metrics.outcome.firstKillLatencyMs,
      metrics.outcome.validSpanMs,
    ]) {
      expect(value).toBeUndefined();
    }
    expect(metrics.outcome.flags).toContain('no_kills');
    expect(metrics.outcome.flags).toContain('no_valid_span');
  });

  it('只有一次擊殺 ⇒ killInterval 分位數 undefined + single_kill,但 killRateHz 仍成立', () => {
    const metrics = deriveMicroFlickMetrics(scenario(SINGLE_KILL_CASE));
    expect(metrics.outcome.n).toBe(1);
    expect(metrics.outcome.killIntervalP50Ms).toBeUndefined();
    expect(metrics.outcome.killIntervalP90Ms).toBeUndefined();
    expect(metrics.outcome.flags).toContain('single_kill');
    expect(metrics.outcome.killRateHz).toBeCloseTo(1 / 1, 10);
    expect(metrics.selection.n).toBe(0);
    expect(metrics.selection.nearestFirstRate).toBeUndefined();
    expect(metrics.selection.selectionCostRatio).toBeUndefined();
    expect(metrics.selection.selectionRankEntropy).toBeUndefined();
    expect(metrics.selection.flags).toContain('no_kill_transitions');
  });

  it('visible 事件缺座標（pre-WP-56）⇒ 角距不入聚合、標 missing_target_position,不回退 ticks[].tx', () => {
    const metrics = deriveMicroFlickMetrics(scenario({ ...HAND_CASE, omitPositions: true }));
    expect(metrics.selection.nearest2Deg).toEqual([]);
    expect(metrics.selection.nearest3Deg).toEqual([]);
    expect(metrics.selection.n).toBe(0);
    expect(metrics.selection.flags).toContain('missing_target_position');
    // L0 不吃座標 ⇒ 結果層仍然算得出來,不被幾何缺失連坐。
    expect(metrics.outcome.killRateHz).toBeCloseTo(4 / 3.5, 10);
  });

  it('彈匣見底 ⇒ shotsPerKill／shotAccuracy 不出數 + ammo_exhausted_in_run（FM-4）', () => {
    const metrics = deriveMicroFlickMetrics(scenario({ ...HAND_CASE, ammo: 1 }));
    expect(metrics.outcome.flags).toContain('ammo_exhausted_in_run');
    expect(metrics.outcome.shotsPerKill).toBeUndefined();
    expect(metrics.outcome.shotAccuracy).toBeUndefined();
    // 與彈匣無關的三量不受影響。
    expect(metrics.outcome.killRateHz).toBeCloseTo(4 / 3.5, 10);
    expect(metrics.outcome.killIntervalP50Ms).toBeCloseTo(700, 10);
  });

  it('strictEyeOrigin 且匯出缺 meta.scene.eye ⇒ 拋錯,不靜默算出一組偏掉的角度（FM-3）', () => {
    const payload = scenario({ ...HAND_CASE, omitEyeMeta: true });
    expect(() => deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } })).toThrow(
      /resolveEyeOrigin/,
    );
    // 非 strict 入口仍可算,但來源以旗標揭露。
    expect(deriveMicroFlickMetrics(payload).eyeOriginSource).toBe('legacy-default');
  });

  it('旗標詞彙表封閉:輸出的每個旗標都在詞彙表內', () => {
    for (const options of [HAND_CASE, GREEDY_CASE, NO_REPLACEMENT_CASE, SINGLE_KILL_CASE]) {
      const metrics = deriveMicroFlickMetrics(scenario(options));
      for (const flag of metrics.outcome.flags) {
        expect(MICRO_FLICK_OUTCOME_FLAG_VOCABULARY).toContain(flag);
      }
      for (const flag of metrics.selection.flags) {
        expect(MICRO_FLICK_SELECTION_FLAG_VOCABULARY).toContain(flag);
      }
    }
  });

  it('不先佔位尚未交付的鍵：L0／L1／L3 由 T4–T5 交付，L2 與方向預測由 T6 交付', () => {
    const metrics = deriveMicroFlickMetrics(scenario(HAND_CASE)) as unknown as Record<string, unknown>;
    // T6 落地後這裡由「斷言兩鍵缺席」翻成「斷言兩鍵存在且是真的有算」——原本的意圖是**不得先佔位**
    // （空陣列會被讀成「算過了，沒有樣本」而不是「這一層還沒交付」），交付之後同一個意圖就變成
    // 「鍵在，而且帶得動 n 與 flags」。T7 之後不應再有第三種狀態。
    expect(Object.keys(metrics).sort()).toEqual([
      'direction',
      'eyeOriginSource',
      'geometry',
      'microAdjust',
      'outcome',
      'selection',
      'version',
    ]);
    expect(metrics.microAdjust).toMatchObject({
      targets: expect.any(Array),
      n: expect.any(Number),
      flags: expect.any(Array),
    });
    expect(metrics.direction).toMatchObject({
      windows: expect.any(Array),
      n: expect.any(Number),
      flags: expect.any(Array),
    });
  });
});

describe('WP-63 T4 — C-D4：角距來自既有 canonical 實作,不在本模組重寫幾何', () => {
  const source = codeOnly(
    readFileSync(fileURLToPath(new URL('./microFlickMetrics.ts', import.meta.url)), 'utf8'),
  );

  it('夾角一律經 angularDistanceDeg()——三角換算只保留 T6 兩個具名用途', () => {
    // T4/T5 時期本檔零三角換算。T6 帶進兩個**新構念**，各自需要一次換算，兩者都不是既有構念的
    // 第二定義（D-63.T6-1）：
    //   - `Math.asin` ×2：目標角半徑 `asin(r/d)`（與 ray/sphere 命中判定**恆等**而非近似，半徑
    //     讀 `meta.targets.hitbox` 這個 GD-7 單一來源），以及 `viewAnglesTo()` 反解 pitch。
    //   - `Math.atan2` ×3：`viewAnglesTo()` 反解 yaw，加上兩處方位角（FR-63.11 的字面定義）。
    //   - `Math.PI` ×1：`radToDeg`／`wrapPi` 共用的那一個常數。
    // 其餘換算仍為零，且下一個 it() 的 ε／on-target／eye 幾何禁令**未放寬**。數字刻意寫死：
    // 多出來的任何一處都該回來讀這段註解，確認它也是新構念而不是既有構念的第二定義。
    for (const symbol of ['Math.acos', 'Math.cos', 'Math.sin', 'Math.tan', 'RAD_TO_DEG', 'DEG_TO_RAD']) {
      expect(occurrences(source, symbol), symbol).toBe(0);
    }
    expect(occurrences(source, 'Math.asin'), 'Math.asin: 角半徑 + viewAnglesTo').toBe(2);
    expect(occurrences(source, 'Math.atan'), 'Math.atan2: viewAnglesTo + 兩處方位角').toBe(3);
    expect(occurrences(source, 'Math.PI'), 'Math.PI: 僅 PI 常數一處').toBe(1);
    expect(occurrences(source, 'angularDistanceDeg')).toBeGreaterThan(0);
    expect(occurrences(source, 'resolveEyeOrigin')).toBeGreaterThan(0);
    expect(occurrences(source, 'eyeOriginForTick')).toBeGreaterThan(0);
  });

  it('不重新定義 ε(t)／on-target／eye height／sim→world 換算', () => {
    for (const symbol of ['epsilon', 'onTarget', 'eyeHeight', 'SIM_TO_WORLD']) {
      expect(occurrences(source, symbol), symbol).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 可比性前置檢查（T4 Steps 4 / README §3.1）
//
// 這一條不是資料斷言,是**構念**斷言:它量的是 WP-59 的 temporal replacement sampler 讓補位的
// 角距分布相對倖存者整體外推多少。`replacementEngagedRate` 不出總量的決定就掛在這個數字上,
// 所以它必須是一條會紅的測試 —— 日後誰把 sampler 調到兩群可比,這裡就會要求重新評估呈現方式。
// ---------------------------------------------------------------------------

describe('WP-63 T4 — replacement 與倖存者的角距分布可比性', () => {
  const observation = observeReplacementSeparation(60);

  it('補位群的角距分布整體外推於倖存者群 ⇒ 兩群不可比', () => {
    expect(observation.replacementDeg.n).toBe(3_420);
    expect(observation.survivorDeg.n).toBe(6_840);
    // 量到的位移遠大於 0.5° 的可比容差,且三個分位點同向。
    expect(observation.replacementDeg.p10 - observation.survivorDeg.p10).toBeGreaterThan(2);
    expect(observation.replacementDeg.p50 - observation.survivorDeg.p50).toBeGreaterThan(1.5);
    expect(observation.replacementDeg.p90 - observation.survivorDeg.p90).toBeGreaterThan(1);
    // 這是機制造成的,不是雜訊:sampler 以「離被殺目標越遠越好」排序候選。
    expect(observation.replacementDeg.p50).toBeGreaterThan(observation.survivorDeg.p50 + 0.5);
  });

  it('⇒ replacementEngagedRate 只出分層值,不出總量', () => {
    const metrics = deriveMicroFlickMetrics(scenario(HAND_CASE), {
      eye: { strictEyeOrigin: true },
    });
    expect(metrics.selection.replacementEngagedRate).toBeUndefined();
    expect(metrics.selection.flags).toContain('replacement_distance_not_comparable');
    // 分層值以「replacement 在候選集中的 rank」控掉上面那條距離混淆。
    expect(metrics.selection.replacementEngagedByRank.length).toBeGreaterThan(0);
    const total = metrics.selection.replacementEngagedByRank.reduce((sum, bin) => sum + bin.n, 0);
    expect(total).toBe(metrics.selection.n);
    for (const bin of metrics.selection.replacementEngagedByRank) {
      expect(bin.rank).toBeGreaterThanOrEqual(1);
      expect(bin.engagedRate).toBeGreaterThanOrEqual(0);
      expect(bin.engagedRate).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface KillSpec {
  /** 被殺目標的方位角（度）——等同於它在 fixture 內的身分。 */
  readonly killYawDeg: number;
  readonly tKillMs: number;
  /** 下一 tick 補位的方位角;省略 ⇒ 這次擊殺之後不補位。 */
  readonly replacementYawDeg?: number;
}

interface ScenarioSpec {
  readonly initialYawDeg: readonly number[];
  readonly kills: readonly KillSpec[];
  /** 每一發 `fire` 的扣彈前存量;`<= 1` 會讓窗標 `ammo_exhausted_in_window`。 */
  readonly ammo?: number;
  readonly omitPositions?: boolean;
  readonly omitEyeMeta?: boolean;
}

/** 擊殺 A(0°) → C(17°) → B(5°) → D(40°):兩次 rank 1、一次 rank 2。 */
const HAND_CASE: ScenarioSpec = {
  initialYawDeg: [0, 5, 17],
  kills: [
    { killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 40 },
    { killYawDeg: 17, tKillMs: 1600, replacementYawDeg: 60 },
    { killYawDeg: 5, tKillMs: 2300, replacementYawDeg: 80 },
    { killYawDeg: 40, tKillMs: 3500, replacementYawDeg: 95 },
  ],
};

/** 每一次都打候選集中最近的一顆 ⇒ selectionCostRatio === 1.0。 */
const GREEDY_CASE: ScenarioSpec = {
  initialYawDeg: [0, 5, 17],
  kills: [
    { killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 40 },
    { killYawDeg: 5, tKillMs: 1600, replacementYawDeg: 60 },
    { killYawDeg: 17, tKillMs: 2300, replacementYawDeg: 80 },
    { killYawDeg: 40, tKillMs: 3500, replacementYawDeg: 95 },
  ],
};

/** 補位（2°）比兩顆倖存者（5°／17°）更靠近被殺的 A(0°)。 */
const NEAR_REPLACEMENT_CASE: ScenarioSpec = {
  initialYawDeg: [0, 5, 17],
  kills: [
    { killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 2 },
    { killYawDeg: 2, tKillMs: 1600, replacementYawDeg: 40 },
  ],
};

/** 最後一次擊殺之後不再補位（drill 結束）。 */
const NO_REPLACEMENT_CASE: ScenarioSpec = {
  initialYawDeg: [0, 5, 17],
  kills: [
    { killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 40 },
    { killYawDeg: 5, tKillMs: 1600 },
  ],
};

const SINGLE_KILL_CASE: ScenarioSpec = {
  initialYawDeg: [0, 5, 17],
  kills: [{ killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 40 }],
};

/** 兩顆倖存者與被殺目標等距。 */
const TIE_CASE: ScenarioSpec = {
  initialYawDeg: [0, -9, 9],
  kills: [
    { killYawDeg: 0, tKillMs: 1000, replacementYawDeg: 40 },
    { killYawDeg: 9, tKillMs: 1600, replacementYawDeg: 60 },
  ],
};

/**
 * 合成一份 v8 形狀的匯出。
 *
 * 目標一律落在通過 eye 的水平面、距 eye 等距 ⇒ 兩顆之間以 eye 為頂點的角 = `yawDeg` 之差(精確)。
 * 每次擊殺前 170 ms（`usp_s_laser` 的 `cycletimeSec`）有一發失手,且失手那一發帶的 `targetId`
 * **恆為初始第一顆** —— 複製 README §0.1 #4 的錯誤形態,好讓「本層不讀 fire.targetId」可測。
 * 決定性:無 `Math.random()`（GD-5）。
 */
function scenario(spec: ScenarioSpec): ExportPayload {
  const { initialYawDeg, kills, ammo = 11, omitPositions = false, omitEyeMeta = false } = spec;
  const events: DrillEvent[] = [];
  const idByYaw = new Map<number, string>();
  let nextId = 0;

  const spawn = (yawDeg: number, t: number): void => {
    const targetId = `t${nextId}`;
    idByYaw.set(yawDeg, targetId);
    const pos = positionAtYaw(yawDeg);
    events.push({
      type: 'visible',
      targetId,
      side: nextId % 2 === 0 ? 'L' : 'R',
      t,
      ...(omitPositions ? {} : { targetX: pos.x, targetY: pos.y, targetZ: pos.z }),
    });
    nextId++;
  };

  for (const yawDeg of initialYawDeg) spawn(yawDeg, 0);
  const firstId = idByYaw.get(initialYawDeg[0])!;

  for (const kill of kills) {
    const targetId = idByYaw.get(kill.killYawDeg);
    if (targetId === undefined) throw new Error(`no live target at yaw ${kill.killYawDeg}`);
    events.push({
      type: 'fire',
      t: kill.tKillMs - 170,
      hit: false,
      firstShot: true,
      residualSpeed: 0,
      targetId: firstId,
      ammo: ammo + 1,
    });
    events.push({
      type: 'fire',
      t: kill.tKillMs,
      hit: true,
      firstShot: false,
      residualSpeed: 0,
      targetId,
      ammo,
    });
    if (kill.replacementYawDeg !== undefined) {
      spawn(kill.replacementYawDeg, nextTickTimeAfter(kill.tKillMs));
    }
  }

  const lastEventT = events.reduce((max, event) => Math.max(max, event.t), 0);
  const ticks: TickRecord[] = [];
  for (let i = 0; i <= Math.ceil(lastEventT / TICK_MS) + 1; i++) ticks.push(tickAt(i * TICK_MS));

  return {
    meta: {
      drillId: microFlickThreeTargetTestV8.drill.drillId,
      simToWorld: 1,
      ...(omitEyeMeta
        ? {}
        : { scene: { sceneId: 'micro-flick-room-v8', eye: { ...EYE } } }),
    } as ExportPayload['meta'],
    ticks,
    events,
  };
}

/** 通過 eye 的水平面上、距 eye `TARGET_DISTANCE_U` 的一點,方位角 `yawDeg`。 */
function positionAtYaw(yawDeg: number): { x: number; y: number; z: number } {
  const rad = (yawDeg * Math.PI) / 180;
  return {
    x: EYE.x + TARGET_DISTANCE_U * Math.sin(rad),
    y: EYE.y,
    z: EYE.z - TARGET_DISTANCE_U * Math.cos(rad),
  };
}

/** `ticks[].tx/ty/tz` 一律只描述「陣列首顆」——README §0.1 #1 的錯誤形態,本層不得讀它。 */
function tickAt(t: number): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: 0,
    ty: 1.6,
    tz: -TARGET_DISTANCE_U,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

function nextTickTimeAfter(t: number): number {
  return (Math.floor(t / TICK_MS) + 1) * TICK_MS;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// 可比性觀測（重用 WP-59 的 stress 路徑:同一個 TargetManager、同一個 seeded kill order）
// ---------------------------------------------------------------------------

interface Quantiles {
  readonly n: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
}

function observeReplacementSeparation(runs: number): {
  readonly survivorDeg: Quantiles;
  readonly replacementDeg: Quantiles;
} {
  const replacementsPerRun =
    microFlickThreeTargetTestV8.drill.targets.count -
    microFlickThreeTargetTestV8.drill.targets.population.activeCount;
  const survivors: number[] = [];
  const replacements: number[] = [];

  for (let killOrderSeed = 0; killOrderSeed < runs; killOrderSeed++) {
    const state = createSharedState();
    const manager = createTargetManager(microFlickThreeTargetTestV8.drill);
    const killOrderRng = createRan1(killOrderSeed);
    manager.tick(state, 0);
    for (let i = 0; i < replacementsPerRun; i++) {
      const killedIndex = Math.floor(killOrderRng() * state.targets.length);
      const killed = state.targets[killedIndex];
      const killedPos: Vec3 = { ...killed.pos };
      const survivorIds = new Set(
        state.targets.filter((_, index) => index !== killedIndex).map((target) => target.id),
      );
      const survivorPositions = state.targets
        .filter((_, index) => index !== killedIndex)
        .map((target): Vec3 => ({ ...target.pos }));

      manager.markKilled(state, killed.id);
      manager.tick(state, i + 1);
      const replacement = state.targets.find((target) => !survivorIds.has(target.id));
      if (replacement === undefined) throw new Error('replacement target was not created');

      for (const pos of survivorPositions) survivors.push(separationFromEyeDeg(killedPos, pos));
      replacements.push(separationFromEyeDeg(killedPos, replacement.pos));
    }
  }

  return { survivorDeg: quantiles(survivors), replacementDeg: quantiles(replacements) };
}

/** 與 `microFlickMetrics` 同一條路：單位方向 → canonical `angularDistanceDeg()`。 */
function separationFromEyeDeg(left: Vec3, right: Vec3): number {
  const unit = (pos: Vec3): { x: number; y: number; z: number } => {
    const dx = pos.x - EYE.x;
    const dy = pos.y - EYE.y;
    const dz = pos.z - EYE.z;
    const length = Math.hypot(dx, dy, dz);
    return { x: dx / length, y: dy / length, z: dz / length };
  };
  return angularDistanceDeg(unit(left), unit(right));
}

function quantiles(values: readonly number[]): Quantiles {
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (p: number): number => {
    const rank = (p / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
  };
  return { n: sorted.length, p10: at(10), p50: at(50), p90: at(90) };
}

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function occurrences(source: string, symbol: string): number {
  return source.split(symbol).length - 1;
}

// ---------------------------------------------------------------------------
// WP-63 T5 —— L1 幾何層（FR-63.7／63.8／63.9）
//
// 目標一律落在通過 eye 的水平面、距 eye 等距,且開火射線也落在同一平面上（`viewPitch = 0`）:
//   aimForward(-a) = { sin a, 0, −cos a }、目標方向 = { sin t, 0, −cos t }
//   ⇒ 夾角 = |a − t|（度）**精確成立**。每個期望角誤差都可以用紙筆寫下來,不必跑實作產生期望值。
// ---------------------------------------------------------------------------

describe('WP-63 T5 — 意圖歸屬（FR-63.7）', () => {
  it('D2 採用 argmin 角誤差而非 fire.targetId——後者失手時是陣列首顆（README §0.1 #4）', () => {
    // 場上 0°／5°／40°;瞄 4.9° ⇒ argmin 是 5° 那顆（誤差 0.1°）,但匯出寫的 targetId 是首顆 0°。
    const payload = t5Scenario({
      initialYawDeg: [0, 5, 40],
      shots: [{ tMs: 1000, aimYawDeg: 4.9 }],
    });
    const recorded = payload.events.find((event) => event.type === 'fire');
    const shot = deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } }).geometry
      .shots[0];

    const recordedTargetId = recorded?.type === 'fire' ? recorded.targetId : undefined;
    expect(recordedTargetId).toBe('t0'); // 錯誤形態就在匯出裡
    expect(shot.intendedTargetId).toBe('t1'); // 5° 那顆 —— 採用 argmin 而非 fire.targetId
    expect(shot.intendedTargetId).not.toBe(recordedTargetId);
    expect(shot.intendedErrorDeg).toBeCloseTo(0.1, 9);
  });

  it('D3 交叉檢核:正常 fixture 的**每一發**命中,argmin 都等於被 raycast 覆寫的 fire.targetId', () => {
    const payload = t5Scenario(CROSS_CHECK_CASE);
    const geometry = deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } }).geometry;
    const hits = payload.events.filter(
      (event): event is Extract<DrillEvent, { type: 'fire' }> =>
        event.type === 'fire' && event.hit === true,
    );

    expect(hits.length).toBe(4);
    // 「不只抽樣」:逐發對照,且兩邊的發數必須對得起來。
    const attributedHits = geometry.shots.filter((shot) => shot.hit);
    expect(attributedHits.length).toBe(hits.length);
    for (let i = 0; i < hits.length; i++) {
      expect(attributedHits[i].tMs, `hit #${i}`).toBeCloseTo(hits[i].t, 12);
      expect(attributedHits[i].intendedTargetId, `hit #${i}`).toBe(hits[i].targetId);
    }
  });

  it('D3 的前提:候選集含**被這一發打掉的那顆**（否則命中發永遠歸屬不到自己）', () => {
    const geometry = deriveMicroFlickMetrics(t5Scenario(CROSS_CHECK_CASE), {
      eye: { strictEyeOrigin: true },
    }).geometry;
    for (const shot of geometry.shots.filter((candidate) => candidate.hit)) {
      expect(shot.intendedTargetId).toBeDefined();
      expect(shot.flags).toEqual([]);
    }
  });

  it('D1 一發同時對兩顆等距 ⇒ multiple_kill_candidates,且該發不進 L1 聚合（FM-2）', () => {
    // −9°／+9° 與瞄準方位 0° 等距;第三顆 100° 遠在天邊。不得以陣列順序或 id 序決勝。
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({ initialYawDeg: [-9, 9, 100], shots: [{ tMs: 1000, aimYawDeg: 0 }] }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;

    expect(geometry.shots).toHaveLength(1);
    expect(geometry.shots[0].flags).toContain('multiple_kill_candidates');
    expect(geometry.shots[0].intendedTargetId).toBeUndefined();
    expect(geometry.shots[0].intendedErrorDeg).toBeUndefined();
    // 不進聚合 ⇒ 沒有任何目標因此獲得首發。
    expect(geometry.n).toBe(0);
    expect(geometry.firstShotHitRate).toBeUndefined();
    for (const target of geometry.targets) expect(target.flags).toContain('no_shot_at_target');
    expect(geometry.flags).toContain('multiple_kill_candidates');
  });

  it('容差之外的微小差距仍然分得出勝負（併列判定不是「差不多就算平手」）', () => {
    // 兩顆相差 1e-7 度 —— 遠大於 1e-9 的併列容差。
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({ initialYawDeg: [-9, 9 + 1e-7, 100], shots: [{ tMs: 1000, aimYawDeg: 0 }] }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    expect(geometry.shots[0].flags).toEqual([]);
    expect(geometry.shots[0].intendedTargetId).toBe('t0'); // −9° 那顆比較近
  });

  it('D4 strictEyeOrigin 且匯出缺 meta.scene.eye ⇒ 拋錯,不靜默算出一組偏掉的角度（FM-3）', () => {
    const payload = t5Scenario(CROSS_CHECK_CASE);
    delete (payload.meta as { scene?: unknown }).scene;
    expect(() => deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } })).toThrow(
      /resolveEyeOrigin/,
    );
  });

  it('fire 缺 viewYaw／viewPitch ⇒ missing_view_angles,不退回 fire.targetId', () => {
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({
        initialYawDeg: [0, 5, 40],
        shots: [{ tMs: 1000, aimYawDeg: 4.9, omitViewAngles: true }],
      }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    expect(geometry.shots[0].flags).toEqual(['missing_view_angles']);
    expect(geometry.shots[0].intendedTargetId).toBeUndefined();
    expect(geometry.n).toBe(0);
  });

  it('T4 的 fixture（fire 不帶視角）⇒ 整層具名失效,而不是靜靜歸屬到陣列首顆', () => {
    const geometry = deriveMicroFlickMetrics(scenario(HAND_CASE)).geometry;
    expect(geometry.shots).toHaveLength(8);
    for (const shot of geometry.shots) {
      expect(shot.flags).toContain('missing_view_angles');
      expect(shot.intendedTargetId).toBeUndefined();
    }
    expect(geometry.firstShotHitRate).toBeUndefined();
    // L0／L3 不吃視角 ⇒ 不被幾何缺失連坐。
    const metrics = deriveMicroFlickMetrics(scenario(HAND_CASE));
    expect(metrics.outcome.killRateHz).toBeCloseTo(4 / 3.5, 10);
    expect(metrics.selection.n).toBe(3);
  });

  it('缺座標的候選不進 argmin,標 missing_target_position（FM-1）', () => {
    const payload = t5Scenario({
      initialYawDeg: [0, 5, 40],
      shots: [{ tMs: 1000, aimYawDeg: 4.9 }],
      omitPositions: true,
    });
    const geometry = deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } }).geometry;
    expect(geometry.shots[0].flags).toContain('missing_target_position');
    expect(geometry.shots[0].flags).toContain('no_candidates');
    expect(geometry.shots[0].intendedTargetId).toBeUndefined();
  });

  it('命名紀律:逐發列上凡帶「這一發的目標」語意的鍵一律 intended 前綴', () => {
    const geometry = deriveMicroFlickMetrics(t5Scenario(CROSS_CHECK_CASE), {
      eye: { strictEyeOrigin: true },
    }).geometry;
    for (const shot of geometry.shots) {
      for (const key of Object.keys(shot)) {
        if (/target/i.test(key)) expect(key.startsWith('intended'), key).toBe(true);
      }
    }
    // 逐發列刻意不轉載 fire.targetId —— 輸出端不提供會被誤當資料源的欄位。
    const source = codeOnly(
      readFileSync(fileURLToPath(new URL('./microFlickMetrics.ts', import.meta.url)), 'utf8'),
    );
    expect(occurrences(source, 'fire.targetId')).toBe(0);
    expect(occurrences(source, 'fire.offsetDeg')).toBe(0);
    expect(occurrences(source, 'fire.firstShot')).toBe(0);
  });
});

describe('WP-63 T5 — 首發重定義（FR-63.8）', () => {
  const geometry = deriveMicroFlickMetrics(t5Scenario(CROSS_CHECK_CASE), {
    eye: { strictEyeOrigin: true },
  }).geometry;

  it('首發 = 意圖歸屬為該顆的**第一發**,不是 fire.firstShot', () => {
    // fixture 的每一發 `firstShot` 都寫 false（複製 v8 上的崩壞形態）。
    const payload = t5Scenario(CROSS_CHECK_CASE);
    expect(
      payload.events.every((event) => event.type !== 'fire' || event.firstShot === false),
    ).toBe(true);

    // t0（0°）被瞄了三次:1000 失手（誤差 1.2°）、1340 失手、1510 命中 ⇒ 首發取 1000 那一發。
    const first = geometry.targets.find((target) => target.targetId === 't0')!;
    expect(first.firstShotHit).toBe(false);
    expect(first.intendedFirstShotErrorDeg).toBeCloseTo(1.2, 9);
  });

  it('firstShotHitRate 的分母是「有首發的目標」,不是全部 visible', () => {
    // 5 個窗（3 初始 + 2 補位）,其中 t4 從未被瞄準 ⇒ 分母 4。
    // 首發：t0 失手（1000 那一發）、t1／t2／t3 各一槍解決 ⇒ 3／4。
    expect(geometry.targets).toHaveLength(5);
    const never = geometry.targets.filter((target) => target.flags.includes('no_shot_at_target'));
    expect(never.map((target) => target.targetId)).toEqual(['t4']);
    expect(geometry.n).toBe(4);
    expect(geometry.firstShotHitRate).toBeCloseTo(3 / 4, 12);
  });

  it('沒有任何一發可歸屬 ⇒ firstShotHitRate undefined + n === 0,不補零（FR-63.15）', () => {
    const empty = deriveMicroFlickMetrics(
      t5Scenario({ initialYawDeg: [0, 5, 40], shots: [] }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    expect(empty.firstShotHitRate).toBeUndefined();
    expect(empty.n).toBe(0);
    expect(empty.shots).toEqual([]);
    expect(empty.flags).toContain('no_shot_at_target');
  });

  it('旗標詞彙表封閉:逐發列與逐窗列的每個旗標都在詞彙表內', () => {
    for (const shot of geometry.shots) {
      for (const flag of shot.flags) expect(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY).toContain(flag);
    }
    for (const target of geometry.targets) {
      for (const flag of target.flags) expect(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY).toContain(flag);
    }
    for (const flag of geometry.flags) expect(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY).toContain(flag);
  });
});

describe('WP-63 T5 — 修正時間拆解（FR-63.9）', () => {
  it('D5 首發失手 → 隔 170 ms（= cycletime）補一發命中 ⇒ cadenceWaitMs ≈ 170、settlingMs ≈ 0', () => {
    const target = correctionCase(170).targets.find((row) => row.targetId === 't0')!;
    expect(target.correctionMs).toBeCloseTo(170, 9);
    expect(target.cadenceWaitMs).toBeCloseTo(170, 9);
    expect(target.settlingMs).toBeCloseTo(0, 9);
    expect(target.firstShotHit).toBe(false);
  });

  it('D6 首發失手 → 隔 500 ms 補一發命中 ⇒ cadenceWaitMs ≈ 170、settlingMs ≈ 330', () => {
    const target = correctionCase(500).targets.find((row) => row.targetId === 't0')!;
    expect(target.correctionMs).toBeCloseTo(500, 9);
    expect(target.cadenceWaitMs).toBeCloseTo(170, 9);
    expect(target.settlingMs).toBeCloseTo(330, 9);
  });

  it('cycletimeSec 讀匯出宣告的武器,不是常數——同一份時序換 ak47 就換一組拆解', () => {
    const usp = correctionCase(500).targets.find((row) => row.targetId === 't0')!;
    const ak = correctionCase(500, 'ak47').targets.find((row) => row.targetId === 't0')!;

    expect(correctionCase(500).cycletimeMs).toBeCloseTo(170, 9);
    expect(correctionCase(500, 'ak47').cycletimeMs).toBeCloseTo(100, 9);
    // correctionMs 是同一個（它不依賴武器）,拆解卻不同 ⇒ 拆解確實吃了匯出的 cycletime。
    expect(ak.correctionMs).toBeCloseTo(usp.correctionMs!, 9);
    expect(ak.cadenceWaitMs).toBeCloseTo(100, 9);
    expect(ak.settlingMs).toBeCloseTo(400, 9);
  });

  it('匯出宣告的武器認不得 ⇒ unknown_cycletime,correctionMs 仍出數但拆解不出數', () => {
    const geometry = correctionCase(500, 'no_such_weapon_v0');
    const target = geometry.targets.find((row) => row.targetId === 't0')!;
    expect(geometry.cycletimeMs).toBeUndefined();
    expect(geometry.flags).toContain('unknown_cycletime');
    expect(target.correctionMs).toBeCloseTo(500, 9);
    expect(target.cadenceWaitMs).toBeUndefined();
    expect(target.settlingMs).toBeUndefined();
  });

  it('中途朝別顆開的槍一樣佔住節奏 ⇒ 計入 cadenceWaitMs（節奏地板是武器層級的）', () => {
    // 1000 失手 t0 → 1170 失手 t1（別顆）→ 1340 命中 t0。兩段間隔都恰好 = 170。
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({
        initialYawDeg: [0, 40, 80],
        shots: [
          { tMs: 1000, aimYawDeg: 1.2 },
          { tMs: 1170, aimYawDeg: 41 },
          { tMs: 1340, aimYawDeg: 0, hit: true, recordedYawDeg: 0 },
        ],
      }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    const target = geometry.targets.find((row) => row.targetId === 't0')!;
    expect(target.correctionMs).toBeCloseTo(340, 9);
    expect(target.cadenceWaitMs).toBeCloseTo(340, 9);
    expect(target.settlingMs).toBeCloseTo(0, 9);
  });

  it('首發即命中 ⇒ first_shot_hit,三量缺席（不是缺失,是這顆就是一槍解決的）', () => {
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({
        initialYawDeg: [0, 40, 80],
        shots: [{ tMs: 1000, aimYawDeg: 0, hit: true, recordedYawDeg: 0 }],
      }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    const target = geometry.targets.find((row) => row.targetId === 't0')!;
    expect(target.firstShotHit).toBe(true);
    expect(target.flags).toContain('first_shot_hit');
    expect(target.correctionMs).toBeUndefined();
    expect(target.cadenceWaitMs).toBeUndefined();
    expect(target.settlingMs).toBeUndefined();
    expect(geometry.firstShotHitRate).toBeCloseTo(1, 12);
  });

  it('被瞄過但 drill 結束仍存活 ⇒ never_killed,修正段沒有右界可拆', () => {
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({
        initialYawDeg: [0, 40, 80],
        shots: [{ tMs: 1000, aimYawDeg: 1.2 }],
      }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    const target = geometry.targets.find((row) => row.targetId === 't0')!;
    expect(target.flags).toContain('never_killed');
    expect(target.firstShotHit).toBe(false);
    expect(target.correctionMs).toBeUndefined();
    // 首發仍然成立 ⇒ 進 firstShotHitRate 的分母。
    expect(target.intendedFirstShotErrorDeg).toBeCloseTo(1.2, 9);
    expect(geometry.n).toBe(1);
    expect(geometry.firstShotHitRate).toBe(0);
  });
});

describe('WP-63 T5 — fire.t 是排程時刻,點擊／按住以 ticks[].fire 分辨', () => {
  it('修正區間內有按住 tick ⇒ held_fire_during_correction', () => {
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({ ...CORRECTION_SHOTS(500), heldFireMs: [[1000, 1500]] }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    const target = geometry.targets.find((row) => row.targetId === 't0')!;
    expect(target.flags).toContain('held_fire_during_correction');
    expect(geometry.flags).toContain('held_fire_during_correction');
    // 旗標只描述「這幾發的 t 是排程時刻」,不改動數值本身。
    expect(target.cadenceWaitMs).toBeCloseTo(170, 9);
  });

  it('全是離散點擊（無按住 tick）⇒ 不標旗標', () => {
    const geometry = correctionCase(500);
    expect(geometry.flags).not.toContain('held_fire_during_correction');
    expect(geometry.flags).not.toContain('no_held_fire_channel');
  });

  it('ticks 沒有 fire 欄 ⇒ no_held_fire_channel,不把缺席當成 false', () => {
    const geometry = deriveMicroFlickMetrics(
      t5Scenario({ ...CORRECTION_SHOTS(500), omitHeldFireChannel: true }),
      { eye: { strictEyeOrigin: true } },
    ).geometry;
    expect(geometry.flags).toContain('no_held_fire_channel');
    for (const target of geometry.targets) {
      expect(target.flags).not.toContain('held_fire_during_correction');
    }
  });
});

// ---------------------------------------------------------------------------
// T5 Fixture
// ---------------------------------------------------------------------------

interface T5ShotSpec {
  readonly tMs: number;
  /** 開火瞄準的方位角（度）,與目標 `yawDeg` 同一座標系 ⇒ 角誤差 = `|aimYawDeg − yawDeg|`。 */
  readonly aimYawDeg: number;
  readonly hit?: boolean;
  /**
   * 寫進 `fire.targetId` 的目標方位角。命中時它是被 raycast 覆寫的真值;**省略時一律寫成陣列首顆**
   * ——複製 README §0.1 #4 的錯誤形態,好讓「本層不讀 fire.targetId」可測。
   */
  readonly recordedYawDeg?: number;
  readonly omitViewAngles?: boolean;
}

interface T5Spec {
  readonly initialYawDeg: readonly number[];
  readonly shots: readonly T5ShotSpec[];
  /** 每次擊殺後於下一 tick 補位的方位角,依擊殺順序取用;用完就不再補位。 */
  readonly replacementsYawDeg?: readonly number[];
  /** 寫進 `meta.weaponId`;預設 T1 宣告的 `usp_s_laser`（`cycletimeSec: 0.17`）。 */
  readonly weaponId?: string;
  /** 按住左鍵的區間 `[from, to]`（ms）——落在區間內的 tick 其 `fire` 為 true。 */
  readonly heldFireMs?: readonly (readonly [number, number])[];
  /** 省略逐 tick 的 `fire` 欄（模擬 pre-WP-54 匯出）。 */
  readonly omitHeldFireChannel?: boolean;
  readonly omitPositions?: boolean;
}

/** 0° 被瞄三次（1000 失手 1.2°、1340 失手、1510 命中）,40° 一槍解決,80° 與補位各一次。 */
const CROSS_CHECK_CASE: T5Spec = {
  initialYawDeg: [0, 40, 80],
  replacementsYawDeg: [120, 160],
  shots: [
    { tMs: 1000, aimYawDeg: 1.2 },
    { tMs: 1340, aimYawDeg: 0.4 },
    { tMs: 1510, aimYawDeg: 0, hit: true, recordedYawDeg: 0 },
    { tMs: 2000, aimYawDeg: 40, hit: true, recordedYawDeg: 40 },
    { tMs: 2500, aimYawDeg: 79, hit: true, recordedYawDeg: 80 },
    { tMs: 3000, aimYawDeg: 119, hit: true, recordedYawDeg: 120 },
  ],
};

/** 首發失手 t0 → 隔 `gapMs` 補一發命中。其餘兩顆離得夠遠,不會搶走歸屬。 */
function CORRECTION_SHOTS(gapMs: number): T5Spec {
  return {
    initialYawDeg: [0, 40, 80],
    shots: [
      { tMs: 1000, aimYawDeg: 1.2 },
      { tMs: 1000 + gapMs, aimYawDeg: 0, hit: true, recordedYawDeg: 0 },
    ],
  };
}

function correctionCase(gapMs: number, weaponId?: string): MicroFlickGeometryMetrics {
  const spec = CORRECTION_SHOTS(gapMs);
  return deriveMicroFlickMetrics(
    t5Scenario(weaponId === undefined ? spec : { ...spec, weaponId }),
    { eye: { strictEyeOrigin: true } },
  ).geometry;
}

/** 合成一份**帶視角**的 v8 形狀匯出（T4 的 `scenario()` 刻意不帶,見該處註解）。 */
function t5Scenario(spec: T5Spec): ExportPayload {
  const {
    initialYawDeg,
    shots,
    replacementsYawDeg = [],
    weaponId = 'usp_s_laser',
    heldFireMs = [],
    omitHeldFireChannel = false,
    omitPositions = false,
  } = spec;

  const events: DrillEvent[] = [];
  const idByYaw = new Map<number, string>();
  let nextId = 0;

  const spawn = (yawDeg: number, t: number): void => {
    const targetId = `t${nextId}`;
    idByYaw.set(yawDeg, targetId);
    const pos = positionAtYaw(yawDeg);
    events.push({
      type: 'visible',
      targetId,
      side: nextId % 2 === 0 ? 'L' : 'R',
      t,
      ...(omitPositions ? {} : { targetX: pos.x, targetY: pos.y, targetZ: pos.z }),
    });
    nextId++;
  };

  for (const yawDeg of initialYawDeg) spawn(yawDeg, 0);
  const firstId = idByYaw.get(initialYawDeg[0])!;

  let replacementCursor = 0;
  for (const shot of shots) {
    const recordedId =
      shot.recordedYawDeg === undefined ? firstId : idByYaw.get(shot.recordedYawDeg);
    if (recordedId === undefined) throw new Error(`no live target at yaw ${shot.recordedYawDeg}`);
    events.push({
      type: 'fire',
      t: shot.tMs,
      hit: shot.hit === true,
      // 匯出上的 firstShot 一律 false —— v8 上它以陣列首顆為鍵,本層不得讀（README §0.1 #4）。
      firstShot: false,
      residualSpeed: 0,
      targetId: recordedId,
      ammo: 11,
      ...(shot.omitViewAngles
        ? {}
        : { viewYaw: -(shot.aimYawDeg * Math.PI) / 180, viewPitch: 0 }),
    });
    if (shot.hit === true && replacementCursor < replacementsYawDeg.length) {
      spawn(replacementsYawDeg[replacementCursor++], nextTickTimeAfter(shot.tMs));
    }
  }

  const lastEventT = events.reduce((max, event) => Math.max(max, event.t), 0);
  const ticks: TickRecord[] = [];
  for (let i = 0; i <= Math.ceil(lastEventT / TICK_MS) + 1; i++) {
    const t = i * TICK_MS;
    const held = heldFireMs.some(([from, to]) => t >= from && t <= to);
    ticks.push({ ...tickAt(t), ...(omitHeldFireChannel ? {} : { fire: held }) });
  }

  return {
    meta: {
      drillId: microFlickThreeTargetTestV8.drill.drillId,
      simToWorld: 1,
      weaponId,
      scene: { sceneId: 'micro-flick-room-v8', eye: { ...EYE } },
    } as ExportPayload['meta'],
    ticks,
    events,
  };
}

// ---------------------------------------------------------------------------
// T6 —— L2 免閾值微調描述子 + 擊殺後方向預測曲線（FR-63.10／63.11）
// ---------------------------------------------------------------------------

/** v8 靶徑 1.08375 u @ 25 u ⇒ 角半徑 asin(0.541875/25)，約 1.242°。 */
const T6_ANGULAR_RADIUS_DEG =
  (Math.asin(MICRO_FLICK_V8_TARGET_DIAMETER_U / 2 / TARGET_DISTANCE_U) * 180) / Math.PI;

describe('WP-63 T6 — E1 直線 flick 進靶即開火（FR-63.10）', () => {
  const metrics = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
  const entry = microAdjustAt(metrics, 0);

  it('E1: 進入門界由靶的角尺寸決定，不是調校值', () => {
    expect(T6_ANGULAR_RADIUS_DEG).toBeCloseTo(1.242, 3);
    expect(metrics.microAdjust.hitboxRadiusU).toBe(MICRO_FLICK_V8_TARGET_DIAMETER_U / 2);
  });

  it('E1: 單調逼近 ⇒ reEntryCount === 0、signReversalCount === 0', () => {
    expect(entry.reEntryCount).toBe(0);
    expect(entry.signReversalCount).toBe(0);
    expect(entry.flags).toEqual([]);
  });

  it('E1: approachToFireMs = 首次進入角半徑 → 意圖歸屬首發', () => {
    // 逐 tick 0.25°、起點 0°、靶在 5° ⇒ ε_j = 5 − 0.25j，首次 ≤ 1.242 的是 j = 16（ε = 1.0）。
    // 擊殺排在 tick 20 的前半個 tick ⇒ 相距 3.5 個 tick。
    expect(entry.approachToFireMs).toBeCloseTo(3.5 * TICK_MS, 6);
  });

  it('E1: dwellPathRatio 反映「進帶寬後一路走到底」的路徑量', () => {
    expect(entry.dwellPathRatio).toBeGreaterThan(1);
    expect(entry.dwellPathRatio).toBeLessThan(3);
  });
});

describe('WP-63 T6 — E2 過衝後回頭再殺（FR-63.10）', () => {
  const entry = microAdjustAt(deriveMicroFlickMetrics(t6Scenario(E2_OVERSHOOT)), 0);

  it('E2: reEntryCount >= 1 且 signReversalCount >= 1', () => {
    expect(entry.reEntryCount).toBeGreaterThanOrEqual(1);
    expect(entry.signReversalCount).toBeGreaterThanOrEqual(1);
  });
});

describe('WP-63 T6 — E3 一路碎步修正（FR-63.10）', () => {
  const choppy = microAdjustAt(deriveMicroFlickMetrics(t6Scenario(E3_CHOPPY)), 0);
  const straight = microAdjustAt(deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT)), 0);

  it('E3: signReversalCount 顯著高於直線 flick', () => {
    expect(choppy.signReversalCount!).toBeGreaterThan(straight.signReversalCount! + 4);
  });

  it('E3: dwellPathRatio 大於直線 flick（同一段距離走了更多路）', () => {
    expect(choppy.dwellPathRatio!).toBeGreaterThan(straight.dwellPathRatio!);
  });
});

describe('WP-63 T6 — E4 已知意圖的兩段軌跡：小 W 預測 A、大 W 預測 B（FR-63.11）', () => {
  const metrics = deriveMicroFlickMetrics(t6Scenario(E4_FEINT));
  const curve = new Map(metrics.direction.windows.map((entry) => [entry.windowMs, entry]));

  it('E4: 四個預設窗長各有一筆，樣本數一致', () => {
    expect(metrics.direction.windows.map((entry) => entry.windowMs)).toEqual([
      ...DEFAULT_DIRECTION_WINDOWS_MS,
    ]);
    expect(metrics.direction.n).toBe(1);
    for (const entry of metrics.direction.windows) expect(entry.n).toBe(1);
  });

  it('E4: 小 W 抓到假動作（朝 A，預測錯），大 W 抓到真意圖（朝 B，預測對）', () => {
    expect(curve.get(30)!.predictionAccuracy).toBe(0);
    expect(curve.get(60)!.predictionAccuracy).toBe(0);
    expect(curve.get(90)!.predictionAccuracy).toBe(1);
    expect(curve.get(120)!.predictionAccuracy).toBe(1);
  });

  it('E4: 曲線形狀本身是產出——這正是不把某個 W 凍結成門檻的理由', () => {
    expect(metrics.direction.windows.map((entry) => entry.predictionAccuracy)).toEqual([0, 0, 1, 1]);
  });

  it('E4: 自訂 directionWindowsMs 照樣掃描（W 是自變項不是常數）', () => {
    const custom = deriveMicroFlickMetrics(t6Scenario(E4_FEINT), { directionWindowsMs: [45, 200] });
    expect(custom.direction.windows.map((entry) => entry.windowMs)).toEqual([45, 200]);
  });
});

describe('WP-63 T6 — 單一意圖軌跡上，準確率隨 W 增大不下降（Step 6）', () => {
  it('直線奔向下一顆 ⇒ 每個 W 都預測對，曲線不下降', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario(SINGLE_INTENT));
    const accuracies = metrics.direction.windows.map((entry) => entry.predictionAccuracy!);
    expect(accuracies).toEqual([1, 1, 1, 1]);
    for (let i = 1; i < accuracies.length; i++) {
      expect(accuracies[i]).toBeGreaterThanOrEqual(accuracies[i - 1]);
    }
  });
});

describe('WP-63 T6 — E5 60 Hz aim 更新：本層不依賴 aim 連續性（KI-031 懸崖的回歸防線）', () => {
  it('E5: aim 逐 tick 重複、dYaw 正常 ⇒ L2 與方向預測輸出逐位不變', () => {
    const fresh = deriveMicroFlickMetrics(t6Scenario(E4_FEINT));
    const stale = deriveMicroFlickMetrics(t6Scenario({ ...E4_FEINT, staleAim: true }));

    expect(stale.microAdjust).toEqual(fresh.microAdjust);
    expect(stale.direction).toEqual(fresh.direction);
  });

  it('E5: 這份 fixture 的 aim 確實被凍住了（否則上一條是空測試）', () => {
    const stale = t6Scenario({ ...E4_FEINT, staleAim: true });
    const fresh = t6Scenario(E4_FEINT);
    expect(new Set(stale.ticks.map((tick) => tick.aim.yaw)).size).toBe(1);
    expect(new Set(fresh.ticks.map((tick) => tick.aim.yaw)).size).toBeGreaterThan(1);
    // dYaw 兩邊完全相同 —— 差別只在 aim 這條被顯示率污染的頻道。
    expect(stale.ticks.map((tick) => tick.dYaw)).toEqual(fresh.ticks.map((tick) => tick.dYaw));
  });
});

describe('WP-63 T6 — GD-7：角半徑與命中判定同源，且不經 targetHitboxRadius()', () => {
  const source = codeOnly(
    readFileSync(fileURLToPath(new URL('./microFlickMetrics.ts', import.meta.url)), 'utf8'),
  );

  it('角半徑用 widthU / 2（HitDetector 的 sphere 半徑），不是箱體角點半徑', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
    expect(metrics.microAdjust.hitboxRadiusU).toBe(MICRO_FLICK_V8_TARGET_DIAMETER_U / 2);

    // KI-029：`targetHitboxRadius()` 對 cube 回角點半徑 √3/2·w，是命中半徑的 √3 倍。誤用它會讓
    // 進入判準整個鬆掉——這一條把兩者的差距釘成一個會紅的數字。
    const cornerRadiusU = (Math.sqrt(3) / 2) * MICRO_FLICK_V8_TARGET_DIAMETER_U;
    expect(metrics.microAdjust.hitboxRadiusU!).toBeLessThan(cornerRadiusU);
    expect(cornerRadiusU / metrics.microAdjust.hitboxRadiusU!).toBeCloseTo(Math.sqrt(3), 6);
  });

  it('模組不 import 也不提及 targetHitboxRadius／clearance 路徑', () => {
    expect(source).not.toMatch(/targetHitboxRadius/);
    expect(source).not.toMatch(/from ['"][^'"]*clearance/);
  });

  it('缺 hitbox ⇒ no_hitbox，整層不出數（不猜一個預設靶徑）', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario({ ...E1_STRAIGHT, omitHitbox: true }));
    expect(metrics.microAdjust.flags).toContain('no_hitbox');
    expect(metrics.microAdjust.hitboxRadiusU).toBeUndefined();
    expect(metrics.microAdjust.n).toBe(0);
    for (const target of metrics.microAdjust.targets) {
      expect(target.reEntryCount).toBeUndefined();
      expect(target.dwellPathRatio).toBeUndefined();
    }
  });

  it('box hitbox ⇒ unsupported_hitbox_shape，不改用某種等效半徑', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario({ ...E1_STRAIGHT, hitboxShape: 'box' }));
    expect(metrics.microAdjust.flags).toContain('unsupported_hitbox_shape');
    expect(metrics.microAdjust.n).toBe(0);
  });
});

describe('WP-63 T6 — 免閾值：原始碼不含任何速度門檻或平滑窗常數', () => {
  const source = codeOnly(
    readFileSync(fileURLToPath(new URL('./microFlickMetrics.ts', import.meta.url)), 'utf8'),
  );

  it('五個 seg-v2 調校符號的出現次數皆為 0（T6 Step 3）', () => {
    for (const symbol of ['DegPerSec', 'peakFloor', 'sgWindow', 'stopRatio', 'lowRatio']) {
      expect(occurrences(source, symbol), symbol).toBe(0);
    }
  });

  it('不 import submovement／savitzkyGolay——seg-v2 一行不動', () => {
    expect(source).not.toMatch(/from ['"]\.\/submovement/);
    expect(source).not.toMatch(/savitzkyGolay/);
  });
});

describe('WP-63 T6 — 缺失一律 undefined + 封閉詞彙表旗標（FR-63.15）', () => {
  it('L2 與方向層的旗標都落在各自的詞彙表內', () => {
    for (const spec of [E1_STRAIGHT, E2_OVERSHOOT, E3_CHOPPY, E4_FEINT, SINGLE_INTENT]) {
      const metrics = deriveMicroFlickMetrics(t6Scenario(spec));
      for (const flag of metrics.microAdjust.flags) {
        expect(MICRO_FLICK_MICRO_ADJUST_FLAG_VOCABULARY).toContain(flag);
      }
      for (const target of metrics.microAdjust.targets) {
        for (const flag of target.flags) {
          expect(MICRO_FLICK_MICRO_ADJUST_FLAG_VOCABULARY).toContain(flag);
        }
      }
      for (const flag of metrics.direction.flags) {
        expect(MICRO_FLICK_DIRECTION_FLAG_VOCABULARY).toContain(flag);
      }
    }
  });

  it('缺 dYaw/dPitch ⇒ no_mouse_integration，不退回 aim 差分', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario({ ...E4_FEINT, omitMouseIntegration: true }));
    expect(metrics.microAdjust.flags).toContain('no_mouse_integration');
    expect(metrics.direction.flags).toContain('no_mouse_integration');
    expect(metrics.microAdjust.n).toBe(0);
    for (const entry of metrics.direction.windows) expect(entry.n).toBe(0);
  });

  it('從未進入角半徑 ⇒ never_entered_radius，三個「進入後」描述子缺席', () => {
    const entry = microAdjustAt(deriveMicroFlickMetrics(t6Scenario(NEVER_ENTERS)), 0);
    expect(entry.flags).toContain('never_entered_radius');
    expect(entry.reEntryCount).toBeUndefined();
    expect(entry.signReversalCount).toBeUndefined();
    expect(entry.approachToFireMs).toBeUndefined();
  });

  it('drill 結束仍存活的窗標 never_killed，不出任何描述子', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
    const alive = metrics.microAdjust.targets.filter((target) =>
      target.flags.includes('never_killed'),
    );
    expect(alive.length).toBeGreaterThan(0);
    for (const target of alive) expect(target.reEntryCount).toBeUndefined();
  });

  it('沒有擊殺轉移時不補零準確率', () => {
    const metrics = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
    expect(metrics.direction.flags).toContain('no_kill_transitions');
    for (const entry of metrics.direction.windows) {
      expect(entry.n).toBe(0);
      expect(entry.predictionAccuracy).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// T6 fixture
// ---------------------------------------------------------------------------

interface T6View {
  readonly yawDeg: number;
  readonly pitchDeg?: number;
}

interface T6Kill {
  /**
   * 擊殺排在這個 tick 的**前**半個 tick ⇒ 該窗的 tickRange 正好結束在此，而擊殺那一發的視角
   * 等於 `path[tickIndex]`。反向積分因此還原出逐位相同的 `path`（見 `t6Scenario` 註解）。
   */
  readonly tickIndex: number;
  /** 被殺目標的身分 = 它所在的視角 yaw。 */
  readonly viewYawDeg: number;
  readonly replacement?: T6View;
}

interface T6Spec {
  readonly initial: readonly T6View[];
  /** 逐 tick 邊界的視角（度），索引 0..T。`ticks[i].dYaw = path[i+1] − path[i]`。 */
  readonly path: readonly T6View[];
  readonly kills: readonly T6Kill[];
  readonly simHz?: number;
  /** E5：`aim` 逐 tick 凍住（模擬 60 Hz 更新），`dYaw`/`dPitch` 不變。 */
  readonly staleAim?: boolean;
  readonly omitHitbox?: boolean;
  readonly hitboxShape?: 'box' | 'sphere';
  readonly omitMouseIntegration?: boolean;
}

/** 0° → 5°，每 tick 0.25°，單調逼近後開火。靶在 5°。 */
const E1_STRAIGHT: T6Spec = {
  initial: [{ yawDeg: 5 }, { yawDeg: -20 }, { yawDeg: 25 }],
  path: ramp(0, 5, 20),
  kills: [{ tickIndex: 20, viewYawDeg: 5 }],
};

/** 0° → 7°（過衝出角半徑）→ 回到 5°。 */
const E2_OVERSHOOT: T6Spec = {
  initial: [{ yawDeg: 5 }, { yawDeg: -20 }, { yawDeg: 25 }],
  path: [...ramp(0, 7, 20), ...ramp(7, 5, 8).slice(1)],
  kills: [{ tickIndex: 28, viewYawDeg: 5 }],
};

/** 進靶後在 ±0.9°（角半徑內外）來回碎步，最後停在靶心。 */
const E3_CHOPPY: T6Spec = {
  initial: [{ yawDeg: 5 }, { yawDeg: -20 }, { yawDeg: 25 }],
  path: [...ramp(0, 5, 20), ...zigzag(5, 0.25, 1.05, 12)],
  kills: [{ tickIndex: 32, viewYawDeg: 5 }],
};

/** 從未靠近靶：全程停在 0°，靶在 20°。 */
const NEVER_ENTERS: T6Spec = {
  initial: [{ yawDeg: 20 }, { yawDeg: -20 }, { yawDeg: 25 }],
  path: ramp(0, 0, 20),
  kills: [{ tickIndex: 20, viewYawDeg: 20 }],
};

/**
 * E4：殺掉 0° 的靶之後先朝 A（−10°）動 8 個 tick，再反向奔向 B（+10°）並殺掉 B。
 *
 * 小 `W` 的累積位移是負的（朝 A）⇒ 預測 A、答錯；`W` 夠大之後淨位移轉正 ⇒ 預測 B、答對。
 */
const E4_FEINT: T6Spec = {
  initial: [{ yawDeg: 0 }, { yawDeg: -10 }, { yawDeg: 10 }],
  path: [...ramp(0, 0, 10), ...ramp(0, -3, 8).slice(1), ...ramp(-3, 10, 16).slice(1)],
  kills: [
    { tickIndex: 10, viewYawDeg: 0 },
    { tickIndex: 34, viewYawDeg: 10 },
  ],
};

/** 單一意圖：殺掉 0° 之後一路直奔 B（+10°）。每個 `W` 都該預測對。 */
const SINGLE_INTENT: T6Spec = {
  initial: [{ yawDeg: 0 }, { yawDeg: -10 }, { yawDeg: 10 }],
  path: [...ramp(0, 0, 10), ...ramp(0, 10, 24).slice(1)],
  kills: [
    { tickIndex: 10, viewYawDeg: 0 },
    { tickIndex: 34, viewYawDeg: 10 },
  ],
};

/** 線性斜坡，含頭尾共 `steps + 1` 個點。 */
function ramp(fromDeg: number, toDeg: number, steps: number): T6View[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    yawDeg: fromDeg + ((toDeg - fromDeg) * i) / steps,
    pitchDeg: 0,
  }));
}

/**
 * 在靶心附近來回碎步，最後停在中心。不含起點（接在斜坡後面）。
 *
 * ⚠️ 讓 ε 真的**上下震盪**，而不是在中心兩側交替：ε 是無號角距，「左右交替但振幅遞減」的軌跡
 * 其 ε 反而是單調遞減的（0 次符號反轉）。故此處交替的是**離中心的遠近**，不是左右。
 */
function zigzag(centerDeg: number, nearDeg: number, farDeg: number, steps: number): T6View[] {
  return Array.from({ length: steps }, (_, i) => ({
    yawDeg: centerDeg + (i === steps - 1 ? 0 : i % 2 === 0 ? farDeg : nearDeg),
    pitchDeg: 0,
  }));
}

function t6Scenario(spec: T6Spec): ExportPayload {
  const {
    initial,
    path,
    kills,
    simHz = 128,
    staleAim = false,
    omitHitbox = false,
    hitboxShape = 'sphere',
    omitMouseIntegration = false,
  } = spec;
  const tickMs = 1000 / simHz;

  const events: DrillEvent[] = [];
  const idByYaw = new Map<number, string>();
  let nextId = 0;

  const spawn = (view: T6View, t: number): void => {
    const targetId = `t${nextId}`;
    idByYaw.set(view.yawDeg, targetId);
    const pos = targetAtView(view);
    events.push({
      type: 'visible',
      targetId,
      side: nextId % 2 === 0 ? 'L' : 'R',
      t,
      targetX: pos.x,
      targetY: pos.y,
      targetZ: pos.z,
    });
    nextId++;
  };

  for (const view of initial) spawn(view, 0);

  const ticks: TickRecord[] = path.map((view, i) => {
    const next = path[i + 1];
    const dYawRad = next === undefined ? 0 : deg2rad(next.yawDeg - view.yawDeg);
    const dPitchRad = next === undefined ? 0 : deg2rad((next.pitchDeg ?? 0) - (view.pitchDeg ?? 0));
    return {
      t: i * tickMs,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      // README §0.1 #1 的錯誤形態：`tx/ty/tz` 只描述陣列首顆。本層不得讀它。
      tx: 0,
      ty: 1.6,
      tz: -TARGET_DISTANCE_U,
      // `aim` 走 render thread ⇒ 更新率 = 顯示率。`staleAim` 把它凍成常數來模擬 60 Hz 的 KI-031
      // 懸崖；L2 與方向層都不該受影響。
      aim: staleAim
        ? { yaw: 0, pitch: 0 }
        : { yaw: deg2rad(view.yawDeg), pitch: deg2rad(view.pitchDeg ?? 0) },
      keys: [],
      ads: false,
      fire: false,
      ...(omitMouseIntegration ? {} : { dYaw: dYawRad, dPitch: dPitchRad }),
    };
  });

  for (const kill of kills) {
    const targetId = idByYaw.get(kill.viewYawDeg);
    if (targetId === undefined) throw new Error(`no live target at view yaw ${kill.viewYawDeg}`);
    const anchor = path[kill.tickIndex];
    const tKillMs = ticks[kill.tickIndex].t - tickMs / 2;
    events.push({
      type: 'fire',
      t: tKillMs,
      hit: true,
      firstShot: false,
      residualSpeed: 0,
      targetId,
      ammo: 11,
      viewYaw: deg2rad(anchor.yawDeg),
      viewPitch: deg2rad(anchor.pitchDeg ?? 0),
    });
    if (kill.replacement !== undefined) spawn(kill.replacement, ticks[kill.tickIndex].t);
  }

  return {
    meta: {
      drillId: microFlickThreeTargetTestV8.drill.drillId,
      weaponId: 'usp_s_laser',
      simHz,
      simToWorld: 1,
      scene: { sceneId: 'micro-flick-room-v8', eye: { ...EYE } },
      ...(omitHitbox
        ? {}
        : {
            targets: {
              hitbox: {
                widthU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
                heightU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
                depthU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
                shape: hitboxShape,
              },
            },
          }),
    } as ExportPayload['meta'],
    ticks,
    events,
  };
}

/** 視角 `(yaw, pitch)` 正中目標時，該目標必須在的世界座標。`aimForward()` 是朝向的 canonical 定義。 */
function targetAtView(view: T6View): { x: number; y: number; z: number } {
  const forward = aimForward(deg2rad(view.yawDeg), deg2rad(view.pitchDeg ?? 0));
  return {
    x: EYE.x + TARGET_DISTANCE_U * forward.x,
    y: EYE.y + TARGET_DISTANCE_U * forward.y,
    z: EYE.z + TARGET_DISTANCE_U * forward.z,
  };
}

function deg2rad(value: number): number {
  return (value * Math.PI) / 180;
}

function microAdjustAt(metrics: MicroFlickMetrics, windowIndex: number): MicroFlickTargetMicroAdjust {
  const entry = metrics.microAdjust.targets.find((target) => target.windowIndex === windowIndex);
  if (entry === undefined) throw new Error(`no micro-adjust row for window ${windowIndex}`);
  return entry;
}

describe('WP-63 T7 — synthetic harness, FPS parity, and tick-rate discipline', () => {
  it('covers the seven pre-registered synthetic gates from README §4.2', () => {
    const straight = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
    const overshoot = deriveMicroFlickMetrics(t6Scenario(E2_OVERSHOOT));
    const choppy = deriveMicroFlickMetrics(t6Scenario(E3_CHOPPY));
    const feint = deriveMicroFlickMetrics(t6Scenario(E4_FEINT));
    const staleAim = deriveMicroFlickMetrics(t6Scenario({ ...E4_FEINT, staleAim: true }));
    const lateFire = deriveMicroFlickMetrics(t6Scenario(E1_STRAIGHT));
    const replacement = deriveMicroFlickMetrics(scenario(NEAR_REPLACEMENT_CASE), {
      eye: { strictEyeOrigin: true },
    });

    const gates = [
      {
        id: 1,
        assert: () => {
          const entry = microAdjustAt(straight, 0);
          expect(entry.reEntryCount).toBe(0);
          expect(entry.signReversalCount).toBe(0);
          expect(entry.flags).toEqual([]);
        },
      },
      {
        id: 2,
        assert: () => {
          const curve = new Map(feint.direction.windows.map((entry) => [entry.windowMs, entry.predictionAccuracy]));
          expect(curve.get(30)).toBe(0);
          expect(curve.get(60)).toBe(0);
          expect(curve.get(90)).toBe(1);
          expect(curve.get(120)).toBe(1);
        },
      },
      {
        id: 3,
        assert: () => {
          const entry = microAdjustAt(choppy, 0);
          expect(entry.signReversalCount!).toBeGreaterThan(microAdjustAt(straight, 0).signReversalCount!);
          expect(entry.dwellPathRatio!).toBeGreaterThan(microAdjustAt(straight, 0).dwellPathRatio!);
        },
      },
      {
        id: 4,
        assert: () => {
          const entry = microAdjustAt(overshoot, 0);
          expect(entry.reEntryCount).toBeGreaterThanOrEqual(1);
          expect(entry.signReversalCount).toBeGreaterThanOrEqual(1);
        },
      },
      {
        id: 5,
        assert: () => {
          expectObjectIsDeep(staleAim.microAdjust, feint.microAdjust);
          expectObjectIsDeep(staleAim.direction, feint.direction);
        },
      },
      {
        id: 6,
        assert: () => {
          expect(microAdjustAt(lateFire, 0).approachToFireMs).toBeLessThanOrEqual(80);
        },
      },
      {
        id: 7,
        assert: () => {
          expect(replacement.selection.nearest3Deg[0]).toBeLessThan(replacement.selection.nearest2Deg[0]);
          expect(replacement.selection.replacementEngagedRate).toBeUndefined();
          expect(replacement.selection.replacementEngagedByRank.some((bin) => bin.engagedRate! > 0)).toBe(true);
        },
      },
    ];

    expect(gates.map((gate) => gate.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const gate of gates) gate.assert();
  });

  it('NFR-63.2: display FPS metadata does not perturb v8 tick traces or derived metrics', () => {
    const baselinePayload = withDisplayHz(t6Scenario(E4_FEINT), 30);
    const baselineMetrics = deriveMicroFlickMetrics(baselinePayload, { eye: { strictEyeOrigin: true } });

    for (const displayHz of [60, 144, 240]) {
      const payload = withDisplayHz(t6Scenario(E4_FEINT), displayHz);
      expectObjectIsDeep(payload.ticks, baselinePayload.ticks);
      expectObjectIsDeep(
        deriveMicroFlickMetrics(payload, { eye: { strictEyeOrigin: true } }),
        baselineMetrics,
      );
    }
  });

  it('NFR-63.5: FR-63.10 micro-adjust metrics vary by less than 5% across 64/128/256 Hz ticks', () => {
    const baseline = microAdjustAt(deriveMicroFlickMetrics(tickRateProbe(128)), 0);

    for (const simHz of [64, 256] as const) {
      const sampled = microAdjustAt(deriveMicroFlickMetrics(tickRateProbe(simHz)), 0);
      expect(sampled.reEntryCount).toBe(baseline.reEntryCount);
      expect(sampled.signReversalCount).toBe(baseline.signReversalCount);
      expect(relativeDiff(sampled.dwellPathRatio!, baseline.dwellPathRatio!)).toBeLessThan(0.05);
      expect(relativeDiff(sampled.approachToFireMs!, baseline.approachToFireMs!)).toBeLessThan(0.05);
    }
  });

  it('NFR-63.1: legacy v1-v7 micro-flick fixture contract stays frozen outside the v8 gate', () => {
    expect(legacyMicroFlickSnapshot()).toEqual([
      legacyRow('micro_flick_three_target_test_v1', 'micro-flick-room', 'default', 13, 0.681, 56001, [-22, 22], [-12, 12], [12, 14], 7, null),
      legacyRow('micro_flick_three_target_test_v2', 'micro-flick-room-v2', 'default', 17, 0.89, 56002, [-22, 22], [-12, 12], [16, 18], 7, null),
      legacyRow('micro_flick_three_target_test_v3', 'micro-flick-room-v3', 'default', 21, 1.1, 56003, [-22, 22], [-12, 12], [20, 22], 7, null),
      legacyRow('micro_flick_three_target_test_v4', 'micro-flick-room-v4', 'default', 25, 1.309, 56004, [-22, 22], [-12, 12], [24, 26], 7, null),
      legacyRow('micro_flick_three_target_test_v5', 'micro-flick-room-v5', 'default', 25, 1.5, 56005, [-10, 10], [-8, 8], [24, 26], 7, null),
      legacyRow('micro_flick_three_target_test_v6', 'micro-flick-room-v6', 'default', 25, 1.275, 56006, [-8.5, 8.5], [-8, 8], [24, 26], 7, null),
      legacyRow('micro_flick_three_target_test_v7', 'micro-flick-room-v7', 'default', 25, 1.275, 56007, [-6.5, 6.5], [-5, 6], [24, 26], 7, null),
    ]);
  });

  it('records the operational quality gates as concrete v8 payload facts', () => {
    const payload = withDisplayHz(t6Scenario(E4_FEINT), 144);

    expect(payload.meta.displayHz).toBeGreaterThanOrEqual(144);
    expect(payload.meta.crossOriginIsolated).toBe(true);
    expect(payload.meta.weaponId).toBe('usp_s_laser');
    expect(payload.meta.scene?.eye).toEqual(EYE);
    expect(payload.meta.targets?.hitbox?.shape).toBe('sphere');
    expect(payload.meta.simHz).toBe(128);
  });
});

function withDisplayHz(payload: ExportPayload, displayHz: number): ExportPayload {
  const frameMs = 1000 / displayHz;
  return {
    ...payload,
    meta: {
      ...payload.meta,
      displayHz,
      crossOriginIsolated: true,
      frames: {
        series: [frameMs, frameMs, frameMs, frameMs],
        summary: {
          count: 4,
          p50: frameMs,
          p95: frameMs,
          p99: frameMs,
          overBudgetWindows: 0,
          overflow: false,
        },
      },
    } as ExportPayload['meta'],
  };
}

function tickRateProbe(simHz: 64 | 128 | 256): ExportPayload {
  const steps = simHz;
  return t6Scenario({
    initial: [{ yawDeg: 0 }, { yawDeg: -20 }, { yawDeg: 25 }],
    path: ramp(0, 0.5, steps),
    kills: [{ tickIndex: steps, viewYawDeg: 0 }],
    simHz,
  });
}

function relativeDiff(value: number, baseline: number): number {
  return Math.abs(value - baseline) / Math.max(Math.abs(baseline), Number.EPSILON);
}

function expectObjectIsDeep(actual: unknown, expected: unknown): void {
  if (typeof actual === 'number' || typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(typeof expected).toBe('number');
    expect(Object.is(actual, expected)).toBe(true);
    return;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(Array.isArray(expected)).toBe(true);
    const actualArray = actual as readonly unknown[];
    const expectedArray = expected as readonly unknown[];
    expect(actualArray.length).toBe(expectedArray.length);
    for (let i = 0; i < actualArray.length; i++) {
      expectObjectIsDeep(actualArray[i], expectedArray[i]);
    }
    return;
  }
  if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object') {
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const actualKeys = Object.keys(actualRecord).sort();
    const expectedKeys = Object.keys(expectedRecord).sort();
    expect(actualKeys).toEqual(expectedKeys);
    for (const key of actualKeys) {
      expectObjectIsDeep(actualRecord[key], expectedRecord[key]);
    }
    return;
  }
  expect(actual).toEqual(expected);
}

interface LegacyMicroFlickFixture {
  readonly sceneId: string;
  readonly drill: DrillConfig;
}

function legacyMicroFlickSnapshot(): ReturnType<typeof legacyRow>[] {
  const fixtures: readonly LegacyMicroFlickFixture[] = [
    microFlickThreeTargetTestV1,
    microFlickThreeTargetTestV2,
    microFlickThreeTargetTestV3,
    microFlickThreeTargetTestV4,
    microFlickThreeTargetTestV5,
    microFlickThreeTargetTestV6,
    microFlickThreeTargetTestV7,
  ];
  return fixtures.map((fixture) => {
    const spawnArea = fixture.drill.targets.spawnArea!;
    const hitbox = fixture.drill.targets.hitbox!;
    return legacyRow(
      fixture.drill.drillId,
      fixture.sceneId,
      fixture.drill.weaponId ?? 'default',
      fixture.drill.targets.distance,
      round3(hitbox.widthU),
      fixture.drill.sequence.seed!,
      spawnArea.yawDegRange,
      spawnArea.pitchDegRange!,
      spawnArea.distanceURange,
      spawnArea.minAngularSeparationDeg!,
      spawnArea.preferredReplacementSeparationDeg ?? null,
    );
  });
}

function legacyRow(
  drillId: string,
  sceneId: string,
  weaponId: string,
  distanceU: number,
  diameterU: number,
  seed: number,
  yawDegRange: readonly [number, number],
  pitchDegRange: readonly [number, number],
  distanceURange: readonly [number, number],
  minAngularSeparationDeg: number,
  preferredReplacementSeparationDeg: number | null,
): {
  readonly drillId: string;
  readonly sceneId: string;
  readonly weaponId: string;
  readonly distanceU: number;
  readonly diameterU: number;
  readonly seed: number;
  readonly yawDegRange: readonly [number, number];
  readonly pitchDegRange: readonly [number, number];
  readonly distanceURange: readonly [number, number];
  readonly minAngularSeparationDeg: number;
  readonly preferredReplacementSeparationDeg: number | null;
} {
  return {
    drillId,
    sceneId,
    weaponId,
    distanceU,
    diameterU,
    seed,
    yawDegRange,
    pitchDegRange,
    distanceURange,
    minAngularSeparationDeg,
    preferredReplacementSeparationDeg,
  };
}

function round3(value: number): number {
  return Math.round(value * 1e3) / 1e3;
}
