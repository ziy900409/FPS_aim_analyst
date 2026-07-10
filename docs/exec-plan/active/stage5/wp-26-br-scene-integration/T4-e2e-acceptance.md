# T4 — 整合 E2E + 三條決定性不變性 + 驗收清單 E

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3(整合 drill 存在) |
| **Risk / Cplx** | Med / Med(整合紅燈的分層歸因成本) |
| **Touches** | ADD `tests/e2e/`(BR 跟槍全鏈路)、`tests/regression/`(三不變性收編)、`docs/operational/acceptance-stage-e.md`(驗收清單 E);必要時 harness 擴充(`src/testharness/`,測試設施非引擎) |
| **狀態** | ⬜ |

## Objective

stage5 交付的驗收面(FR-E13):BR 跟槍測試端到端成立——drill 執行 → 匯出
(ads/hit/追蹤欄齊)→ 離線推導(跟槍效率指標可算)→ 三條決定性不變性全綠 →
驗收清單 E 定稿並逐項通過。

## In scope

- **E2E 全鏈路**(Playwright,沿 full-drill 模式):`tracking_br_v1` 一條件完整一輪 →
  匯出斷言:`meta.scene`(br-field)/`meta.weapon`(ads+bullet 快照)/`meta.protocol`
  條件標記/tick `ads` flag/`hit` 事件/逐 tick 目標玩家位置欄全齊;
  離線推導(`trackingDerivation` + lead spec 範例)在該匯出上可算出
  TOT%/RMS(ε)/t_acquire(smoke 級數值 sanity)。
- **三條決定性不變性**(分項 fixture 先行,整合歸因用):
  1. 跨場景:br-field vs 佔位房間,同輸入 sim 狀態逐位(T2 已建,此處收編確認);
  2. ADS 顯示不變性:同輸入(含 ads 事件)下 overlay/FOV 開關(render 顯示設定)
     不改 sim 序列;
  3. 彈道 gate:hitscan 武器檔於 br-field 與既有 baseline 逐位;projectile fixture
     跨 FPS 逐位(WP-25 已建,收編確認)。
- **驗收清單 E**(`acceptance-stage-e.md`,比照清單 C 十項式):自動項(上述 E2E/
  決定性/淨空/授權 lint)+ 手動項(開鏡追蹤手感/tracer 視覺/br-field 視覺尺度,
  研究者實機回填);逐項證據連結。
- pilot 就緒文件:BR 跟槍 pilot protocol 草案(條件序列/施測步驟/資格閘沿用)
  隨清單 E 附錄。

## Out of scope

- 新功能/新指標;紅燈修理若涉跨 WP 語意 → 記 DECISIONS 或開 KI。

## Steps

- [ ] E2E 全鏈路 + 匯出欄位斷言 + 離線推導 smoke。
- [ ] 三不變性分項 + 收編(`tests/regression/`)。
- [ ] `acceptance-stage-e.md` 定稿(逐項證據連結;手動項標回填)。
- [ ] pilot protocol 草案附錄。
- [ ] `npm run test:ci` exit 0。

## Definition of Done

- E2E 綠(欄位全齊 + 推導可算);三不變性全綠;清單 E 自動項全過、手動項
  已標回填流程;`test:ci` exit 0。

## Commit

`test(wp-26): T4 BR 跟槍整合 E2E + 三條決定性不變性 + 驗收清單 E`
