# WP-58 T0 — Entry Gate／排程層現況稽核／決策凍結

## Objective

在不寫 production feature 前，量測排程層真實 blast radius、凍結 drill→family 歸屬表、收斂 OQ-58.1／2／4，並把跨 WP 決策寫入 DECISIONS.md（GD-33）。T0 未通過不得開始 T1～T6。

## Inputs to read

- [README.md](README.md) §0～3、`CLAUDE.md` §3／§4、[DECISIONS.md](../../../DECISIONS.md)（GD-15 編號紀律、GD-24／GD-26 Session Plan 沿革、GD-20 教練報告紅線）。
- `src/session/`（`SessionRunner.ts`、`sessionSchedule.ts`、`sessionPlanPresets.ts`、`TrackingPilotRunner.ts`、`trackingPilotManifest.ts`）。
- `src/ui/SessionPlanSetup.ts`、`src/ui/RestOverlay.ts`、`src/data/metadata.ts`、`src/results/ResultPresentation.ts`。
- `src/main.ts` 的 `availableDrills`、`loadDrillById`、`startSessionPlan()`、完成分支鏈與 metadata 注入點。
- `docs/known_issue/` 的 KI-016（family allowlist 漂移）。

## Steps

1. 記錄 HEAD、`git status --short`、CodeGraph pending 與 baseline build/test 結果；不處理 unrelated changes。
2. 對 `SessionPlan`、`createSessionRunner`、`resolveFamilyDrillId`、`KNOWN_SESSION_FAMILY_IDS`、`buildFamilyOrder`、`SessionPlanSetup`、`RestOverlay` 執行 CodeGraph impact，記錄實際 consumer 數與 local／cross-module 分級，對帳 README §0.1。
3. 逐一列出 `availableDrills` 的每個 exact `drillId`，填入歸屬表候選（家族、practice/assessment 資格、是否登記於 `DrillMetricRegistry`），產出 §Required audit artifact 的表。
4. 讀 `exportBasename()` 實作，確認同一 drill 連續三次匯出的檔名是否唯一；記錄實際字串樣本。→ 收斂 **OQ-58.2**。
5. 讀 drill 載入鏈路的 seed 來源（`sequence.seed` → `createRan1`）與 `activateDrill` 的 restart 語意，判定「同一 drill 連跑 N 輪」現況會不會重播同一組 spawn 序列。→ 收斂 **OQ-58.1**。
6. 讀 `HistoryPersistence` / `DrillMetricRegistry` 的 Assessment 判定路徑，確認 `sessionPlanMode='custom'` 要在哪一層攔截。→ 收斂 **OQ-58.4**。
7. 對「連續三次 `loadDrillById(sameId)`」做 throwaway PoC，量測 sim 起始狀態（player velocity / recoil / arena 指標）是否逐位一致；PoC 產物於 T0 結束前刪除。
8. 撰寫 **GD-33** 草案並經 owner 確認後寫入 [DECISIONS.md](../../../DECISIONS.md)：WP-58／M（無）編號分配、三個新家族 id、兩值休息邊界語意、`frozen`/`custom` 雙軌、家族歸屬 ⇏ Assessment 資格。
9. 把所有 commands／measurements／決策寫入 [progress.md](progress.md)。

## Required audit artifact

| exact drillId | 候選家族 | Assessment 登記？ | history 可保存？ | 可排程？ | 理由 |
|---|---|---|---|---|---|
| `availableDrills` 每一個 | 明確 | 是/否（引用 registry 證據） | 是/否 | 是/否 | 明確 |

## Definition of Done

- [ ] CodeGraph impact 數字入 progress，且與 README §0.1 的規劃時讀碼結果對帳（不一致處已修正 README）。
- [ ] 歸屬表逐 exact drillId 完成，每一列都有「Assessment 資格」欄位證據，不以直覺判定。
- [ ] `exportBasename` 三輪唯一性有實際字串樣本；OQ-58.2 有 owner 結論。
- [ ] seed 逐輪行為有讀碼證據；OQ-58.1 有 owner 結論或明確 blocked owner/deadline。
- [ ] history/trend 攔截層有讀碼證據；OQ-58.4 有 owner 結論。
- [ ] 三次連續 restart 的 sim 起始狀態一致性 PoC 有可重現數據。
- [ ] GD-33 已寫入 DECISIONS.md 並取得 owner 確認。
- [ ] production code diff=0、PoC artifacts 清除、baseline failure 若有已證明為既存。

## Commit

```text
docs(stage12): complete WP-58 session program entry gate
```
