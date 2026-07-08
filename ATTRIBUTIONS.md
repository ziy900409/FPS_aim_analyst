# ATTRIBUTIONS — 場景資產授權稽核

> 資產授權白名單(**GD-9**,CLAUDE.md §4):repo 內可 commit 的場景資產僅限 **CC0** 或 **CC-BY**,
> 且每項須在此逐項可稽核。CC-BY-NC、遊戲抽取資產、付費包原始檔**禁止**進 repo。
> 每項欄位:資產名 / 作者 / 來源 URL / 授權 / 取得日 / 檔案路徑。

---

## field-low(WP-19 / T2)

| 欄位 | 值 |
|---|---|
| 資產名 | `field-low.gltf`(低雜亂度戶外場景,16 個 box props + 1 塊視覺地面) |
| 作者 | FPS_aim_analyst 專案(**原創**) |
| 來源 | 本 repo `scripts/gen-field-low-gltf.mjs` 程序化生成;prop 佈局來源 `src/scene/scenes/field-low.props.json` |
| 授權 | **CC0 1.0**(公眾領域捐獻;原創幾何 + 原創程式碼,無第三方素材) |
| 取得日 | 2026-07-07 |
| 檔案路徑 | `public/assets/scenes/field-low/field-low.gltf` |

**說明**:field-low 幾何為原創低多邊形 box props(每 prop 一顆立方體,材質色 foliage/rock/crate)
加一塊扁平視覺地面(`ground`,render-only、不入淨空 `propBounds`),非取自任何第三方資產包,
故授權為 CC0、無 attribution 義務、無 share-alike 傳染。
此為 T2 的功能性場景;後續若以更寫實的第三方 CC0/CC-BY 資產(如 T0/OQ-S3-3 選定的 Kenney Nature Kit)
置換,須在此新增對應逐項紀錄並保留/更新授權欄位。

### 重生方式

```
node scripts/gen-field-low-gltf.mjs
```

讀 `src/scene/scenes/field-low.props.json`(權威 prop 清單,同時供 SceneConfig `propBounds`),
輸出 `public/assets/scenes/field-low/field-low.gltf`。座標為 canonical CS unit(u),`displayScale: 1`。

---

## urban-high(WP-19 / T5)

| 欄位 | 值 |
|---|---|
| 資產名 | `urban-high.gltf`(高雜亂度城市街廓,63 個 box props + 4 個視覺-only 地面/道路節點) |
| 作者 | FPS_aim_analyst 專案(**原創**) |
| 來源 | 本 repo `scripts/gen-urban-high-gltf.mjs` 程序化生成;prop 佈局同步輸出 `src/scene/scenes/urban-high.props.json` |
| 授權 | **CC0 1.0**(公眾領域捐獻;原創幾何 + 原創程式碼,無第三方素材) |
| 取得日 | 2026-07-08 |
| 檔案路徑 | `public/assets/scenes/urban-high/urban-high.gltf` |

**說明**:urban-high 幾何為原創低多邊形 box props(建物、箱體、桶、路燈、路障、招牌)
加扁平視覺道路/人行道/地面(render-only、不入淨空 `propBounds`),非取自任何第三方資產包。
場景 layout 為中性城市街廓,不復刻任何特定遊戲地圖。

### 重生方式

```
node scripts/gen-urban-high-gltf.mjs
```

同步輸出 `src/scene/scenes/urban-high.props.json` 與
`public/assets/scenes/urban-high/urban-high.gltf`。座標為 canonical CS unit(u),`displayScale: 1`。
