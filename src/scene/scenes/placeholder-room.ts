import { validateScene, type SceneConfig } from '../SceneConfig.ts';

export const placeholderRoom: SceneConfig = validateScene({
  sceneId: 'placeholder-room',
  assetPackVersion: 'placeholder-room-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [],
  playerCorridor: { halfWidthU: 1 },
  proceduralRoom: {
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
  },
});
