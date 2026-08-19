import { validateScene, type SceneConfig } from '../SceneConfig.ts';
import peekCorridorProps from './peek-corridor.props.json';

/**
 * peek-corridor — WP-34 / T2:small original occlusion scene for hold-click emergence.
 *
 * Asset: `public/assets/scenes/peek-corridor/peek-corridor.gltf` (procedural original CC0).
 * The scene keeps clutterTier low and carries occlusion semantics through its sceneId plus
 * occlusion-aware clearance options, avoiding a new global clutter taxonomy.
 */
export const peekCorridor: SceneConfig = validateScene({
  sceneId: 'peek-corridor',
  assetPackVersion: 'peek-corridor-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/peek-corridor/peek-corridor.gltf', displayScale: 1 },
  propBounds: peekCorridorProps.props.map((p) => ({ id: p.id, min: p.min, max: p.max })),
  playerCorridor: { halfWidthU: 1 },
  proceduralRoom: {
    roomSize: [12, 14, 4],
    eyeHeight: 1.6,
    fovDeg: 75,
    eyeZ: 0,
    colors: {
      floor: 0x383d42,
      wall: 0x59616a,
      background: 0x7c98ad,
    },
    lights: {
      ambientIntensity: 0.72,
      directionalIntensity: 1.25,
      directionalPosition: { x: 3, y: 6, z: 4 },
    },
  },
});
