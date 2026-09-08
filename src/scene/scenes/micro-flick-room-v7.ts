import { validateScene, type SceneConfig } from '../SceneConfig.ts';
export const microFlickRoomV7: SceneConfig = validateScene({
  sceneId: 'micro-flick-room-v7', assetPackVersion: 'micro-flick-room-v7', clutterTier: 'low', asset: { url: '/assets/scenes/micro-flick-room-v7/micro-flick-room-v7.gltf', displayScale: 1 }, propBounds: [], playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: { roomSize: [8.772, 60, 8.16], eyeZ: 0, floorY: -2.08, eyeHeight: 1.6, fovDeg: 75, colors: { floor: 0xd1d1cc, wall: 0xe8e8e3, background: 0x4c5259 }, lights: { ambientIntensity: 0.9, directionalIntensity: 0.8, directionalPosition: { x: 0, y: 7, z: 4 } } },
});
