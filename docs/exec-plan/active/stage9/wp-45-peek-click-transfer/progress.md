# WP-45 — progress / decision log

## Status

- **Current**:計畫完成，待 T0 entry gate。
- **Scope state**:`peek-click-transfer-pilot-v1` 為 Practice/pilot-only；正式 Assessment freeze 不在本 WP。
- **Dependency state**:T3 等 WP-44 T-exit；T5 等 stage8 WP-43 T-exit。

## Progress

### 2026-08-26 — Planning

- 由 Kovaak's `Peek and Click` 影片分析收斂為 self-motion exposure transfer test。
- 依 `engineering-planning` quality gate 建立 requirements、interfaces、failure modes、risk、task files 與可驗證 DoD。
- 依 repeated-measures 原則，明確定義 participant 為 independent replicate、peeks 為 nested trials。
- 未修改 production code；未執行 T0 baseline。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| **D-45.1** | 新任務定位為 integrated transfer test，不取代 hold-click/counterstrafe component assessments | 混合構念適合驗證技能轉移，不適合單一診斷分數 | Proposed，T0 覆核 |
| **D-45.2** | 先修共用 occlusion kernel，再允許 scene-aware hit | 現況 target-only raycast 可穿牆；不修即無有效 peek task | Proposed，T1 |
| **D-45.3** | 新建 `peek-ad-corridor-v1`，不改 frozen `peek-corridor` | 避免改變 stage6 hold-click geometry/history compatibility | Proposed，T2 |
| **D-45.4** | pilot 保留 box target、AK-47、嚴格 LR、miss 補槍 | 最小化新引擎分支並對齊影片循環；正式值留給 pilot | Proposed，T3 |
| **D-45.5** | 不建立 composite score | 沿用 stage6「不同構念分層報告」紀律 | Proposed，T4 |
| **D-45.6** | Session 採 versioned roster，不改 stage6 default family list | 防止既有 participant order 全數漂移 | Proposed，T5 |

## Surprises / blockers

- None at planning time。
- 若 T0 發現 WP-44/WP-43 尚在修改同一熱區，依 README dependency gate 延後 T3/T5，不繞過。

## Verification log

| Date | Command | Result |
|---|---|---|
| — | T0 baseline pending | — |
