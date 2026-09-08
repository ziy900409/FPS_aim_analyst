import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/** 52u corridor paired exclusively with micro_flick_three_target_test_v3. */
export const microFlickRoomV3: SceneConfig = validateScene({
  sceneId: 'micro-flick-room-v3',
  assetPackVersion: 'micro-flick-room-v3',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/micro-flick-room-v3/micro-flick-room-v3.gltf', displayScale: 1 },
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [20, 52, 12], eyeZ: 0, floorY: -4, eyeHeight: 1.6, fovDeg: 75,
    colors: { floor: 0xd1d1cc, wall: 0xe8e8e3, background: 0x4c5259 },
    lights: { ambientIntensity: 0.9, directionalIntensity: 0.8, directionalPosition: { x: 0, y: 7, z: 4 } },
  },
});
