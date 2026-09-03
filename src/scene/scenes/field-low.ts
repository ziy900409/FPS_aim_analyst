import { validateScene, type SceneConfig } from '../SceneConfig.ts';
import fieldLowProps from './field-low.props.json';

/**
 * field-low — WP-19 / T2:首個 GLTF 寫實(低雜亂度)場景。
 *
 * 資產:`public/assets/scenes/field-low/field-low.gltf`(原創幾何,CC0——見 root ATTRIBUTIONS.md)。
 * `propBounds` 與 GLTF 幾何**同一來源**(`field-low.props.json`),故淨空驗證資料與視覺不漂移。
 * 座標 = canonical CS unit(u),`displayScale: 1`(與 target 渲染同 1:1 世界座標)。
 *
 * `proceduralRoom` 在此僅描述**舞台**(camera 眼高/FOV/standoff + 光 + 天空背景色);
 * `asset !== null` 時 SceneManager **不建牆/地板**(戶外地形由 GLTF/後續 ground plane 提供)。
 */
export const fieldLow: SceneConfig = validateScene({
  sceneId: 'field-low',
  assetPackVersion: 'field-low-v1',
  clutterTier: 'low',
  asset: { url: '/assets/scenes/field-low/field-low.gltf', displayScale: 1 },
  propBounds: fieldLowProps.props.map((p) => ({ id: p.id, min: p.min, max: p.max })),
  playerCorridor: { halfWidthU: 1 },
  proceduralRoom: {
    roomSize: [10, 10, 4],
    eyeHeight: 1.6,
    /**
     * KI-024 / BD-024:**必須錨定在 sim origin**。`SceneConfig.eyeZ` 的契約寫明「前向目標
     * (`z = −distance`)的 radial-spawn drill 需 `eyeZ: 0`,使實際交戰距離 == config distance」;
     * 省略時的 fallback 是 `roomSize[1]/2 − CAMERA_STANDOFF = 4`,而前向目標在 `z = −4`
     * ⇒ 交戰距離 8 u = config 的兩倍 ⇒ **角尺寸/角行程/角速度全部只交付一半**。
     *
     * 實測(WP-54 tracking pilot 9 個 block,P04 匯出):交付/宣稱 0.499–0.508。宣稱 0.5°/2.0°
     * 的目標實為 0.25°/1.0°(≈4.2 CSS px,故操作員回報「看不見」),宣稱 5/20 deg/s 實為 2.5/10。
     *
     * 這是 [KI-002](../../../docs/known_issue/KI-002-br-field-camera-anchor-protocol-load.md) D1
     * 在本場景的復發:`br-field`、`peek-corridor`、`peek-ad-corridor` 當年都設了 `eyeZ: 0`,
     * field-low 是唯一被前向 drill 使用卻漏掉的場景。
     */
    eyeZ: 0,
    fovDeg: 75,
    colors: {
      // 戶外舞台:floor/wall 在 GLTF 場景不建幾何,僅 background 供天空色。
      floor: 0x5a5148,
      wall: 0x6d7a86,
      background: 0x8fb8de,
    },
    lights: {
      ambientIntensity: 0.75,
      directionalIntensity: 1.4,
      directionalPosition: { x: 4, y: 6, z: 3 },
    },
  },
});
