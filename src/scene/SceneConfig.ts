import type { Vec3 } from '../state/types.ts';

export type ClutterTier = 'low' | 'mid' | 'high';

export interface SceneAsset {
  url: string;
  displayScale?: number;
}

export interface ProceduralRoomConfig {
  roomSize: readonly [number, number, number];
  eyeHeight: number;
  fovDeg: number;
  colors: {
    floor: number;
    wall: number;
    background: number;
  };
  lights: {
    ambientIntensity: number;
    directionalIntensity: number;
    directionalPosition: Vec3;
  };
}

export interface PropBound {
  id: string;
  min: Vec3;
  max: Vec3;
}

export interface SceneConfig {
  sceneId: string;
  assetPackVersion: string;
  clutterTier: ClutterTier;
  asset: SceneAsset | null;
  propBounds: readonly PropBound[];
  playerCorridor: { halfWidthU: number };
  proceduralRoom?: ProceduralRoomConfig;
}

export function validateScene(json: unknown): SceneConfig {
  const root = requireObject(json, 'root');

  const sceneId = requireNonEmptyString(root.sceneId, 'sceneId');
  const assetPackVersion = requireNonEmptyString(root.assetPackVersion, 'assetPackVersion');
  const clutterTier = validateClutterTier(root.clutterTier);
  const asset = validateAsset(root.asset);
  const propBounds = validatePropBounds(root.propBounds);
  const corridor = requireObject(root.playerCorridor, 'playerCorridor');
  const halfWidthU = requirePositiveNumber(corridor.halfWidthU, 'playerCorridor.halfWidthU');
  const proceduralRoom =
    root.proceduralRoom === undefined ? undefined : validateProceduralRoom(root.proceduralRoom);

  return {
    sceneId,
    assetPackVersion,
    clutterTier,
    asset,
    propBounds,
    playerCorridor: { halfWidthU },
    ...(proceduralRoom !== undefined ? { proceduralRoom } : {}),
  };
}

function validateClutterTier(v: unknown): ClutterTier {
  if (v !== 'low' && v !== 'mid' && v !== 'high') {
    throw err('clutterTier', "必須為 'low' | 'mid' | 'high'");
  }
  return v;
}

function validateAsset(v: unknown): SceneConfig['asset'] {
  if (v === null) return null;
  const asset = requireObject(v, 'asset');
  const displayScale =
    asset.displayScale === undefined ? undefined : requirePositiveNumber(asset.displayScale, 'asset.displayScale');
  return {
    url: requireNonEmptyString(asset.url, 'asset.url'),
    ...(displayScale !== undefined ? { displayScale } : {}),
  };
}

function validatePropBounds(v: unknown): PropBound[] {
  if (!Array.isArray(v)) throw err('propBounds', '必須為陣列');
  return v.map((entry, i) => {
    const path = `propBounds[${i}]`;
    const prop = requireObject(entry, path);
    const id = requireNonEmptyString(prop.id, `${path}.id`);
    const min = validateVec3(prop.min, `${path}.min`);
    const max = validateVec3(prop.max, `${path}.max`);
    if (min.x > max.x) throw err(`${path}.min.x`, '必須 ≤ max.x');
    if (min.y > max.y) throw err(`${path}.min.y`, '必須 ≤ max.y');
    if (min.z > max.z) throw err(`${path}.min.z`, '必須 ≤ max.z');
    return { id, min, max };
  });
}

function validateVec3(v: unknown, path: string): Vec3 {
  const obj = requireObject(v, path);
  return {
    x: requireFiniteNumber(obj.x, `${path}.x`),
    y: requireFiniteNumber(obj.y, `${path}.y`),
    z: requireFiniteNumber(obj.z, `${path}.z`),
  };
}

function validateProceduralRoom(v: unknown): ProceduralRoomConfig {
  const room = requireObject(v, 'proceduralRoom');
  const colors = requireObject(room.colors, 'proceduralRoom.colors');
  const lights = requireObject(room.lights, 'proceduralRoom.lights');
  return {
    roomSize: validatePositiveNumberTuple3(room.roomSize, 'proceduralRoom.roomSize'),
    eyeHeight: requirePositiveNumber(room.eyeHeight, 'proceduralRoom.eyeHeight'),
    fovDeg: requirePositiveNumber(room.fovDeg, 'proceduralRoom.fovDeg'),
    colors: {
      floor: requireColorNumber(colors.floor, 'proceduralRoom.colors.floor'),
      wall: requireColorNumber(colors.wall, 'proceduralRoom.colors.wall'),
      background: requireColorNumber(colors.background, 'proceduralRoom.colors.background'),
    },
    lights: {
      ambientIntensity: requireNonNegativeNumber(lights.ambientIntensity, 'proceduralRoom.lights.ambientIntensity'),
      directionalIntensity: requireNonNegativeNumber(
        lights.directionalIntensity,
        'proceduralRoom.lights.directionalIntensity',
      ),
      directionalPosition: validateVec3(lights.directionalPosition, 'proceduralRoom.lights.directionalPosition'),
    },
  };
}

function validatePositiveNumberTuple3(v: unknown, path: string): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) throw err(path, '必須為長度 3 的陣列');
  return [
    requirePositiveNumber(v[0], `${path}[0]`),
    requirePositiveNumber(v[1], `${path}[1]`),
    requirePositiveNumber(v[2], `${path}[2]`),
  ];
}

function err(path: string, msg: string): Error {
  return new Error(`SceneConfig 驗證失敗: ${path} ${msg}`);
}

function requireObject(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw err(path, '必須為物件');
  }
  return v as Record<string, unknown>;
}

function requireNonEmptyString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) throw err(path, '必須為非空字串');
  return v;
}

function requireFiniteNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw err(path, '必須為有限數字');
  return v;
}

function requireNonNegativeNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n < 0) throw err(path, '必須 ≥ 0');
  return n;
}

function requirePositiveNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n <= 0) throw err(path, '必須 > 0');
  return n;
}

function requireColorNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffff) throw err(path, '必須為 0x000000..0xffffff 整數');
  return n;
}
