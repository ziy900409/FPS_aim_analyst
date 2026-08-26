import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { spiderShotV1 } from './spider_shot_v1.ts';

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
});
