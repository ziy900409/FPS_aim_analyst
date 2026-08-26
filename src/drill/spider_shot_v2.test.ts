import { describe, expect, it } from 'vitest';
import { resolveTargetHitbox } from './DrillConfig.ts';
import { loadDrill } from './DrillLoader.ts';
import { spiderShotV2 } from './spider_shot_v2.ts';
import { spiderShotV1 } from './spider_shot_v1.ts';

describe('spider-shot-v2 drill config', () => {
  it('declares an assessment stratified center/peripheral schedule with one RNG authority', () => {
    const config = loadDrill(spiderShotV2);

    expect(config.drillId).toBe('spider-shot-v2');
    expect(config.mode).toBe('assessment');
    expect(config.sequence.seed).toBeUndefined();
    expect(config.spiderShot).toEqual({
      kind: 'center-peripheral-stratified',
      seed: 260826,
      centerDistanceU: 8,
      peripheral: {
        angularRadiusDegRange: [10, 25],
        azimuthDegRange: [0, 360],
        distanceURange: [8, 8],
      },
      grid: { azimuthQuadrants: 4, radiusTiers: 3 },
      centerExemptFromTimeout: true,
    });
  });

  it('uses a 2.0°-at-8u spherical hitbox with matching dimensions', () => {
    const hitbox = resolveTargetHitbox(spiderShotV2);
    const expectedDiameter = 2 * 8 * Math.tan((2.0 / 2) * (Math.PI / 180));

    expect(hitbox.shape).toBe('sphere');
    expect(hitbox.width).toBeCloseTo(expectedDiameter);
    expect(hitbox.height).toBe(hitbox.width);
    expect(hitbox.depth).toBe(hitbox.width);
  });

  it('uses 60 seconds as the sole completion limit and retains a safe spawn ceiling', () => {
    expect(spiderShotV2.timing).toEqual({ countdownMs: 3000, peekTimeoutMs: 1750 });
    expect(spiderShotV2.endCondition).toEqual({ type: 'timeLimit', value: 60000 });
    expect(spiderShotV2.targets.count).toBeGreaterThanOrEqual(300);
  });

  it('does not share a seed with spider-shot-v1 (independent RNG streams)', () => {
    expect(spiderShotV2.spiderShot?.seed).not.toBe(spiderShotV1.spiderShot?.seed);
  });

  it('leaves spider-shot-v1 untouched (WP-39 frozen values)', () => {
    const config = loadDrill(spiderShotV1);
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
