# T2 — 遠距小目標追蹤 drill(角參數反推;純資料)

> Part of [WP-23 longrange-tracking](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(hitbox 欄可用) |
| **Risk / Cplx** | Med / Low(純 config + 對帳;風險在幾何/尺度設計而非程式碼) |
| **Touches** | ADD `src/drill/tracking_longrange_v1.ts`;MODIFY `src/main.ts`(availableDrills)、必要時 `src/render/`(display scale 確認,不改 sim);測試 |
| **狀態** | ⬜ |

## Objective

`tracking_longrange_v1` 上線(FR-E2):距離/hitbox/motion 速度由 T0 定稿的
**角參數矩陣**(角高 × 角速度)反推;在 `field-low` 場景通過淨空驗證;
timed presentation 沿用 WP-18 交付形狀。

## In scope

- drill config:`targets.hitbox`(小目標檔)+ `distance`(反推值)+
  `motion`(`pingpong`/`sine`,速度 = 角速度 × 距離換算)+ timed presentation
  (沿 `tracking_v1` 的 2000ms 語意或 T0 修訂值)+ `sceneId: 'field-low'`
  (比照 `tracking_scene_v1` 組合方式)。
- config 內註記(comment)角參數推導:每檔位的角高/角速度/等效距離,
  供研究者稽核(pre-registered 對照)。
- 淨空驗證:遠距視線走廊 + 運動包絡通過 `validateClearance`
  (`field-low` propBounds);不過 → 調整 spawn 幾何或記 WP-26 br-field 需求(OQ-23.2)。
- display scale 確認:遠距下場景/目標渲染尺度合理(render-only;
  不動 sim 單位——CONTEXT「正規單位」紅線)。
- Controls dropdown 掛載 + config 驗證測試(合法值/角尺寸下限)。

## Out of scope

- 指標 round-trip 與決定性 fixture(T3);BR 場景(WP-26);ADS/彈道條件(WP-24/25)。

## Steps

- [ ] 角參數 → config 數值反推表落 config 註記(與 T0 決議一致)。
- [ ] `tracking_longrange_v1.ts` + schema 驗證測試。
- [ ] 淨空驗證通過證據(或調整記錄)記 progress。
- [ ] `main.ts` 掛載;手動 smoke(瀏覽器可載入、目標可見、可追蹤)記 progress。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- config 驗證綠 + 淨空綠;角參數推導註記完整(每檔位可稽核);
  瀏覽器 smoke 證據記 progress;sim/資料層 `git diff` 零改動(純 config + UI 掛載)。

## Commit

`feat(wp-23): T2 tracking_longrange_v1 遠距小目標 drill(角參數反推;field-low)`
