import { describe, expect, it } from 'vitest';
import type { DrillConfig, SpiderShotYawPitchConfig } from '../../src/drill/DrillConfig.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { spiderShotV2 } from '../../src/drill/spider_shot_v2.ts';
import { SPIDER_SHOT_WIDE_PITCH_BANDS, resolveSpiderShotWideV1 } from '../../src/drill/spider_shot_wide_v1.ts';
import { ndcForEyeAngles, spiderWideEyeAngles } from '../../src/sim/spiderEyeFrame.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';

/**
 * WP-57 / T2 —— 分層佇列的統計性質（FR-57.6）、FR-57.4 的 on-screen 不等式、NFR-57.7 的熱路徑
 * 配置紀律，以及 `zone`／交替／`centerExemptFromTimeout` 對 `spider-shot-v2` 的 parity。
 *
 * 樣本一律走生產路徑（`createTargetManager().tick()` + `markKilled()`），不重寫一份取樣器：幾何
 * 純函式層的大樣本掃描屬 T1 的 `spider-wide-geometry.test.ts`，本檔要證的是**接進 sim 之後**這些
 * 性質仍然成立。
 */

const CELL_COUNT = 2 * SPIDER_SHOT_WIDE_PITCH_BANDS;
/** FR-57.4 的 `ndc_x` 上界 tight-by-construction（README §2.4 PoC B），故必須帶浮點容差。 */
const NDC_EPSILON = 1e-9;
/** FR-57.6 的覆蓋／平衡統計樣本數（周邊 spawn 數，非 tick 數）。 */
const COVERAGE_PERIPHERAL_SPAWNS = 10_000;
/** FR-57.4 每個 FOV × aspect 組合的周邊 spawn 數。 */
const NDC_PERIPHERAL_SPAWNS = 10_000;

interface WideSpawn {
  readonly zone: 'center' | 'peripheral';
  readonly side: 'L' | 'R';
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
}

/** 中心↔周邊交替，故取 n 個周邊 spawn 需要 2n 個 spawn 額度。 */
const spawnBudgetFor = (peripheralCount: number): number => peripheralCount * 2;

/** 把 spawn 上限放寬到樣本數需要的長度；`spiderShot` 排程逐位沿用 arm-time resolve 的輸出。 */
function wideConfig(fovDeg: number, aspect: number, spawnCount: number): DrillConfig {
  const resolved = resolveSpiderShotWideV1(fovDeg, aspect);
  return loadDrill({
    ...resolved,
    targets: { ...resolved.targets, count: spawnCount },
    timing: { countdownMs: 0 },
    endCondition: { type: 'targetCount', value: spawnCount },
  });
}

function drainSpawns(config: DrillConfig, spawnCount: number): WideSpawn[] {
  const state = createSharedState();
  const tm = createTargetManager(config);
  const spawns: WideSpawn[] = [];
  for (let i = 0; i < spawnCount; i++) {
    tm.tick(state, 100 + i * 100);
    const target = state.targets[0];
    spawns.push({ zone: target.zone!, side: target.side, pos: { ...target.pos } });
    tm.markKilled(state, target.id);
  }
  return spawns;
}

function pitchBandIndex(pitchDeg: number, range: readonly [number, number], bands: number): number {
  const step = (range[1] - range[0]) / bands;
  return Math.min(bands - 1, Math.max(0, Math.floor((pitchDeg - range[0]) / step)));
}

describe('WP-57 T2 — FR-57.6：分層佇列在 10,000 個周邊 spawn 下的覆蓋與 L/R 平衡', () => {
  const config = wideConfig(75, 16 / 9, spawnBudgetFor(COVERAGE_PERIPHERAL_SPAWNS));
  const schedule = config.spiderShot as SpiderShotYawPitchConfig;
  const peripheral = drainSpawns(config, config.targets.count).filter((s) => s.zone === 'peripheral');
  const cellKeys = peripheral.map((spawn) => {
    const { pitchDeg } = spiderWideEyeAngles(spawn.pos);
    return `${spawn.side}:${pitchBandIndex(pitchDeg, schedule.peripheral.pitchDegRange, schedule.grid.pitchBands)}`;
  });

  it(`錄到 ${COVERAGE_PERIPHERAL_SPAWNS} 個周邊 spawn`, () => {
    expect(peripheral).toHaveLength(COVERAGE_PERIPHERAL_SPAWNS);
  });

  it('每個 side × pitchBand cell 的出現次數差 ≤ 1 個佇列週期（即 ≤ 1 次）', () => {
    const counts = new Map<string, number>();
    for (const key of cellKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
    expect(counts.size).toBe(CELL_COUNT);
    const values = [...counts.values()];
    // 佇列每耗盡一次就重建 ⇒ 任兩個 cell 的差異只可能來自最後一個未走完的週期。
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(values.reduce((a, b) => a + b, 0)).toBe(COVERAGE_PERIPHERAL_SPAWNS);
  });

  it('每個完整佇列週期內左右次數相等，且整體 L/R 完全平衡', () => {
    const cycles = Math.floor(cellKeys.length / CELL_COUNT);
    for (let cycle = 0; cycle < cycles; cycle++) {
      const round = cellKeys.slice(cycle * CELL_COUNT, (cycle + 1) * CELL_COUNT);
      expect(new Set(round).size).toBe(CELL_COUNT); // 週期內無 cell 重複或落空
      expect(round.filter((k) => k.startsWith('L'))).toHaveLength(SPIDER_SHOT_WIDE_PITCH_BANDS);
      expect(round.filter((k) => k.startsWith('R'))).toHaveLength(SPIDER_SHOT_WIDE_PITCH_BANDS);
    }
    expect(cycles * CELL_COUNT).toBe(COVERAGE_PERIPHERAL_SPAWNS); // 樣本數恰為整數個週期
    expect(peripheral.filter((s) => s.side === 'L')).toHaveLength(COVERAGE_PERIPHERAL_SPAWNS / 2);
    expect(peripheral.filter((s) => s.side === 'R')).toHaveLength(COVERAGE_PERIPHERAL_SPAWNS / 2);
  });

  it('side 與落點的 yaw 符號一致（FR-57.7：side 承載真實左右）', () => {
    for (const spawn of peripheral) {
      const { yawDeg } = spiderWideEyeAngles(spawn.pos);
      expect(spawn.side).toBe(yawDeg < 0 ? 'L' : 'R');
    }
  });
});

describe('WP-57 T2 — FR-57.4：每個實際 spawn 的目標外緣都在畫面內（4 FOV × 3 aspect）', () => {
  const fovLevels = [60, 75, 90, 120] as const;
  const aspects = [16 / 9, 21 / 9, 4 / 3] as const;

  for (const fovDeg of fovLevels) {
    for (const aspect of aspects) {
      it(`FOV ${fovDeg} × aspect ${aspect.toFixed(4)}：${NDC_PERIPHERAL_SPAWNS} 個周邊 spawn 失敗數 0`, () => {
        const config = wideConfig(fovDeg, aspect, spawnBudgetFor(NDC_PERIPHERAL_SPAWNS));
        const schedule = config.spiderShot as SpiderShotYawPitchConfig;
        // halfHFOV 由 resolved config 的 `resolvedFrom` 反推，而非測試自己另設一組解析輸入。
        const { fovDegVertical, aspect: resolvedAspect, screenMargin, targetAngularDiameterDeg } = schedule.resolvedFrom;
        expect(fovDegVertical).toBe(fovDeg);
        expect(resolvedAspect).toBe(aspect);
        const bound = 1 - screenMargin;
        const radiusDeg = targetAngularDiameterDeg / 2;

        let failures = 0;
        let worstX = 0;
        let worstY = 0;
        for (const spawn of drainSpawns(config, config.targets.count)) {
          const { yawDeg, pitchDeg } = spiderWideEyeAngles(spawn.pos);
          // 外緣＝中心角度各推出一個目標角半徑（保守估計：大 yaw 下透視拉伸使實際外緣略小於此）。
          const outer = ndcForEyeAngles(
            Math.abs(yawDeg) + radiusDeg,
            Math.abs(pitchDeg) + radiusDeg,
            fovDegVertical,
            resolvedAspect,
          );
          worstX = Math.max(worstX, Math.abs(outer.x));
          worstY = Math.max(worstY, Math.abs(outer.y));
          if (Math.abs(outer.x) > bound + NDC_EPSILON || Math.abs(outer.y) > bound + NDC_EPSILON) failures++;
        }

        expect(failures).toBe(0);
        expect(worstX).toBeLessThanOrEqual(bound + NDC_EPSILON);
        expect(worstY).toBeLessThanOrEqual(bound + NDC_EPSILON);
      });
    }
  }
});

describe('WP-57 T2 — NFR-57.7：spawn 熱路徑零額外配置', () => {
  it('每個 spawn 只 push 目標本身；佇列只在耗盡時重建（每 CELL_COUNT 個周邊 spawn 一次）', () => {
    const cycles = 5;
    const spawnCount = spawnBudgetFor(CELL_COUNT * cycles);
    const config = wideConfig(75, 16 / 9, spawnCount);
    const state = createSharedState();
    const tm = createTargetManager(config);

    // 直接數 `Array.prototype.push`（不能用 `vi.spyOn`：spy 自己會 push 進 `mock.calls` 而無限遞迴）。
    const originalPush = Array.prototype.push;
    let pushCalls = 0;
    const deltas: number[] = [];
    const zones: Array<'center' | 'peripheral'> = [];
    try {
      // 暫時覆寫原型方法：整段包在 try/finally 內，且迴圈為同步，不會外洩到其他測試。
      Array.prototype.push = function patchedPush<T>(this: T[], ...items: T[]): number {
        pushCalls++;
        return originalPush.apply(this, items);
      };
      for (let i = 0; i < spawnCount; i++) {
        const before = pushCalls;
        tm.tick(state, 100 + i * 100);
        deltas[i] = pushCalls - before;
        zones[i] = state.targets[0].zone!;
        tm.markKilled(state, state.targets[0].id);
      }
    } finally {
      Array.prototype.push = originalPush;
    }

    // 中心 spawn 只有 `state.targets.push(target)`；周邊 spawn 同樣只有一次，唯有佇列耗盡時多出
    // `buildSpiderWideCells()` 的 CELL_COUNT 次 —— 沒有任何 per-spawn 暫存陣列或物件堆疊。
    const rebuildPeripheralOrdinals: number[] = [];
    let peripheralSeen = 0;
    for (let i = 0; i < spawnCount; i++) {
      if (zones[i] === 'center') {
        expect(deltas[i]).toBe(1);
        continue;
      }
      peripheralSeen++;
      expect([1, 1 + CELL_COUNT]).toContain(deltas[i]);
      if (deltas[i] === 1 + CELL_COUNT) rebuildPeripheralOrdinals.push(peripheralSeen);
    }

    // 重建恰好發生在每個週期的第一個周邊 spawn 上，次數 = 週期數（非 per-tick、非 per-spawn）。
    expect(peripheralSeen).toBe(CELL_COUNT * cycles);
    expect(rebuildPeripheralOrdinals).toEqual(
      Array.from({ length: cycles }, (_, cycle) => cycle * CELL_COUNT + 1),
    );
  });
});

describe('WP-57 T2 — FR-57.7：zone／交替／centerExemptFromTimeout 對 spider-shot-v2 parity', () => {
  const PEEK_TIMEOUT_MS = 100;

  /** 只改 `countdownMs`／`peekTimeoutMs`／spawn 上限；`spiderShot` 排程逐位沿用出貨值。 */
  function timeoutHarness(base: DrillConfig): {
    state: SharedState;
    tm: ReturnType<typeof createTargetManager>;
    runner: ReturnType<typeof createDrillRunner>;
  } {
    const config = loadDrill({
      ...base,
      targets: { ...base.targets, count: 4 },
      timing: { ...base.timing, countdownMs: 0, peekTimeoutMs: PEEK_TIMEOUT_MS },
      endCondition: { type: 'targetCount', value: 4 },
    });
    const state = createSharedState();
    const tm = createTargetManager(config);
    const runner = createDrillRunner(state, tm);
    runner.start(config);
    return { state, tm, runner };
  }

  /** 撤除當前目標（等價於命中路徑；走 `markKilled` 才會推進 zone，不經 `HitDetector` 免得把彈道帶進排程斷言）。 */
  function retireCurrent(state: SharedState, tm: ReturnType<typeof createTargetManager>): void {
    tm.markKilled(state, state.targets[0].id);
  }

  const cases = [
    { name: 'spider-shot-wide-v1', config: resolveSpiderShotWideV1(75, 16 / 9) },
    { name: 'spider-shot-v2', config: spiderShotV2 },
  ];

  it.each(cases)('$name：zone 由中心起算逐次交替', ({ config }) => {
    const { state, tm, runner } = timeoutHarness(config);
    const zones: Array<'center' | 'peripheral'> = [];
    for (let i = 0; i < 4; i++) {
      runner.tick(state, i * 2);
      zones.push(state.targets[0].zone!);
      retireCurrent(state, tm);
    }
    expect(zones).toEqual(['center', 'peripheral', 'center', 'peripheral']);
  });

  it.each(cases)('$name：centerExemptFromTimeout=true 時中心目標逾時仍存活', ({ config }) => {
    expect(config.spiderShot?.centerExemptFromTimeout).toBe(true);
    const { state, runner } = timeoutHarness(config);
    runner.tick(state, 0);
    expect(state.targets[0].zone).toBe('center');
    const centerId = state.targets[0].id;

    runner.tick(state, PEEK_TIMEOUT_MS * 5);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({ id: centerId, zone: 'center', alive: true });
  });

  it.each(cases)('$name：周邊目標仍在 peekTimeoutMs 到期時被撤除', ({ config }) => {
    const { state, tm, runner } = timeoutHarness(config);
    runner.tick(state, 0);
    retireCurrent(state, tm);
    runner.tick(state, 1);
    expect(state.targets[0].zone).toBe('peripheral');

    runner.tick(state, 1 + PEEK_TIMEOUT_MS);
    expect(state.targets).toHaveLength(0);
  });
});
