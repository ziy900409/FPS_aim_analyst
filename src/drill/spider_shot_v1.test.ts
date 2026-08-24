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
});
