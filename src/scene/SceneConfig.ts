import type { Vec3 } from '../state/types.ts';

export type ClutterTier = 'low' | 'mid' | 'high';

export interface PropBound {
  id: string;
  min: Vec3;
  max: Vec3;
}

export interface SceneConfig {
  sceneId: string;
  assetPackVersion: string;
  clutterTier: ClutterTier;
  asset: { url: string } | null;
  propBounds: readonly PropBound[];
  playerCorridor: { halfWidthU: number };
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

  return {
    sceneId,
    assetPackVersion,
    clutterTier,
    asset,
    propBounds,
    playerCorridor: { halfWidthU },
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
  return { url: requireNonEmptyString(asset.url, 'asset.url') };
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

function requirePositiveNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n <= 0) throw err(path, '必須 > 0');
  return n;
}
