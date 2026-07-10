# T2 — GLTF 管線 + `field-low` 首個寫實場景 + ATTRIBUTIONS

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(SceneConfig 路徑就緒)+ T0 資產選型(OQ-S3-3) |
| **Risk / Cplx** | **High** / Med(效能與資產品質是 stage3 頭號風險) |
| **Touches** | ADD `src/render/sceneLoader.ts`、`public/assets/scenes/field-low/`、`ATTRIBUTIONS.md`(root);MODIFY `src/render/SceneManager.ts`(GLTF 分支)、`src/main.ts`(async 載入時序)+ 測試 |
| **狀態** | ⬜ |

## Objective

GLTF 場景進得來、出得去、垮不掉(FR-C2):async 載入管線(bootstrap 既有 async 相容)、
載入失敗 fallback 佔位房間、`dispose()` 完整釋放;`field-low` 寫實場景上線,授權
逐項可稽核。

## In scope
- `sceneLoader.ts`:`loadScene(config): Promise<THREE.Group>`(`GLTFLoader`,
  `three/addons`);失敗 → 回傳 null + 呼叫端 fallback placeholder(**同一 config 路徑**,
  T1 已鋪)+ 記憶 fallback 事實(T4 進 meta.scene 註記)。
- `SceneManager` GLTF 分支:`asset.url` 有值 → 掛載 group(套 `displayScale`);
  `disposeScene()` 釋放 geometry/material/texture(場景切換前呼叫,防洩漏)。
- `field-low` 資產落地:T0 選定包;**授權紀律(GD-9)**——只入 CC0/CC-BY 檔;
  `ATTRIBUTIONS.md` 逐項:資產名/作者/來源 URL/授權/取得日。
- `field-low.ts`(或 `.json`)SceneConfig:`clutterTier: 'low'`、`propBounds` 手動
  量測填寫(prop 少,個位數 AABB)、`assetPackVersion` 初版。
- 負載基準:載入後 idle + 既有 counter-strafe drill 實跑,`ticks` 監控無掉 tick;
  三角形/draw call 數記 progress(T5 對照基準)。

## Out of scope
- 淨空驗證(T3;本 task 的 propBounds 只是資料,尚未消費)、第二場景(T5)。

## Steps

- [ ] `sceneLoader` + dispose + 失敗 fallback 單元測試(mock loader)。
- [ ] 資產下載/裁剪/放置 `public/assets/scenes/field-low/`;`ATTRIBUTIONS.md` 逐項寫齊。
- [ ] `field-low` SceneConfig(propBounds 量測值)+ `validateScene` 綠。
- [ ] 實機:場景可見、drill 可跑、無掉 tick;draw calls/三角形數記 progress。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- `field-low` 實機渲染 + 既有 drill 全程無掉 tick(證據記 progress);載入失敗路徑
  實測 fallback 成功(斷網/壞 URL 手動驗證);`ATTRIBUTIONS.md` 與資產目錄一一對應;
  repo 內無任何非 CC0/CC-BY 檔案。

## Commit

`feat(wp-19): T2 GLTF 場景管線 + field-low 寫實場景(CC0/CC-BY + ATTRIBUTIONS)`
