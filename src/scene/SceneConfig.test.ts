import { describe, expect, it } from 'vitest';
import { validateScene } from './SceneConfig.ts';
import { placeholderRoom } from './scenes/placeholder-room.ts';

const VALID = {
  sceneId: 'placeholder-room',
  assetPackVersion: 'placeholder-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/field-low/scene.gltf', displayScale: 0.01 },
  propBounds: [{ id: 'crate', min: { x: 1, y: 0, z: -3 }, max: { x: 2, y: 1, z: -2 } }],
  playerCorridor: { halfWidthU: 1 },
} as const;

describe('validateScene', () => {
  it('合法 SceneConfig 回傳收斂 config', () => {
    const scene = validateScene(VALID);
    expect(scene.sceneId).toBe('placeholder-room');
    expect(scene.asset).toEqual({ url: '/assets/scenes/field-low/scene.gltf', displayScale: 0.01 });
    expect(scene.propBounds[0].id).toBe('crate');
    expect(scene.playerCorridor.halfWidthU).toBe(1);
  });

  it('placeholder-room config 經同一個 validateScene 路徑收斂', () => {
    expect(placeholderRoom.sceneId).toBe('placeholder-room');
    expect(placeholderRoom.asset).toBeNull();
    expect(placeholderRoom.propBounds).toEqual([]);
    expect(placeholderRoom.proceduralRoom?.roomSize).toEqual([10, 20, 3]);
  });

  it('asset.displayScale 必須為正有限數', () => {
    const invalid = { ...VALID, asset: { url: '/scene.gltf', displayScale: 0 } };
    expect(() => validateScene(invalid)).toThrow(/asset\.displayScale/);
  });

  it('propBounds min/max 反轉時 throw 欄位路徑錯誤', () => {
    const invalid = {
      ...VALID,
      propBounds: [{ id: 'bad', min: { x: 3, y: 0, z: -3 }, max: { x: 2, y: 1, z: -2 } }],
    };
    expect(() => validateScene(invalid)).toThrow(/propBounds\[0\]\.min\.x/);
  });

  it('playerCorridor.halfWidthU 必須為正有限數', () => {
    const invalid = { ...VALID, playerCorridor: { halfWidthU: Number.NaN } };
    expect(() => validateScene(invalid)).toThrow(/playerCorridor\.halfWidthU/);
  });

  it('proceduralRoom 欄位錯誤時 throw field-path 訊息', () => {
    const invalid = {
      ...VALID,
      asset: null,
      proceduralRoom: {
        roomSize: [10, 10, 3],
        eyeHeight: 1.6,
        fovDeg: 75,
        colors: { floor: 0x33373c, wall: 0x4d545c, background: 0x1000000 },
        lights: {
          ambientIntensity: 0.6,
          directionalIntensity: 1.2,
          directionalPosition: { x: 3, y: 4.5, z: 2.5 },
        },
      },
    };
    expect(() => validateScene(invalid)).toThrow(/proceduralRoom\.colors\.background/);
  });
});
