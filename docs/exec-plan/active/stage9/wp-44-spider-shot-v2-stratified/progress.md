# WP-44(暫用編號)— progress.md

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-26 T0+T1**:覆核 brainstorming 對話中的 §0 讀碼假設仍成立(v1 凍結值未變、`sampleSpiderShotPose()` 形狀未變、`main.ts` sceneId 修法未變、`spiderShotConditions.ts`/`spiderShotMetrics.ts` 未讀 `DrillConfig.spiderShot`)。`DrillConfig.SpiderShotScheduleConfig` 改為 union(`center-peripheral` / `center-peripheral-stratified`),`schema.ts` 新分支驗證(含 `grid` 正整數 + 拒絕退化 radius range)。既有 39 個 `schema.test.ts` 案例零改動全綠,新增 2 個測試案例全綠,`npx tsc --noEmit` 全專案型別檢查綠。

## Decision Log

- **D-44.1**(2026-08-26,brainstorming 對話拍板):新增 `spider-shot-v2` 而非改寫 `spider-shot-v1`。**Why**:WP-39 已把 v1 的 `angularRadiusDegRange=[15,15]`/`centerDistanceU=8`/`distanceURange=[8,8]` 列為正式凍結校準值(`STAGE6_PROTOCOL_VERSION = '1.0.0'`),直接改會打破「除凍結欄位外逐位不變」的既有回歸契約與既有 pilot/acceptance 資料的可比性。**Alternatives considered**:直接改 v1(使用者選項之一,但需同步處理 `DECISIONS.md` 凍結記錄與 `protocolVersion`,取捨成本高於開新檔)。
- **D-44.2**(2026-08-26):保留 center↔peripheral 交替機制,只換「周邊目標」的取樣策略。**Why**:移除 center-return 會讓現有以 zone 交替為前提的 `deriveSpiderShotTransitions()`/`requireDirection()` 不變式(連續兩個 peripheral 事件會 throw)與五類指標(`switchReaction`/`movementExecution` 等只對 `zone: peripheral` 輸出)全部失效,需要重新設計指標語意——超出「先讓周邊目標排程更均衡」這個當前目標的範圍。**How to apply**:之後若真的要做「純周邊格連續鏈」的變體,需另開提案處理指標語意,不能沿用本 WP 的骨架。
- **D-44.3**(2026-08-26):距離 tier 對應到 `angularRadiusDeg`(離中心視線的角距)分三層,`distanceURange` 維持固定值。**Why**:HTML 原版的「距離 tier」是螢幕投影半徑(視覺偏移量),在本專案真 3D 球面模型裡,`angularRadiusDeg` 是最直接的類比;`distanceURange`(世界深度)是不同維度,對視覺難度影響較小。
- **D-44.4**(2026-08-26):距離 tier 用**等立體角**(`cos(θ)` 線性內插)分層,而非 HTML 原版的平面 `sqrt(area)`。**Why**:本專案是真 3D 球面模型,`sqrt(area)` 是 HTML 螢幕投影(2D 平面)的近似公式,套用到球面座標系不是「等面積」——`cos` 分層才是球面 cap 面積(`∝ 1-cosθ`)的正確等分公式。**How to apply**:`buildSpiderZoneCells()`(T2)固定用此公式,不引入第二套「等面積」定義。
- **D-44.5**(2026-08-26):排程用的「4 象限」分箱(`0/90/180/270` 起算)是全新概念,刻意不重用/不對齊既有 `spiderShotConditions.ts` 的 `SpiderQuadrant`(`horizontal`/`vertical`/`oblique`,45°-居中 8 分箱收斂 3 類)。**Why**:兩者用途不同——排程分箱只為了 spawn 平衡,呈現層標籤只為了報告分類;硬要對齊反而會讓其中一套失去原本的設計意圖。**How to apply**:文件(README/`analysis-spider-shot.md`)需明確點名兩套分類不是同一件事,避免未來讀者混淆。

## Surprises

- (無;T1 範圍內沒有超出 brainstorming 對話讀碼結論的新發現。)

## Open Questions(狀態)

- OQ-S9-1(`angularRadiusDegRange` 候選值 `[10,25]` 是否需要調整):待 T3 交付可跑之後,由使用者實測手感決定,不阻塞本 WP 交付。
- OQ-S9-2(WP/GD 編號正式指派時機):待 T-exit 或之後由使用者決定,不阻塞本 WP 交付。
- OQ-S9-3(v2 是否需要走真人 pilot 才能凍結):暫不需要,留待之後另開提案。
