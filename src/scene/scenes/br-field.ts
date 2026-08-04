import { validateScene, type SceneConfig } from '../SceneConfig.ts';
import brFieldProps from './br-field.props.json';

/**
 * br-field — WP-26 / T2: original open BR-style field scene.
 *
 * Asset: `public/assets/scenes/br-field/br-field.gltf` (procedural original CC0; see ATTRIBUTIONS.md).
 * `propBounds` and GLTF are generated from `scripts/gen-br-field-gltf.mjs`, keeping visual props and
 * clearance data in sync. The central front-facing hard corridor is intentionally clear:
 * x in [-21, 21], z in [-145, 0].
 */
export const brField: SceneConfig = validateScene({
  sceneId: 'br-field',
  assetPackVersion: 'br-field-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/br-field/br-field.gltf', displayScale: 1 },
  propBounds: brFieldProps.props.map((p) => ({ id: p.id, min: p.min, max: p.max })),
  playerCorridor: { halfWidthU: brFieldProps.corridorClearance.hardClearWidthU / 2 },
  proceduralRoom: {
    roomSize: [42, 290, 8],
    eyeHeight: 1.6,
    fovDeg: 75,
    // KI-002 / D1:前向 radial-spawn 目標以 sim origin (z=0) 為圓心、置於 z=−distance;
    // 眼睛(射線/彈道原點)必須在 z=0,否則交戰距離被 depth/2−standoff(=144u)放大,
    // 角尺寸/角速度失真、projectile 打不到目標。GLTF 場景不建牆,roomSize 僅驅動 camera z。
    eyeZ: 0,
    colors: {
      floor: 0x5c6b38,
      wall: 0x7c8fa0,
      background: 0x9ec4e6,
    },
    lights: {
      ambientIntensity: 0.8,
      directionalIntensity: 1.35,
      directionalPosition: { x: 8, y: 10, z: 6 },
    },
  },
});
