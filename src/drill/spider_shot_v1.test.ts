import { describe, expect, it } from 'vitest';
import { resolveTargetHitbox, type DrillConfig } from './DrillConfig.ts';
import { loadDrill } from './DrillLoader.ts';
import { spiderShotV1 } from './spider_shot_v1.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';

describe('spider-shot-v1 drill config', () => {
  it('declares an assessment center/peripheral schedule with one RNG authority', () => {
    const config = loadDrill(spiderShotV1);

    expect(config.drillId).toBe('spider-shot-v1');
    expect(config.mode).toBe('assessment');
    expect(config.sequence.seed).toBeUndefined();
    expect(config.spiderShot).toEqual({
      kind: 'center-peripheral',
      seed: 36036,
      centerDistanceU: 8,
      peripheral: {
        angularRadiusDegRange: [15, 15],
        azimuthDegRange: [0, 360],
        distanceURange: [8, 8],
      },
    });
  });

  it('centerDistanceU/peripheral.distanceURange 落在 placeholder-room 半深內（KI-012：z=-distance 越過北牆會被遮擋，見 TargetManager.ts DEFAULT_DISTANCE 註解）', () => {
    const config = loadDrill(spiderShotV1);
    const spiderShot = config.spiderShot!;
    // placeholder-room roomSize depth=20 → 北牆 z=-10（KI-012 修復前為 depth=10 → z=-5）。
    expect(spiderShot.centerDistanceU).toBeLessThan(10);
    expect(spiderShot.peripheral.distanceURange[1]).toBeLessThan(10);
  });

  it('worst-case peripheral y（angularRadiusDegRange 上限、azimuth 朝下）落在 placeholder-room 地板之上（KI-014：floorY=-3，見 SceneManager.ts #buildRoom）', () => {
    const config = loadDrill(spiderShotV1);
    const spiderShot = config.spiderShot!;
    const maxRadiusDeg = spiderShot.peripheral.angularRadiusDegRange[1];
    const worstCase: DrillConfig = {
      ...config,
      spiderShot: {
        kind: 'center-peripheral',
        seed: spiderShot.seed,
        centerDistanceU: spiderShot.centerDistanceU,
        peripheral: {
          angularRadiusDegRange: [maxRadiusDeg, maxRadiusDeg],
          azimuthDegRange: [180, 180], // 0=上/90=右/180=下/270=左（TargetManager.ts 註解）
          distanceURange: spiderShot.peripheral.distanceURange,
        },
      },
    };
    const state = createSharedState();
    const tm = createTargetManager(worstCase);
    tm.tick(state, 100); // center 先 spawn
    tm.markKilled(state, state.targets[0].id);
    tm.tick(state, 200); // 換周邊 spawn，此時已鎖死 azimuth=180/radius=上限

    const peripheral = state.targets[0];
    expect(peripheral.zone).toBe('peripheral');
    // placeholder-room floorY=-3（KI-014）；留 hitbox 半徑安全邊界。
    expect(peripheral.pos.y).toBeGreaterThan(-3 + resolveTargetHitbox(config).height / 2);
  });
});
