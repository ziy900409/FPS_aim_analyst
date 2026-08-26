import { validateScene, type SceneConfig } from '../SceneConfig.ts';
import peekAdCorridorProps from './peek-ad-corridor.props.json';

/**
 * peek-ad-corridor-v1 — WP-45 / T2（FR-P45-4）:left/right symmetric occlusion scene for the
 * peek-click-transfer-pilot self-motion exposure task. Unlike `peek-corridor` (target slides out
 * from behind a one-sided wall while the player stays still), here the two static targets never
 * move — the player's own A/D strafe crosses the center pillar's occlusion boundary and exposes
 * whichever side they peek toward, while `TargetManager`'s default L/R side positions (x=±2,
 * y=1.5, z=-distance) stay authoritative for target placement (WP-45 T2 does not add a second
 * target-position source).
 *
 * Asset: `public/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf` (procedural original CC0).
 */
export const peekAdCorridor: SceneConfig = validateScene({
  sceneId: 'peek-ad-corridor-v1',
  assetPackVersion: 'peek-ad-corridor-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf', displayScale: 1 },
  propBounds: peekAdCorridorProps.props.map((p) => ({ id: p.id, min: p.min, max: p.max })),
  playerCorridor: { halfWidthU: 2 },
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
