# T1 — 追蹤 drill × BR 場景整合 + E2E

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(WP-18 形狀對帳完成) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `src/drill/tracking_scene_v1.ts`(組合 config)、E2E 一條;MODIFY(僅必要時)場景/drill 掛線膠合 + 測試 |
| **狀態** | ⬜ |

## Objective

GD-7 的實驗實體成形(FR-C13):WP-18 追蹤 drill 在 `field-low` BR 場景中執行,
淨空驗證涵蓋整段運動包絡,匯出含追蹤指標所需全部原始欄——「追蹤能力評估」
從決議變成可施測的 drill。

## In scope
- `tracking_scene_v1` config:WP-18 追蹤 drill 型(T0 對帳後的實際形狀)+
  `sceneId: 'field-low'`;motion 範圍與場景走廊以淨空驗證通過為準(首跑撞 prop
  就修 config,比照 WP-19 T5 流程)。
- **淨空驗證實戰(移動包絡)**:WP-19 T3 的 motion 極值推導在真實移動 drill 上
  首次消費——驗證通過證據 + (若有)包絡推導缺口記雙方 progress。
- E2E(Playwright,`__fpsTest` 合成輸入):跑完追蹤 drill → 匯出斷言——逐 tick
  目標/玩家位置欄非常數(目標真的在動)、aim 欄在、`t_visible` 每 presentation 一次、
  `suspect` 未升、meta.scene = field-low。
- 結果頁抽查:WP-18 交付的 TOT%/RMS ε/t_acquire 在場景版 drill 下數值 sanity
  (合成完美追蹤輸入 → TOT% ≈ 100%;合成不動輸入 → 獲取失敗)記 progress。
- `urban-high` 版本跑一輪(手動)確認高雜亂場景下無掉 tick(WP-19 T5 負載結論
  在移動目標 + 場景並存下複驗)。

## Out of scope
- 追蹤指標定義/計算(WP-18 交付;本 task 只消費)、解析度條件(T2)、
  速度/雜亂度階層的實驗矩陣設計(pilot protocol,T3 文件)。

## Steps

- [ ] `tracking_scene_v1` config + 淨空驗證通過(修正過程記 progress)。
- [ ] E2E 一條全綠(匯出斷言全項)。
- [ ] 結果頁 sanity 兩極端 case 記 progress。
- [ ] `urban-high` 複驗記 progress。
- [ ] `npx vitest run` + E2E 全綠。

## Definition of Done

- 追蹤 drill 於兩場景實機可跑、無掉 tick、無 suspect;E2E 斷言全綠;
  合成極端 case 的指標數值符合預期(證據記 progress)。

## Commit

`feat(wp-22): T1 追蹤 drill × BR 場景整合(淨空實戰 + E2E + 指標 sanity)`
