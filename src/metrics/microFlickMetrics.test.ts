import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { angularDistanceDeg } from './eyeOrigin.ts';
import { createRan1 } from '../recoil/rng.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { Vec3 } from '../state/types.ts';
import {
  MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY,
  MICRO_FLICK_OUTCOME_FLAG_VOCABULARY,
  MICRO_FLICK_SELECTION_FLAG_VOCABULARY,
  deriveMicroFlickMetrics,
  type MicroFlickGeometryMetrics,
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

  it('不先佔位尚未交付的鍵：L1 已由 T5 交付，L2 與方向預測仍由 T6 交付', () => {
    const metrics = deriveMicroFlickMetrics(scenario(HAND_CASE)) as unknown as Record<string, unknown>;
    expect(Object.keys(metrics).sort()).toEqual([
      'eyeOriginSource',
      'geometry',
      'outcome',
      'selection',
      'version',
    ]);
    // 空陣列會被讀成「算過了，沒有樣本」而不是「這一層還沒交付」。
    expect(metrics.microAdjust).toBeUndefined();
    expect(metrics.direction).toBeUndefined();
  });
});

describe('WP-63 T4 — C-D4：角距來自既有 canonical 實作,不在本模組重寫幾何', () => {
  const source = codeOnly(
    readFileSync(fileURLToPath(new URL('./microFlickMetrics.ts', import.meta.url)), 'utf8'),
  );

  it('模組原始碼不含任何三角／弧度換算——夾角一律經 angularDistanceDeg()', () => {
    for (const symbol of [
      'Math.acos',
      'Math.asin',
      'Math.atan',
      'Math.cos',
      'Math.sin',
      'Math.tan',
      'RAD_TO_DEG',
      'DEG_TO_RAD',
      'Math.PI',
    ]) {
      expect(occurrences(source, symbol), symbol).toBe(0);
    }
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
