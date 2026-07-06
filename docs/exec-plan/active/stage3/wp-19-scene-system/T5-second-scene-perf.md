# T5 — `urban-high` 第二場景 + 兩場景負載驗證

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T4(切換/meta 就緒) |
| **Risk / Cplx** | Med / Low(機制全就緒,本 task 是內容 + 驗證) |
| **Touches** | ADD `public/assets/scenes/urban-high/`、`src/scene/scenes/urban-high.ts`;MODIFY `ATTRIBUTIONS.md`;負載驗證證據 |
| **狀態** | ⬜ |

## Objective

雜亂度階層成立(FR-C5):`urban-high`(高雜亂城鎮)上線,與 `field-low` 構成
GD-9 的實驗對照軸;兩場景負載驗證證明感知實驗的顯示鏈在預算內。

## In scope
- `urban-high` 資產(同 T0 選型的授權紀律)+ SceneConfig(`clutterTier: 'high'`、
  propBounds 完整量測——prop 多,預期數十個 AABB)+ ATTRIBUTIONS 增補。
- 淨空驗證實戰:`urban-high` × 現行 drill 首跑**預期會撞 prop**(高雜亂),
  修 config(spawn 區/走廊調整)到淨空——這個修正過程記 progress,是 validator
  可用性的實證。
- 負載驗證:兩場景各實跑 drill,`ticks` 無掉 tick;render frame 時間分佈
  (WP-20 T3 未到位前用 dev 手段:performance mark 或既有 HUD stats)記 progress,
  與 T2 基準對照。
- 資產預算註記:兩場景三角形/draw calls/貼圖記憶體記入各 SceneConfig 註解,
  供未來場景擴充參照。

## Out of scope
- frame log 正式機制(WP-20 T3)、更多場景(觸發:實驗設計需要 mid 階層)。

## Definition of Done

- 兩場景可切換、drill 可跑、無掉 tick;`urban-high` 淨空修正過程有記錄;
  ATTRIBUTIONS 完整;負載數據(兩場景對照)記 progress。

## Steps

- [ ] 資產落地 + SceneConfig + ATTRIBUTIONS 增補。
- [ ] 淨空驗證首跑 → 修 config → 通過;過程記 progress。
- [ ] 兩場景負載實測記 progress。
- [ ] `npx vitest run` 全綠。

## Commit

`feat(wp-19): T5 urban-high 高雜亂場景 + 兩場景負載驗證(雜亂度階層成立)`
