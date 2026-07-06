# T1 — SceneConfig schema + validateScene + 佔位房間收編

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(資產選型 + margin 常數決議) |
| **Risk / Cplx** | Low / Med |
| **Touches** | ADD `src/scene/SceneConfig.ts`、`src/scene/scenes/placeholder-room.ts`;MODIFY `src/render/SceneManager.ts`(建構子收 SceneConfig,程序化房間改由 config 驅動)+ 對應測試 |
| **狀態** | ⬜ |

## Objective

場景成為**資料**(FR-C1):`SceneConfig` schema(sceneId/assetPackVersion/clutterTier/
asset/propBounds/playerCorridor)+ `validateScene` 執行期驗證;現行佔位房間收編為第一個
config(`sceneId: 'placeholder-room'`, `asset: null`)——單一路徑,之後 GLTF 場景與
fallback 都走同一條。

## In scope
- `SceneConfig` interface + `validateScene(json): SceneConfig`(比照 [drill/schema.ts](../../../../../src/drill/schema.ts)
  模式:field-path 錯誤訊息、`err`/`require*` helpers、成功回窄化 config)。
- 驗證涵蓋:`sceneId` 非空字串、`assetPackVersion` 非空、`clutterTier` 列舉、
  `propBounds` 每項 `min ≤ max` 逐軸、`playerCorridor.halfWidthU` 正有限數。
- `placeholder-room.ts`:現行房間尺寸/顏色/光照收進 config(`asset: null` = 程序化房間);
  `propBounds: []`(空房間無 prop)。
- `SceneManager` 建構子改收 `SceneConfig`(`asset: null` 分支 = 既有 `#buildRoom`/`#buildLights`
  邏輯,行為不變);`main.ts` 呼叫端最小改(傳入 placeholder config)。
- **架構閘測試**:斷言 `src/sim`/`src/state` 原始碼不含 `from '../scene`/`from './scene`
  import(GD-6:propBounds 永不進 sim;grep 型測試,比照 `Math.random` 禁令閘)。

## Out of scope
- GLTF 載入(T2)、淨空驗證幾何(T3)、場景切換 UI 與 meta(T4)。

## Steps

- [ ] `SceneConfig.ts` schema + `validateScene` + 單元測試(合法/非法各欄、field-path 訊息)。
- [ ] `placeholder-room.ts` config + `SceneManager` 改建構子;既有渲染測試全綠(行為不變)。
- [ ] 架構閘測試(sim 不 import scene)綠。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- `validateScene` 非法輸入拋 field-path 錯誤、合法回窄化 config(測試證明);
  佔位房間經 config 路徑渲染且既有測試零修改全綠;架構閘測試在(且故意加違規 import 會紅)。

## Commit

`feat(wp-19): T1 SceneConfig schema + validateScene + 佔位房間收編為 config`
