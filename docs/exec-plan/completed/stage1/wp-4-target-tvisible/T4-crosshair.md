# T4 — Crosshair（螢幕中心準心）

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/ui/Crosshair.ts`；MODIFY `src/main.ts` |
| **Status** | ✅ DONE（2026-07-02）|

## Objective
螢幕正中央渲染準心（DOM overlay，D1），作為瞄準參考與 §5「準心對齊偏移」量測的視覺基準（FR-4.4）。

## In scope
- `Crosshair`：置中的小十字/點（DOM overlay 或 2D canvas）。
- 準心螢幕座標 = canvas 中心；供 WP-8 量測準心對齊時參照（FPS 開火即螢幕中心射線）。

## Out of scope
- 準心對齊偏移計算（→ WP-8）；命中射線（→ WP-5，從 camera 中心）。

## Design notes
- 第一人稱開火走 camera 中心射線（WP-5），故準心固定螢幕中心即代表射線方向。
- 純 CSS overlay 最簡；`pointer-events:none` 不擋輸入。

## Steps
- [x] 建 `Crosshair.ts`：置中 overlay。
- [x] 串入 `main.ts`，恆顯示（含鎖定中）。
- [ ] 手動驗：準心在畫面正中、不隨視窗縮放偏移、不擋滑鼠。（→ 併入 T5 exit-gate 瀏覽器驗）
- [x] `tsc` 乾淨。

## Definition of Done
- [x] 螢幕中心準心可見、縮放不偏移、不擋輸入。（縮放不偏移：`left/top:50%+translate(-50%,-50%)` 定位保證；端到端瀏覽器 spot-check 併 T5）

## Commit
`feat(wp-4): 螢幕中心 crosshair overlay（FR-4.4）`
