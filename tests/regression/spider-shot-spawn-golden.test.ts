import { describe, expect, it } from 'vitest';
import spiderShotV1Golden from '../golden/spider-shot/spider-shot-v1-spawns.json';
import spiderShotV2Golden from '../golden/spider-shot/spider-shot-v2-spawns.json';
import {
  SPIDER_GOLDEN_SPAWN_COUNT,
  recordSpiderSpawns,
  recordSpiderSpawnsWithResetRerun,
  spiderShotV1GoldenConfig,
  spiderShotV2GoldenConfig,
  type SpiderSpawnSample,
} from './spiderSpawnGoldenFixture.ts';
import { spiderShotV1 } from '../../src/drill/spider_shot_v1.ts';
import { spiderShotV2 } from '../../src/drill/spider_shot_v2.ts';

/**
 * WP-57 / T2（NFR-57.2）—— `spider-shot-v1` / `spider-shot-v2` 零回歸閘。
 *
 * 兩支既有 drill 的 spawn 位置序列已凍結（v1 走 WP-36/39 的 `center-peripheral`，v2 走 WP-44 的
 * `center-peripheral-stratified`）。本 WP 在 `TargetManager` 新增第三支 `center-peripheral-yawpitch`
 * 分支，必然動到 `sampleSpiderShotPose()` 這個共用入口 —— 這份 golden 就是「新分支沒有偷改舊路徑的
 * RNG 消費順序、幾何或 zone/side 蓋章」的客觀證據。
 *
 * golden JSON 由 `scripts/recordSpiderSpawnGolden.ts` 在**新分支落地之前**錄製並先行 commit
 * （commit 順序可證），故它記錄的是改動前的真實行為，不是事後蓋章。
 */

const asSamples = (json: unknown): SpiderSpawnSample[] => json as SpiderSpawnSample[];

describe.each([
  { name: 'spider-shot-v1', config: spiderShotV1GoldenConfig, golden: asSamples(spiderShotV1Golden) },
  { name: 'spider-shot-v2', config: spiderShotV2GoldenConfig, golden: asSamples(spiderShotV2Golden) },
])('NFR-57.2 $name spawn sequence is byte-identical to the pre-WP-57 golden', ({ config, golden }) => {
  it(`replays the frozen ${SPIDER_GOLDEN_SPAWN_COUNT}-spawn sequence`, () => {
    expect(golden).toHaveLength(SPIDER_GOLDEN_SPAWN_COUNT);
    expect(recordSpiderSpawns(config)).toEqual(golden);
  });

  it('replays the same sequence again after reset() rebuilds the seeded RNG', () => {
    const { first, afterReset } = recordSpiderSpawnsWithResetRerun(config);
    expect(first).toEqual(golden);
    expect(afterReset).toEqual(golden);
  });

  it('keeps the center↔peripheral alternation and legacy side placeholder', () => {
    for (let i = 0; i < golden.length; i++) {
      expect(golden[i].zone).toBe(i % 2 === 0 ? 'center' : 'peripheral');
      // v1/v2 的 `side` 是型別佔位、恆為 'R'（CONTEXT.md）；wide-flick 才承載真實左右（FR-57.7）。
      expect(golden[i].side).toBe('R');
    }
  });
});

describe('NFR-57.2 golden covers the shipped drill configs, not a stand-in', () => {
  it('only widens the spawn cap and otherwise reuses the shipped spiderShot schedules', () => {
    expect(spiderShotV1GoldenConfig.spiderShot).toBe(spiderShotV1.spiderShot);
    expect(spiderShotV2GoldenConfig.spiderShot).toBe(spiderShotV2.spiderShot);
    expect(spiderShotV1GoldenConfig.targets.count).toBe(SPIDER_GOLDEN_SPAWN_COUNT);
    expect(spiderShotV2GoldenConfig.targets.count).toBe(SPIDER_GOLDEN_SPAWN_COUNT);
  });

  it('matches the shipped spider-shot-v1 drill exactly over its real 20-target budget', () => {
    expect(recordSpiderSpawns(spiderShotV1, spiderShotV1.targets.count)).toEqual(
      asSamples(spiderShotV1Golden).slice(0, spiderShotV1.targets.count),
    );
  });
});
