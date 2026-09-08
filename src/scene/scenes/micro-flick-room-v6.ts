import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/** v5's reference-calibrated corridor with end-wall width and height reduced by 15%. */
export const microFlickRoomV6: SceneConfig = validateScene({
  sceneId: 'micro-flick-room-v6', assetPackVersion: 'micro-flick-room-v6', clutterTier: 'low',
  asset: { url: '/assets/scenes/micro-flick-room-v6/micro-flick-room-v6.gltf', displayScale: 1 }, propBounds: [], playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [10.965, 60, 10.2], eyeZ: 0, floorY: -3.1, eyeHeight: 1.6, fovDeg: 75,
    colors: { floor: 0xd1d1cc, wall: 0xe8e8e3, background: 0x4c5259 },
    lights: { ambientIntensity: 0.9, directionalIntensity: 0.8, directionalPosition: { x: 0, y: 7, z: 4 } },
  },
});
