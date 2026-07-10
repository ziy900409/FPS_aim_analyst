import {
  DEFAULT_TARGET_HITBOX,
  resolveTargetHitbox,
  type DrillConfig,
  type SpawnAreaConfig,
  type TargetHitboxSize,
} from '../drill/DrillConfig.ts';
import type { TargetMotion, Vec3 } from '../state/types.ts';
import type { PropBound, SceneConfig } from './SceneConfig.ts';

export const CLEARANCE_MARGIN_U = 0.5;
export const TARGET_SIDE_OFFSET_U = 2;
export const TARGET_CENTER_Y_U = 1.5;
export const TARGET_HITBOX_U = DEFAULT_TARGET_HITBOX;
export const PLAYER_EYE_HEIGHT_U = 1.6;

export const TARGET_HITBOX_RADIUS_U = targetHitboxRadius(TARGET_HITBOX_U);

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export interface TargetEnvelope extends Aabb {
  side: 'L' | 'R';
}

export interface ClearanceViolation {
  propId: string;
  segment: string;
}

export function targetHitboxRadius(hitbox: TargetHitboxSize): number {
  return Math.sqrt((hitbox.width / 2) ** 2 + (hitbox.height / 2) ** 2 + (hitbox.depth / 2) ** 2);
}

interface Segment {
  from: Vec3;
  to: Vec3;
  description: string;
}

export function validateClearance(scene: SceneConfig, drill: DrillConfig): ClearanceViolation[] {
  const hitbox = resolveTargetHitbox(drill);
  const propInflationU = targetHitboxRadius(hitbox) + CLEARANCE_MARGIN_U;
  const playerSamples = samplePlayerCorridor(scene.playerCorridor.halfWidthU);
  const targetSamples = deriveTargetEnvelopes(drill).flatMap(sampleAabb);
  const violations: ClearanceViolation[] = [];

  for (const prop of scene.propBounds) {
    const inflated = inflateAabb(prop, propInflationU);
    let propViolated = false;
    for (let i = 0; i < playerSamples.length; i++) {
      for (let j = 0; j < targetSamples.length; j++) {
        const segment: Segment = {
          from: playerSamples[i],
          to: targetSamples[j].point,
          description: `player[${i}] -> ${targetSamples[j].description}`,
        };
        if (segmentIntersectsAabb(segment.from, segment.to, inflated)) {
          violations.push({ propId: prop.id, segment: segment.description });
          propViolated = true;
          break;
        }
      }
      if (propViolated) break;
    }
  }

  return violations;
}

export function formatClearanceViolations(violations: readonly ClearanceViolation[]): string {
  return violations.map((v) => `${v.propId} (${v.segment})`).join('; ');
}

export function deriveTargetEnvelopes(drill: DrillConfig): TargetEnvelope[] {
  const hitbox = resolveTargetHitbox(drill);
  if (drill.targets.spawnArea !== undefined) {
    const envelope = envelopeForSpawnArea(drill.targets.spawnArea, drill.targets.motion, hitbox);
    assertFiniteEnvelope(envelope);
    return [envelope];
  }
  return activeSides(drill).map((side) => {
    const envelope = envelopeForSide(side, drill.targets.distance, drill.targets.motion, hitbox);
    assertFiniteEnvelope(envelope);
    return envelope;
  });
}

/**
 * 保證門縱深（PR #10 review）:envelope 任一邊界非有限（NaN/±Infinity）時,`clipAxis` 的 NaN 比較
 * 會讓 `segmentIntersectsAabb` 對所有線段靜默回 false——「未檢查」被當成「淨空」放行,與驗證器的
 * 保證語意相反。schema 已擋非 Vec3 waypoint;此處對繞過 schema 的呼叫端（或未來回歸）loud fail。
 */
function assertFiniteEnvelope(envelope: TargetEnvelope): void {
  const bounds = [envelope.min.x, envelope.min.y, envelope.min.z, envelope.max.x, envelope.max.y, envelope.max.z];
  if (bounds.some((value) => !Number.isFinite(value))) {
    throw new Error(`淨空驗證失敗: target:${envelope.side} envelope 含非有限邊界（motion range/waypoints 數值不合法）`);
  }
}

function activeSides(drill: DrillConfig): Array<'L' | 'R'> {
  const first = drill.sequence.alternation[0] as 'L' | 'R';
  if (drill.targets.count === 1) return [first];
  return ['L', 'R'];
}

function envelopeForSide(
  side: 'L' | 'R',
  distance: number,
  motion: TargetMotion | undefined,
  hitbox: TargetHitboxSize,
): TargetEnvelope {
  const center = {
    x: side === 'R' ? TARGET_SIDE_OFFSET_U : -TARGET_SIDE_OFFSET_U,
    y: TARGET_CENTER_Y_U,
    z: -distance,
  };
  const half = {
    x: hitbox.width / 2,
    y: hitbox.height / 2,
    z: hitbox.depth / 2,
  };
  const min = { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z };
  const max = { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z };

  if (motion !== undefined && motion.type !== 'static') {
    expandForMotion(min, max, center, motion, hitbox);
  }

  return { side, min, max };
}

function envelopeForSpawnArea(
  spawnArea: SpawnAreaConfig,
  motion: TargetMotion | undefined,
  hitbox: TargetHitboxSize,
): TargetEnvelope {
  const centers = spawnAreaCenters(spawnArea);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const center of centers) expandByPoint(min, max, center, hitbox);

  if (motion !== undefined && motion.type !== 'static') {
    expandSpawnAreaForMotion(min, max, centers, motion, hitbox);
  }

  return { side: spawnArea.yawDegRange[1] <= 0 ? 'L' : 'R', min, max };
}

function spawnAreaCenters(spawnArea: SpawnAreaConfig): Vec3[] {
  const yaws = uniqueNumbers([...spawnArea.yawDegRange, ...criticalYawDegrees(spawnArea.yawDegRange)]);
  const distances = uniqueNumbers([...spawnArea.distanceURange]);
  const centers: Vec3[] = [];
  for (const yawDeg of yaws) {
    const yawRad = yawDeg * (Math.PI / 180);
    for (const distanceU of distances) {
      centers.push({
        x: Math.sin(yawRad) * distanceU,
        y: TARGET_CENTER_Y_U,
        z: -Math.cos(yawRad) * distanceU,
      });
    }
  }
  return centers;
}

function criticalYawDegrees(range: readonly [number, number]): number[] {
  const yaws: number[] = [];
  for (let yaw = Math.ceil(range[0] / 90) * 90; yaw <= range[1]; yaw += 90) {
    yaws.push(yaw);
  }
  return yaws;
}

function uniqueNumbers(values: readonly number[]): number[] {
  return Array.from(new Set(values));
}

function expandForMotion(
  min: Vec3,
  max: Vec3,
  center: Vec3,
  motion: TargetMotion,
  hitbox: TargetHitboxSize,
): void {
  if (motion.range !== undefined && motion.axis !== undefined) {
    const axis = motion.axis === 'horizontal' ? 'x' : 'y';
    min[axis] -= motion.range;
    max[axis] += motion.range;
  }
  if (motion.type === 'waypoints' && motion.waypoints !== undefined) {
    for (const point of motion.waypoints) {
      expandByPoint(
        min,
        max,
        {
          x: center.x + point.x,
          y: center.y + point.y,
          z: center.z + point.z,
        },
        hitbox,
      );
    }
  }
}

function expandSpawnAreaForMotion(
  min: Vec3,
  max: Vec3,
  centers: readonly Vec3[],
  motion: TargetMotion,
  hitbox: TargetHitboxSize,
): void {
  if (motion.range !== undefined && motion.axis !== undefined) {
    const axis = motion.axis === 'horizontal' ? 'x' : 'y';
    min[axis] -= motion.range;
    max[axis] += motion.range;
  }
  if (motion.type === 'waypoints' && motion.waypoints !== undefined) {
    for (const center of centers) {
      for (const point of motion.waypoints) {
        expandByPoint(
          min,
          max,
          {
            x: center.x + point.x,
            y: center.y + point.y,
            z: center.z + point.z,
          },
          hitbox,
        );
      }
    }
  }
}

function expandByPoint(min: Vec3, max: Vec3, point: Vec3, hitbox: TargetHitboxSize): void {
  min.x = Math.min(min.x, point.x - hitbox.width / 2);
  max.x = Math.max(max.x, point.x + hitbox.width / 2);
  min.y = Math.min(min.y, point.y - hitbox.height / 2);
  max.y = Math.max(max.y, point.y + hitbox.height / 2);
  min.z = Math.min(min.z, point.z - hitbox.depth / 2);
  max.z = Math.max(max.z, point.z + hitbox.depth / 2);
}

function samplePlayerCorridor(halfWidthU: number): Vec3[] {
  return [
    { x: -halfWidthU, y: PLAYER_EYE_HEIGHT_U, z: 0 },
    { x: 0, y: PLAYER_EYE_HEIGHT_U, z: 0 },
    { x: halfWidthU, y: PLAYER_EYE_HEIGHT_U, z: 0 },
  ];
}

function sampleAabb(aabb: TargetEnvelope): Array<{ point: Vec3; description: string }> {
  const xs = [aabb.min.x, aabb.max.x];
  const ys = [aabb.min.y, aabb.max.y];
  const zs = [aabb.min.z, aabb.max.z];
  const points: Array<{ point: Vec3; description: string }> = [
    {
      point: {
        x: (aabb.min.x + aabb.max.x) / 2,
        y: (aabb.min.y + aabb.max.y) / 2,
        z: (aabb.min.z + aabb.max.z) / 2,
      },
      description: `target:${aabb.side}:center`,
    },
  ];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        points.push({ point: { x, y, z }, description: `target:${aabb.side}:corner(${x},${y},${z})` });
      }
    }
  }
  return points;
}

function inflateAabb(aabb: PropBound, amount: number): Aabb {
  return {
    min: { x: aabb.min.x - amount, y: aabb.min.y - amount, z: aabb.min.z - amount },
    max: { x: aabb.max.x + amount, y: aabb.max.y + amount, z: aabb.max.z + amount },
  };
}

function segmentIntersectsAabb(from: Vec3, to: Vec3, box: Aabb): boolean {
  let tMin = 0;
  let tMax = 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;

  const x = clipAxis(from.x, dx, box.min.x, box.max.x, tMin, tMax);
  if (x === null) return false;
  tMin = x.tMin;
  tMax = x.tMax;

  const y = clipAxis(from.y, dy, box.min.y, box.max.y, tMin, tMax);
  if (y === null) return false;
  tMin = y.tMin;
  tMax = y.tMax;

  const z = clipAxis(from.z, dz, box.min.z, box.max.z, tMin, tMax);
  if (z === null) return false;
  return true;
}

function clipAxis(
  origin: number,
  delta: number,
  min: number,
  max: number,
  currentMin: number,
  currentMax: number,
): { tMin: number; tMax: number } | null {
  if (delta === 0) {
    return origin >= min && origin <= max ? { tMin: currentMin, tMax: currentMax } : null;
  }
  const inv = 1 / delta;
  let t1 = (min - origin) * inv;
  let t2 = (max - origin) * inv;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }
  const tMin = Math.max(currentMin, t1);
  const tMax = Math.min(currentMax, t2);
  return tMin <= tMax ? { tMin, tMax } : null;
}
