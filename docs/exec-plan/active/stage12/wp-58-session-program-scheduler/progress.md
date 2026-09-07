# WP-58 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-09-07**：依 brainstorming 對話收斂需求，並以 engineering-planning skill 完成 repository-grounded 規劃。盤點 `SessionRunner`／`sessionSchedule`／`sessionPlanPresets`／`SessionPlanSetup`／`RestOverlay`／`metadata` 與 `main.ts` 的 Session Plan 全鏈路；尚未修改 production code。
- **2026-09-07**：確認四個需求缺口——`resolveFamilyDrillId()` 把 family 硬編碼 1:1 對到單一 drill、`requireFamilyOrder()` 明文禁止重複、`restDurationMs` 為單一模組級變數、無任何 rep 概念。決定採「先編譯成 `ProgramStep[]`、Runner 退化成游標」的架構。
- **2026-09-07**：工作拆為 T0～T6 + T-exit。WP 編號一度暫用 WP-57／GD-32，但同日另一個平行 session 的 [WP-57 — Spider Shot Wide Flick](../wp-57-spider-shot-wide-flick/README.md) 先建立資料夾並認領同一組編號；依 GD-15「先採納先得」本計畫順延重編為 **WP-58**，全域決策待以 **GD-33** 入帳。WP-56（進行中的 micro-flick 場景 WP）不受影響。

## Decision Log

- **D-58-P1 / 次數語意**：「設定 drill 次數」= **reps（重複跑 N 輪）**，不是修改 drill 內的 `endCondition.value`。排程層永不寫 drill 參數，`protocolVersion 1.0.0` 與跨 session 可比性不受影響。
- **D-58-P2 / 資料模型**：plan 為**扁平**的 `(drillId, reps)` 有序清單；家族由 `drillId` 推導，不採兩層「家族包含多個 drill」結構。
- **D-58-P3 / drill 範圍**：`availableDrills` **全部開放**排程，每個 drill 在單一來源對照表中宣告家族；表外 drill 不可排程（不給 fallback 家族）。
- **D-58-P4 / 雙軌**：保留 frozen「標準 Assessment」一鍵路徑逐位不變；自由清單另走一條並標 `sessionPlanMode='custom'`，兩軌共用同一 runtime，差別只在誰產生 program。
- **D-58-P5 / 休息邊界**：兩個全域值。`rep↔rep` 與 `drill↔drill` 皆吃 `drillRestSeconds`；只有 `family↔family` 吃 `familyRestSeconds`。使用者情境的 60 秒因此要求 A／B／C **各屬不同家族**；同家族相鄰 drill 拿 30 秒是模型定義，由預覽表使其可見。
- **D-58-P6 / 架構**：採「編譯成扁平 step 清單 + Runner 游標化」。三種邊界、reps 展開、家族推導與「結尾不補休息」全部在編譯期以純函式決定，而非留給狀態機臨場前瞻判斷。
- **D-58-P7 / 熱身**：自訂路徑**取消** `includeWarmup`——熱身即清單第一項。frozen 路徑保留原行為。
- **D-58-P8 / 解耦**：家族歸屬**不授予** Assessment 資格。`micro_flick_three_target_test_v1.test.ts:228` 的負向測試意圖（practice-only drill 不進 Participant/Assessment session）以顯式解耦不變量延續，而非靠「不在 allowlist 裡」這個副作用。

## Surprises

- **2026-09-07**：`sessionPlanPresets.ts` 的 `perFamilyTrialShape` 原始碼註解明示「刻意引用 drill config 而非另存一份 trial 數」。本 WP 的 reps 語意與這條既有紀律天然相容——這不是巧合，而是同一個「排程層不得成為 drill 參數第二來源」原則的兩次體現。
- **2026-09-07**：`TrackingPilotRunner` + `trackingPilotManifest` 的 `orderedBlocks[] + restSeconds` 已經是「先算成陣列、runner 只跑陣列」的既有前例。本 WP 等於把同一模式套回主 Session Plan；未來兩者的型別有收斂機會（記為 handoff，不在本 WP 範圍）。
- **2026-09-07**：`main.ts` 的 drill 完成分支已是 pilot／warmup／family／protocol 四路 if-else。游標化把 warmup 併入 run 之後，這條鏈反而**變短**為三路——這是本重構的附帶收益，不是代價。

## Open Questions（狀態）

- **OQ-58.1**：同一 drill 連跑 N 輪的 seed 應逐輪相同或變化。建議**逐輪變化**（決定性純函式推導 + 每輪 seed 寫入 metadata）。⬜ 待 T0 exit 由使用者確認。
- **OQ-58.2**：三輪匯出的檔名唯一性。待 T0 讀 `exportBasename()` 實作後確認；若不足則於 basename 追加 rep 序號。⬜
- **OQ-58.3**：休息 overlay 是否顯示邊界種類與下一個 drill。建議**要**。⬜ 待 T4 前確認。
- **OQ-58.4**：`custom` session 是否可進 history。建議**可保存但隔離**於 frozen trend cohort 之外。⬜ 待 T0 exit 確認。
- **OQ-58.5**：stage12 是否需要獨立里程碑（下一個可用編號 **M22**；M20／M21 已由 stage11 WP-54／WP-55 取用）。⬜ 待 stage12 範圍收斂。
