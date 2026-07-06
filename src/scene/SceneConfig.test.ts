import { describe, expect, it } from 'vitest';
import { validateScene } from './SceneConfig.ts';

const VALID = {
  sceneId: 'placeholder-room',
  assetPackVersion: 'placeholder-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [{ id: 'crate', min: { x: 1, y: 0, z: -3 }, max: { x: 2, y: 1, z: -2 } }],
  playerCorridor: { halfWidthU: 1 },
} as const;

describe('validateScene', () => {
  it('合法 SceneConfig 回傳收斂 config', () => {
    const scene = validateScene(VALID);
    expect(scene.sceneId).toBe('placeholder-room');
    expect(scene.propBounds[0].id).toBe('crate');
    expect(scene.playerCorridor.halfWidthU).toBe(1);
  });

  it('propBounds min/max 反轉時 throw 欄位路徑錯誤', () => {
    const invalid = {
      ...VALID,
      propBounds: [{ id: 'bad', min: { x: 3, y: 0, z: -3 }, max: { x: 2, y: 1, z: -2 } }],
    };
    expect(() => validateScene(invalid)).toThrow(/propBounds\[0\]\.min\.x/);
  });
});
