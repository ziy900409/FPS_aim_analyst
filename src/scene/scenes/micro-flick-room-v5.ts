import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/** Reference-image-calibrated corridor: 12.9u × 12u end wall at z=-30.06. */
export const microFlickRoomV5: SceneConfig = validateScene({
  sceneId: 'micro-flick-room-v5',
  assetPackVersion: 'micro-flick-room-v5',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/micro-flick-room-v5/micro-flick-room-v5.gltf', displayScale: 1 },
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [12.9, 60, 12], eyeZ: 0, floorY: -4, eyeHeight: 1.6, fovDeg: 75,
    colors: { floor: 0xd1d1cc, wall: 0xe8e8e3, background: 0x4c5259 },
    lights: { ambientIntensity: 0.9, directionalIntensity: 0.8, directionalPosition: { x: 0, y: 7, z: 4 } },
  },
});
