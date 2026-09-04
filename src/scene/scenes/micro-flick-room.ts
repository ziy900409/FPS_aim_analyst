import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/**
 * WP-56 T1 scene contract. T3 replaces the asset-null procedural presentation with the approved
 * panelled corridor GLTF without changing this stable scene id, eye pose, FOV, or room envelope.
 */
export const microFlickRoom: SceneConfig = validateScene({
  sceneId: 'micro-flick-room',
  assetPackVersion: 'micro-flick-room-contract-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [16, 36, 12],
    eyeZ: 0,
    floorY: -4,
    eyeHeight: 1.6,
    fovDeg: 75,
    colors: {
      floor: 0xd9d9d4,
      wall: 0xc8c9c7,
      background: 0x35383d,
    },
    lights: {
      ambientIntensity: 0.75,
      directionalIntensity: 1.1,
      directionalPosition: { x: 0, y: 7, z: 3 },
    },
  },
});
