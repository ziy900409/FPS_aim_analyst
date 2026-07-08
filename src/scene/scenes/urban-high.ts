import { validateScene, type SceneConfig } from '../SceneConfig.ts';
import urbanHighProps from './urban-high.props.json';

/**
 * urban-high — WP-19 / T5:第二個 GLTF 場景,高雜亂度城市街廓。
 *
 * 資產:`public/assets/scenes/urban-high/urban-high.gltf`(原創幾何,CC0——見 root ATTRIBUTIONS.md)。
 * `propBounds` 由 `urban-high.props.json` 提供,該檔由生成器與 GLTF 同步產出,避免視覺與淨空資料漂移。
 *
 * 資產預算(2026-07-08 生成器量測):63 propBounds,67 mesh nodes(含 4 個視覺-only 地面/道路),
 * 804 triangles,9 materials,0 textures。保留 <20k triangles / <80 draw calls 的 T5 預算餘裕。
 */
export const urbanHigh: SceneConfig = validateScene({
  sceneId: 'urban-high',
  assetPackVersion: 'urban-high-v1',
  clutterTier: 'high',
  asset: { url: '/assets/scenes/urban-high/urban-high.gltf', displayScale: 1 },
  propBounds: urbanHighProps.props.map((p) => ({ id: p.id, min: p.min, max: p.max })),
  playerCorridor: { halfWidthU: 1 },
  proceduralRoom: {
    roomSize: [10, 10, 4],
    eyeHeight: 1.6,
    fovDeg: 75,
    colors: {
      floor: 0x2f3438,
      wall: 0x4a4f55,
      background: 0x6f8796,
    },
    lights: {
      ambientIntensity: 0.7,
      directionalIntensity: 1.25,
      directionalPosition: { x: -3.5, y: 7, z: 3.5 },
    },
  },
});
