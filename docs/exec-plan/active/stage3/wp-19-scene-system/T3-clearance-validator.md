# T3 — 淨空驗證器(視線走廊 × propBounds)+ DrillLoader 拒載

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(SceneConfig/propBounds 型別);與 T2 無相依(可並行) |
| **Risk / Cplx** | **High** / High(幾何正確性 = GD-6 效度保證的全部) |
| **Touches** | ADD `src/scene/clearance.ts` + 測試;MODIFY `src/drill/DrillLoader.ts`(載入時驗證、違規拒載) |
| **狀態** | ⬜ |

## Objective

GD-6 的核心機械(FR-C3):`validateClearance(scene, drill)` 以保守過近似驗證
「視線走廊與所有 prop 不相交」,drill 載入時執行、**相交即拒載**且錯誤指名 prop id
——視覺=物理一致性從人工紀律變成自動化 gate。

## In scope
- 幾何([../README.md §2.4](../README.md)):
  - 目標包絡 AABB:由 `DrillConfig.targets`(distance/side offset/hitbox)+ `motion?`
    (type/axis/range 解析式極值)推得;無 motion = 靜態點位集。
  - 玩家走廊取樣:`playerCorridor.halfWidthU` 線段(eye height)端點 + 中點。
  - 線段集 = 玩家取樣點 × 目標包絡採樣點(AABB 8 角 + 中心)。
  - propBounds **膨脹** hitbox 半徑 + `CLEARANCE_MARGIN_U`(T0 決議值,設定常數)。
  - 逐段 slab test(segment vs AABB,零相依純數學)。
- 回傳 `ClearanceViolation[]`(propId + 違規線段描述);空 = 淨空。
- `DrillLoader` 掛線:載入時跑驗證,非空 → throw(訊息含全部違規項,可修 config)。
- **對抗性測試**(DoD 核心):恰好相交(prop 貼走廊邊緣 + ε)/ 恰好不相交(邊緣 − ε)
  / prop 在玩家背後(不誤擋)/ 移動目標包絡極值處相交(只有 motion 極值才碰到)四組 fixture。
- 純函式(不碰 DOM/three scene graph;輸入只有兩個 config)——與 sim 同級的可測性。

## Out of scope
- runtime 玩家逸出走廊的 `suspect` 標記(T4,需 meta 掛線)、宣告式 occluder(GD-6 路徑 C)。

## Steps

- [ ] 目標包絡推導(靜態 + 各 motion type 極值)單元測試。
- [ ] slab test + 膨脹 + 線段集組裝;對抗性四組 fixture 全綠。
- [ ] `DrillLoader` 拒載掛線 + 錯誤訊息測試(指名 prop id)。
- [ ] `field-low` × 既有 counter-strafe drill 實跑驗證通過(淨空)記 progress。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 對抗性 fixture 四組全綠(恰相交紅、恰不相交綠、背後 prop 綠、motion 極值紅);
  違規錯誤訊息含 prop id;`field-low` × 現行 drill 驗證通過;validator 為純函式(測試零 mock)。

## Commit

`feat(wp-19): T3 淨空驗證器(視線走廊 slab test)+ DrillLoader 違規拒載`
