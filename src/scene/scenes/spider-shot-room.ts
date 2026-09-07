import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/** Fixed-eye, obstacle-free room for the corrected Spider Shot assessment generation. */
export const spiderShotRoom: SceneConfig = validateScene({
  sceneId: 'spider-shot-room',
  assetPackVersion: 'spider-shot-room-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [16, 20, 10],
    eyeZ: 0,
    floorY: -4,
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
