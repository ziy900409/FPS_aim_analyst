import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/** WP-56 T3 — fixed-eye, panelled corridor presentation for the researcher-only micro-flick drill. */
export const microFlickRoom: SceneConfig = validateScene({
  sceneId: 'micro-flick-room',
  assetPackVersion: 'micro-flick-room-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/micro-flick-room/micro-flick-room.gltf', displayScale: 1 },
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [16, 36, 12],
    eyeZ: 0,
    floorY: -4,
    eyeHeight: 1.6,
    fovDeg: 75,
    colors: {
      // floor/wall are documented counterparts of the GLTF materials; asset scenes only use
      // background and lights at runtime.
      floor: 0xd1d1cc,
      wall: 0xe8e8e3,
      background: 0x4c5259,
    },
    lights: {
      ambientIntensity: 0.9,
      directionalIntensity: 0.8,
      directionalPosition: { x: 0, y: 7, z: 4 },
    },
  },
});
