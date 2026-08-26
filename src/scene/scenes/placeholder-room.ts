import { validateScene, type SceneConfig } from '../SceneConfig.ts';

export const placeholderRoom: SceneConfig = validateScene({
  sceneId: 'placeholder-room',
  assetPackVersion: 'placeholder-room-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [],
  playerCorridor: { halfWidthU: 1 },
  proceduralRoom: {
    // depth=20（KI-012）：spider-shot 系列的 centerDistanceU/distanceURange=8 需要清楚落在後牆
    // （z=-depth/2）前方；depth=10 時後牆在 z=-5，比目標(z=-8)更靠近相機，整顆目標被牆體遮擋
    // （視覺上完全看不到，但 HitDetector 不查牆遮擋，命中判定仍會通過——KI-012）。
    // eyeZ 明確釘住為舊 depth=10 時的 fallback 值（depth/2-standoff=4），避免 depth 改動連動改變
    // camera/raycast 原點,牽動本場景其他既有 drill 的實際交戰距離。
    roomSize: [10, 20, 3],
    eyeZ: 4,
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
  },
});
