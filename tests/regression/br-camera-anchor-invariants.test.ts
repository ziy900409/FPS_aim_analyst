import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SceneManager } from '../../src/render/SceneManager.ts';
import type { SceneConfig } from '../../src/scene/SceneConfig.ts';
import { brField } from '../../src/scene/scenes/br-field.ts';
import { fieldLow } from '../../src/scene/scenes/field-low.ts';
import { urbanHigh } from '../../src/scene/scenes/urban-high.ts';
import { placeholderRoom } from '../../src/scene/scenes/placeholder-room.ts';
import { trackingBrVariants } from '../../src/drill/tracking_br_v1.ts';
import { BR_PROJECTILE_BULLET } from '../../src/weapon/weapons.ts';

/**
 * KI-002 / D1 回歸網（FR-6）。
 *
 * 封住既有測試盲區:`br-tracking-invariants.test.ts` **自建** z=4 camera(不經 SceneManager),
 * 故看不到 br-field 真實 camera z=144 → BR 交戰距離被放大 ~2.3×、projectile 永遠打不到。
 * 本檔用**真實 `SceneManager`** 建 camera,鎖住「radial-spawn drill 眼睛在 sim origin」契約。
 */

function cameraWorldZ(config: SceneConfig): number {
  const manager = new SceneManager(config);
  manager.camera.updateMatrixWorld(true);
  return manager.camera.getWorldPosition(new THREE.Vector3()).z;
}

describe('KI-002 / D1 — br-field camera anchored to sim origin', () => {
  it('anchors the br-field ray/ballistic origin at z=0 (eyeZ:0)', () => {
    // FR-6:射線/彈道原點 = camera world position;br-field 必須落在 sim origin 平面。
    expect(cameraWorldZ(brField)).toBe(0);
  });

  it('leaves camera z byte-for-byte unchanged for scenes without eyeZ', () => {
    // FR-3 / NFR-2:未設 eyeZ 者維持 depth/2 - standoff = 10/2 - 1 = 4。
    expect(cameraWorldZ(placeholderRoom)).toBe(4);
    expect(cameraWorldZ(fieldLow)).toBe(4);
    expect(cameraWorldZ(urbanHigh)).toBe(4);
  });

  it('yields actual engagement distance == config distance for the forward BR target', () => {
    // FR-1 / FR-2:前向 radial spawn(yaw=0)目標在 z=−distance;實際交戰距離 = camera z − target z。
    const variant = trackingBrVariants.find(
      (candidate) =>
        candidate.axes.ads === 'ads_on' &&
        candidate.axes.ballistic === 'projectile' &&
        candidate.axes.angularHeight === '0p5deg',
    );
    if (variant === undefined) throw new Error('missing ads_on/projectile/0p5deg BR variant');

    const configDistance = variant.drill.targets.distance;
    const forwardTargetZ = -configDistance; // yawDegRange [0,0] → z = −cos(0)·distance
    const engagementDistance = cameraWorldZ(brField) - forwardTargetZ;

    // 交戰距離回到 config 宣告值(0.5° → 114.591u),誤差 < 1e-3(DoD)。
    expect(Math.abs(engagementDistance - configDistance)).toBeLessThan(1e-3);
    // projectile 子彈在 maxRangeU 內即可抵達目標(修正前 258.59u > 143.24u → 0 命中)。
    expect(engagementDistance).toBeLessThanOrEqual(BR_PROJECTILE_BULLET.maxRangeU);
  });
});
