import { resolveTargetHitbox, type DrillConfig } from '../drill/DrillConfig.ts';
import { SPIDER_WIDE_EYE_ORIGIN } from '../sim/spiderEyeFrame.ts';
import type { SceneConfig } from './SceneConfig.ts';
import { resolveEyeWorldBase } from './eyePose.ts';

const EYE_ANCHOR_EPSILON_U = 1e-9;
const GEOMETRY_EPSILON = 1e-9;

/** Fail-fast binding guard for Spider Shot schedules whose public contract is eye-frame geometry. */
export function requireSpiderShotDeliveryGeometry(scene: SceneConfig, drill: DrillConfig): void {
  if (drill.spiderShot?.kind !== 'center-peripheral-eye-stratified') return;
  if (drill.playerControl?.translation !== 'locked') {
    throw new Error('DrillConfig 載入失敗: delivery geometry requires translation=locked');
  }
  if (drill.protocolGuard?.noMovement !== true) {
    throw new Error('DrillConfig 載入失敗: delivery geometry requires protocolGuard.noMovement=true');
  }
  const eye = resolveEyeWorldBase(scene);
  if (
    Math.abs(eye.x - SPIDER_WIDE_EYE_ORIGIN.x) > EYE_ANCHOR_EPSILON_U ||
    Math.abs(eye.y - SPIDER_WIDE_EYE_ORIGIN.y) > EYE_ANCHOR_EPSILON_U ||
    Math.abs(eye.z - SPIDER_WIDE_EYE_ORIGIN.z) > EYE_ANCHOR_EPSILON_U
  ) {
    throw new Error(
      `DrillConfig 載入失敗: delivery geometry eye anchor mismatch — scene=${scene.sceneId} ` +
        `eye=(${eye.x},${eye.y},${eye.z}) expected=(${SPIDER_WIDE_EYE_ORIGIN.x},${SPIDER_WIDE_EYE_ORIGIN.y},${SPIDER_WIDE_EYE_ORIGIN.z})`,
    );
  }

  const schedule = drill.spiderShot;
  if (!nearlyEqual(schedule.centerDistanceU, drill.targets.distance)) {
    throw new Error(
      'DrillConfig 載入失敗: delivery geometry center distance must equal targets.distance',
    );
  }
  if (
    !schedule.peripheral.distanceURange.every((distance) =>
      nearlyEqual(distance, drill.targets.distance),
    )
  ) {
    throw new Error(
      'DrillConfig 載入失敗: delivery geometry peripheral distance must equal targets.distance',
    );
  }

  const hitbox = resolveTargetHitbox(drill);
  if (
    hitbox.shape !== 'sphere' ||
    !nearlyEqual(hitbox.width, hitbox.height) ||
    !nearlyEqual(hitbox.width, hitbox.depth)
  ) {
    throw new Error('DrillConfig 載入失敗: delivery geometry requires a spherical hitbox');
  }
  const deliveredAngularDiameterDeg =
    2 * Math.atan(hitbox.width / 2 / drill.targets.distance) * (180 / Math.PI);
  if (!nearlyEqual(deliveredAngularDiameterDeg, schedule.targetAngularDiameterDeg)) {
    throw new Error(
      'DrillConfig 載入失敗: delivery geometry angular diameter does not match the hitbox',
    );
  }

  requireRoomEnvelope(scene, drill, hitbox.width / 2);
}

function requireRoomEnvelope(scene: SceneConfig, drill: DrillConfig, targetRadiusU: number): void {
  const room = scene.proceduralRoom;
  const schedule = drill.spiderShot;
  if (room === undefined || schedule?.kind !== 'center-peripheral-eye-stratified') {
    throw new Error('DrillConfig 載入失敗: delivery geometry requires a procedural room envelope');
  }
  const [width, depth, ceilingY] = room.roomSize;
  const floorY = room.floorY ?? 0;
  const eye = resolveEyeWorldBase(scene);
  const [minRadiusDeg, maxRadiusDeg] = schedule.peripheral.angularRadiusDegRange;
  if (minRadiusDeg < 0 || maxRadiusDeg > 90) {
    throw new Error('DrillConfig 載入失敗: delivery geometry room envelope requires radius in [0, 90]');
  }
  const maxDistanceU = Math.max(...schedule.peripheral.distanceURange);
  const minDistanceU = Math.min(...schedule.peripheral.distanceURange);
  const transverseU = maxDistanceU * Math.sin(maxRadiusDeg * (Math.PI / 180));
  const minZ = Math.min(
    eye.z - schedule.centerDistanceU,
    eye.z - maxDistanceU * Math.cos(minRadiusDeg * (Math.PI / 180)),
  ) - targetRadiusU;
  const maxZ =
    eye.z - minDistanceU * Math.cos(maxRadiusDeg * (Math.PI / 180)) + targetRadiusU;
  const fits =
    transverseU + targetRadiusU <= width / 2 + GEOMETRY_EPSILON &&
    eye.y - transverseU - targetRadiusU >= floorY - GEOMETRY_EPSILON &&
    eye.y + transverseU + targetRadiusU <= ceilingY + GEOMETRY_EPSILON &&
    minZ >= -depth / 2 - GEOMETRY_EPSILON &&
    maxZ <= depth / 2 + GEOMETRY_EPSILON;
  if (!fits) {
    throw new Error(
      `DrillConfig 載入失敗: delivery geometry room envelope cannot contain all targets in scene=${scene.sceneId}`,
    );
  }
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= GEOMETRY_EPSILON;
}
