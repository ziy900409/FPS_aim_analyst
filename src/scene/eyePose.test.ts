import { describe, expect, it } from 'vitest';
import { SceneManager } from '../render/SceneManager.ts';
import { resolveEyeWorldBase } from './eyePose.ts';
import { placeholderRoom } from './scenes/placeholder-room.ts';
import { fieldLow } from './scenes/field-low.ts';
import { urbanHigh } from './scenes/urban-high.ts';
import { brField } from './scenes/br-field.ts';

describe('resolveEyeWorldBase — 逐場景逐位斷言（FM-4）', () => {
  it('placeholder-room：顯式 eyeZ:4（KI-012，釘住 depth=10 時代 fallback 值，depth 已改 20）', () => {
    expect(resolveEyeWorldBase(placeholderRoom)).toEqual({ x: 0, y: 1.6, z: 4 });
  });

  it('field-low：無 eyeZ → depth/2 − standoff', () => {
    expect(resolveEyeWorldBase(fieldLow)).toEqual({ x: 0, y: 1.6, z: 4 });
  });

  it('urban-high：無 eyeZ → depth/2 − standoff', () => {
    expect(resolveEyeWorldBase(urbanHigh)).toEqual({ x: 0, y: 1.6, z: 4 });
  });

  it('br-field：顯式 eyeZ:0（KI-002/D1）→ z=0，不受 roomSize 影響', () => {
    expect(resolveEyeWorldBase(brField)).toEqual({ x: 0, y: 1.6, z: 0 });
  });
});

describe('SceneManager.camera.position 與 resolveEyeWorldBase 綁定（防日後只改一邊）', () => {
  it.each([
    ['placeholder-room', placeholderRoom],
    ['field-low', fieldLow],
    ['urban-high', urbanHigh],
    ['br-field', brField],
  ])('%s', (_label, config) => {
    const manager = new SceneManager(config);
    const eye = resolveEyeWorldBase(config);
    expect(manager.camera.position.x).toBe(eye.x);
    expect(manager.camera.position.y).toBe(eye.y);
    expect(manager.camera.position.z).toBe(eye.z);
  });
});
