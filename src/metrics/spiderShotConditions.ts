import type { ExportPayload } from '../data/export.ts';
import { angularDistanceDeg, type TargetPoint } from './eyeOrigin.ts';

export type SpiderQuadrant = 'horizontal' | 'vertical' | 'oblique';
export type SpiderTransitionDirection = 'center-to-peripheral' | 'peripheral-to-center';

export interface SpiderShotTransition {
  readonly index: number;
  readonly targetId: string;
  readonly direction: SpiderTransitionDirection;
  /** The arrival target's presentation label; center arrivals have no quadrant. */
  readonly quadrant?: SpiderQuadrant;
  /** D_deg: angular displacement from the preceding target direction. */
  readonly angularDistanceDeg: number;
  /** W_deg: angular width of the arrival target. */
  readonly angularSizeDeg: number;
  readonly hitbox: { readonly width: number; readonly height: number; readonly depth: number };
  readonly worldDistanceU: number;
  readonly seed: number;
  readonly targetConditionCell: string;
}

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

/**
 * Reconstructs Spider Shot transition conditions from visible-event anchors and
 * the exported GD-7 hitbox. No geometric state is duplicated in the simulator.
 */
export function deriveSpiderShotTransitions(payload: ExportPayload): readonly SpiderShotTransition[] {
  const visible = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);
  if (visible.length < 2) return [];

  const hitbox = requireHitbox(payload);
  const seed = requireSeed(payload);
  const transitions: SpiderShotTransition[] = [];

  for (let index = 1; index < visible.length; index++) {
    const previous = visible[index - 1];
    const current = visible[index];
    const previousPoint = requireTargetPoint(previous);
    const currentPoint = requireTargetPoint(current);
    const direction = requireDirection(previous, current);
    const worldDistanceU = Math.hypot(currentPoint.x, currentPoint.y, currentPoint.z);
    if (worldDistanceU === 0) throw new Error(`Spider Shot visible event ${current.targetId} is at the player origin`);

    const angularDistance = angularDistanceDeg(normalize(previousPoint), normalize(currentPoint));
    const angularSize = (2 * Math.atan((hitbox.width / 2) / worldDistanceU) * 180) / Math.PI;
    const quadrant = direction === 'center-to-peripheral' ? quadrantForPeripheral(previousPoint, currentPoint) : undefined;

    transitions.push({
      index: index - 1,
      targetId: current.targetId,
      direction,
      ...(quadrant !== undefined ? { quadrant } : {}),
      angularDistanceDeg: angularDistance,
      angularSizeDeg: angularSize,
      hitbox,
      worldDistanceU,
      seed,
      targetConditionCell: `spider:d=${formatConditionValue(angularDistance)};w=${formatConditionValue(angularSize)}`,
    });
  }

  return transitions;
}

function requireDirection(previous: VisibleEvent, current: VisibleEvent): SpiderTransitionDirection {
  if (previous.zone === 'center' && current.zone === 'peripheral') return 'center-to-peripheral';
  if (previous.zone === 'peripheral' && current.zone === 'center') return 'peripheral-to-center';
  throw new Error(
    `Spider Shot visible events must alternate center/peripheral zones; received ${String(previous.zone)} → ${String(current.zone)}`,
  );
}

function requireTargetPoint(event: VisibleEvent): TargetPoint {
  if (!isFiniteNumber(event.targetX) || !isFiniteNumber(event.targetY) || !isFiniteNumber(event.targetZ)) {
    throw new Error(`Spider Shot visible event ${event.targetId} requires finite targetX, targetY, and targetZ`);
  }
  return { x: event.targetX, y: event.targetY, z: event.targetZ };
}

function requireHitbox(payload: ExportPayload): { width: number; height: number; depth: number } {
  const hitbox = payload.meta.targets?.hitbox;
  if (hitbox === undefined) throw new Error('Spider Shot export requires meta.targets.hitbox');
  if (!isFinitePositiveNumber(hitbox.widthU) || !isFinitePositiveNumber(hitbox.heightU) || !isFinitePositiveNumber(hitbox.depthU)) {
    throw new Error('Spider Shot meta.targets.hitbox must contain positive finite widthU, heightU, and depthU');
  }
  return { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU };
}

function requireSeed(payload: ExportPayload): number {
  const seed = payload.meta.spawn?.seed;
  if (!isFiniteNumber(seed)) throw new Error('Spider Shot export requires meta.spawn.seed');
  return seed;
}

function quadrantForPeripheral(center: TargetPoint, peripheral: TargetPoint): SpiderQuadrant {
  const forward = normalize(center);
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  const peripheralDirection = normalize(peripheral);
  const radiusRad = (angularDistanceDeg(forward, peripheralDirection) * Math.PI) / 180;
  if (radiusRad === 0) return 'vertical';

  const tangent = normalize({
    x: peripheralDirection.x - Math.cos(radiusRad) * forward.x,
    y: peripheralDirection.y - Math.cos(radiusRad) * forward.y,
    z: peripheralDirection.z - Math.cos(radiusRad) * forward.z,
  });
  const azimuthDeg = normalizeAzimuthDeg((Math.atan2(dot(tangent, right), dot(tangent, up)) * 180) / Math.PI);
  const boundary = 45;
  const epsilon = 1e-9;

  if (
    Math.abs(azimuthDeg - boundary) <= epsilon ||
    Math.abs(azimuthDeg - 3 * boundary) <= epsilon ||
    Math.abs(azimuthDeg - 5 * boundary) <= epsilon ||
    Math.abs(azimuthDeg - 7 * boundary) <= epsilon
  ) {
    return 'oblique';
  }
  if (azimuthDeg < boundary || (azimuthDeg > 3 * boundary && azimuthDeg < 5 * boundary) || azimuthDeg > 7 * boundary) {
    return 'vertical';
  }
  if ((azimuthDeg > boundary && azimuthDeg < 3 * boundary) || (azimuthDeg > 5 * boundary && azimuthDeg < 7 * boundary)) {
    return 'horizontal';
  }
  return 'oblique';
}

function normalize(point: TargetPoint): TargetPoint {
  const length = Math.hypot(point.x, point.y, point.z);
  if (length === 0) throw new Error('Spider Shot target direction cannot be zero');
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function cross(a: TargetPoint, b: TargetPoint): TargetPoint {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: TargetPoint, b: TargetPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalizeAzimuthDeg(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function formatConditionValue(value: number): string {
  return value.toFixed(6);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}
