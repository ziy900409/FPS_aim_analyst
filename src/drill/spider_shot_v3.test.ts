import { describe, expect, it } from 'vitest';

import { resolveEyeWorldBase } from '../scene/eyePose.ts';
import { spiderShotRoom } from '../scene/scenes/spider-shot-room.ts';
import { angularDistanceDeg } from '../metrics/eyeOrigin.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import {
  SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3,
  SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V3,
  spiderShotV3,
  spiderShotV3Binding,
} from './spider_shot_v3.ts';

describe('spider-shot-v3 delivered geometry', () => {
  it('delivers its configured center distance and angular diameter from the bound scene eye', () => {
    expect(spiderShotV3Binding.sceneId).toBe(spiderShotRoom.sceneId);
    expect(spiderShotV3.spiderShot?.kind).toBe('center-peripheral-eye-stratified');
    if (spiderShotV3.spiderShot?.kind !== 'center-peripheral-eye-stratified') return;
    expect(spiderShotV3.spiderShot.targetAngularDiameterDeg).toBe(SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3);

    const state = createSharedState();
    createTargetManager(spiderShotV3).tick(state, 0);

    const eye = resolveEyeWorldBase(spiderShotRoom);
    const target = state.targets[0];
    const distanceU = Math.hypot(target.pos.x - eye.x, target.pos.y - eye.y, target.pos.z - eye.z);
    const angularDiameterDeg =
      (2 * Math.atan(spiderShotV3.targets.hitbox!.widthU / 2 / distanceU) * 180) / Math.PI;

    expect(target.zone).toBe('center');
    expect(distanceU).toBeCloseTo(spiderShotV3.targets.distance, 12);
    expect(angularDiameterDeg).toBeCloseTo(SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3, 12);
  });

  it('keeps peripheral distance, width, and angular radius in the declared eye-frame envelope', () => {
    const eye = resolveEyeWorldBase(spiderShotRoom);
    const state = createSharedState();
    const manager = createTargetManager(spiderShotV3);
    const centerDirection = { x: 0, y: 0, z: -1 };
    const [minRadiusDeg, maxRadiusDeg] = SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V3;

    for (let index = 0; index < 200; index++) {
      manager.tick(state, index * 10);
      const target = state.targets[0];
      if (target.zone === 'peripheral') {
        const relative = {
          x: target.pos.x - eye.x,
          y: target.pos.y - eye.y,
          z: target.pos.z - eye.z,
        };
        const distanceU = Math.hypot(relative.x, relative.y, relative.z);
        const direction = {
          x: relative.x / distanceU,
          y: relative.y / distanceU,
          z: relative.z / distanceU,
        };
        const radiusDeg = angularDistanceDeg(centerDirection, direction);
        const angularDiameterDeg =
          (2 * Math.atan(spiderShotV3.targets.hitbox!.widthU / 2 / distanceU) * 180) / Math.PI;

        expect(distanceU).toBeCloseTo(spiderShotV3.targets.distance, 12);
        expect(angularDiameterDeg).toBeCloseTo(SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3, 12);
        expect(radiusDeg).toBeGreaterThanOrEqual(minRadiusDeg);
        expect(radiusDeg).toBeLessThanOrEqual(maxRadiusDeg);
      }
      manager.markKilled(state, target.id);
    }
  });
});
