import type { ProceduralRoomConfig, SceneConfig } from './SceneConfig.ts';

/**
 * `proceduralRoom` 缺席時的 fallback；`SceneManager` 與 `resolveEyeWorldBase` 共用同一份，
 * 避免兩處各自 fallback 漂移（KI-004 / S1 T1）。
 */
export const DEFAULT_PROCEDURAL_ROOM: ProceduralRoomConfig = {
  roomSize: [10, 10, 3],
  eyeHeight: 1.6,
  fovDeg: 75,
  colors: {
    floor: 0x33373c,
    wall: 0x4d545c,
    background: 0x202428,
  },
  lights: {
    ambientIntensity: 0.6,
    directionalIntensity: 1.2,
    directionalPosition: { x: 3, y: 4.5, z: 2.5 },
  },
};

/** camera 與背牆的保留距離（world unit）；原為 `SceneManager` 內的 local `standoff`。 */
export const CAMERA_STANDOFF = 1;

export interface EyeWorldBase {
  /** world x —— 玩家 sim 原點對應的 camera x（現行全場景皆 0）。 */
  x: number;
  /** world y —— camera 高度，= proceduralRoom.eyeHeight。 */
  y: number;
  /** world z —— KI-002/D1 的 eyeZ ?? depth/2 − CAMERA_STANDOFF。 */
  z: number;
}

/**
 * 由 `SceneConfig` 決定性推導射線/彈道原點的 world base。
 * 純函式、無副作用、不讀時鐘；`SceneManager` 與離線推導共用此唯一定義（KI-004 §2.3）。
 */
export function resolveEyeWorldBase(config: SceneConfig): EyeWorldBase {
  const room = config.proceduralRoom ?? DEFAULT_PROCEDURAL_ROOM;
  const depth = room.roomSize[1];
  return {
    x: 0,
    y: room.eyeHeight,
    z: room.eyeZ ?? depth / 2 - CAMERA_STANDOFF,
  };
}
