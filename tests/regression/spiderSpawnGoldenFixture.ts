import type { DrillConfig } from '../../src/drill/DrillConfig.ts';
import { spiderShotV1 } from '../../src/drill/spider_shot_v1.ts';
import { spiderShotV2 } from '../../src/drill/spider_shot_v2.ts';
import { createTargetManager, type TargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';

/**
 * WP-57 / T2（NFR-57.2）—— `spider-shot-v1` / `spider-shot-v2` 的 spawn 序列 golden 錄製器。
 *
 * **錄製順序是這份 fixture 的證明力來源**：golden JSON 必須在 `TargetManager` 新增第三支 spawn
 * 分支**之前**錄好並 commit（commit 順序可證），否則它只是把改壞後的行為蓋章成「預期」。
 *
 * 走的是生產路徑本身（`createTargetManager` + `tick()` + `markKilled()`），不是重寫一份取樣器：
 * 任何動到 RNG 消費順序、中心/周邊交替、`peripheralPos()` 幾何或 zone/side 蓋章的改動都會讓
 * golden 紅燈。`markKilled()` 每次撤除即推進 `nextSpiderZone`，故序列自然是中心↔周邊交替。
 */

/** 兩支既有 drill 各錄的 spawn 數（T2 step 2 要求 200）。 */
export const SPIDER_GOLDEN_SPAWN_COUNT = 200;

export interface SpiderSpawnSample {
  readonly zone: 'center' | 'peripheral';
  readonly side: 'L' | 'R';
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 只把 `targets.count` 提高到 200。`count` 是 **spawn 上限**（`spawnLimit`），不進入任何取樣式，
 * 也不被 RNG 消費（兩支 drill 都沒有 `hitboxCandidates`，故 `buildHitboxQueue()` 不讀它）——因此
 * 前 20 筆（v1 的真實 count）與 drill 上線時逐位相同，只是能多錄 180 筆而已。
 */
export function spiderGoldenConfig(base: DrillConfig): DrillConfig {
  return { ...base, targets: { ...base.targets, count: SPIDER_GOLDEN_SPAWN_COUNT } };
}

export const spiderShotV1GoldenConfig = spiderGoldenConfig(spiderShotV1);
export const spiderShotV2GoldenConfig = spiderGoldenConfig(spiderShotV2);

function drainSpawns(tm: TargetManager, state: SharedState, spawnCount: number): SpiderSpawnSample[] {
  const samples: SpiderSpawnSample[] = [];
  for (let i = 0; i < spawnCount; i++) {
    // spiderShot drill 無 spawnDelay/cue，故 nowMs 只用來蓋 t_visible，不影響 spawn 位置。
    tm.tick(state, 100 + i * 100);
    const target = state.targets[0];
    samples.push({ zone: target.zone!, side: target.side, x: target.pos.x, y: target.pos.y, z: target.pos.z });
    tm.markKilled(state, target.id);
  }
  return samples;
}

export function recordSpiderSpawns(config: DrillConfig, spawnCount = SPIDER_GOLDEN_SPAWN_COUNT): SpiderSpawnSample[] {
  return drainSpawns(createTargetManager(config), createSharedState(), spawnCount);
}

/** 同一個 manager 跑一輪 → `reset()`（seed 重建）→ 再跑一輪；兩輪必須逐位相同。 */
export function recordSpiderSpawnsWithResetRerun(
  config: DrillConfig,
  spawnCount = SPIDER_GOLDEN_SPAWN_COUNT,
): { readonly first: SpiderSpawnSample[]; readonly afterReset: SpiderSpawnSample[] } {
  const state = createSharedState();
  const tm = createTargetManager(config);
  const first = drainSpawns(tm, state, spawnCount);
  tm.reset(state);
  const afterReset = drainSpawns(tm, state, spawnCount);
  return { first, afterReset };
}
