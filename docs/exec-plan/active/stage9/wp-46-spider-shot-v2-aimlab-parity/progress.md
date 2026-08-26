# WP-46(暫用編號)— progress.md

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-26 規劃**:經使用者實機測試回報 + `systematic-debugging` 排查(排除 sim 邏輯 bug)+ `brainstorming` 對話(確認要對齊 Aim Lab Spidershot,含一輪 GD-7 修訂範圍的明確人為確認)產出本 WP 計畫。尚未執行任何 task。

## Decision Log

- **D-46.1**(2026-08-26,brainstorming 對話拍板):GD-7 的 on-target 幾何由「H1 hitbox(Box3)」擴充為「box|sphere,單一來源不變」。**Why**:使用者要求 spider-shot-v2 目標為真正球體碰撞判定(非視覺近似),而 GD-7(WP-23 第一次收斂)原文把幾何釘死在 Box3;維持單一來源原則(命中判定與視覺同一個 `TargetState.hitbox`)的前提下,把「哪一種幾何」參數化為 `shape` 是唯一不違反 GD-7 精神(零新門檻/同幾何)的擴充方式。**Alternatives considered**:只做視覺球體、判定仍用 box(內接或外接近似)——使用者在對話中明確否決,選擇了會動 GD-7 的真實作法。
- **D-46.2**(2026-08-26):`docs/exec-plan/DECISIONS.md` 本次不寫入正式 GD 編號。**Why**:`exec-plan/README.md` 顯示 GD-25 已被 stage8 提案暫用但未正式落帳,同時間佔用下一個號碼有衝突風險(先例:GD-15「先採納先得」)。**How to apply**:比照 WP-44/WP-45 T-exit 的處置——實質決策記在本檔 Decision Log,`CLAUDE.md §4` 直接更新措辭(比照 WP-23 前例:CLAUDE.md 更新早於正式 GD 編號),`DECISIONS.md` 的正式條目留給使用者一次性指派 stage9 全部編號時補上。
- **D-46.3**(2026-08-26):中心目標逾時處理選擇「不設個別逾時」而非「設一個較長的保險值」。**Why**:專案既有的 `timing.timeLimitMs`/`endCondition` 後援閘機制已經足以防止 drill 卡死,不需要為 spider-shot 中心目標另開一個新的計時概念——重用既有機制比新增參數更簡單、風險更低。
- **D-46.4**(2026-08-26):外圍目標存活時間選固定單一值(1750ms,1500–2000 中點),不做隨機範圍抽樣。**Why**:使用者傾向簡單、不新增隨機性;隨機範圍需要新的 schema 欄位與 RNG 消費點,複雜度不成比例。

## Surprises

- (無;規劃階段尚未執行程式碼變更。)

## Open Questions(狀態)

- OQ-46.1(`targets.count` 安全上限精確值):暫定 300,待 T5 前確認,不阻塞 T0–T4。
- OQ-46.2(正式 WP/GD 編號指派時機):延後,比照 stage9 OQ-S9-2,不阻塞本 WP 交付。
