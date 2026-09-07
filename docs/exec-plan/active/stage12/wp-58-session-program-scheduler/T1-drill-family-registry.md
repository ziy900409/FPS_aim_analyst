# WP-58 T1 — Drill ↔ Family 雙向單一來源

## Objective

依 T0 凍結的歸屬表建立 `src/session/drillFamily.ts`，把 family→drill 與 drill→family 放在同一模組，新增三個家族 id 至 `KNOWN_SESSION_FAMILY_IDS`（純加法），並以測試釘死「家族歸屬 ⇏ Assessment 資格」的解耦（FR-58.1～58.3）。

## Steps

1. 新增 `src/session/drillFamily.ts`，匯出 `FAMILY_BY_DRILL_ID`、`SCHEDULABLE_DRILL_IDS` 與遷入的 `resolveFamilyDrillId()`。
2. 把 `resolveFamilyDrillId()` 自 `SessionRunner.ts` 移出（含其七個 drill import），`SessionRunner.ts` 改 import 新模組；函式主體逐位不變。
3. 於 `sessionSchedule.ts` 新增 `SCHEDULABLE_FAMILY_IDS = ['tracking','detection','micro-flick']`，併入 `KNOWN_SESSION_FAMILY_IDS`；`TEST_FAMILY_IDS` 與 `TRANSFER_*` 常數不動。
4. 撰寫 README §2.3 的四條不變量測試。
5. 撰寫解耦負向測試：對每個 practice-only drill（micro-flick、pilot v1/v2、tracking/detection 系列）斷言「在 `FAMILY_BY_DRILL_ID` 內」且「不在 `DrillMetricRegistry`」同時成立。
6. 跑既有 `micro_flick_three_target_test_v1.test.ts`、`sessionSchedule.test.ts`、`SessionRunner.test.ts`、metadata 相關測試，證明零修改仍綠。

## Invariants

- `TEST_FAMILY_IDS` 的四元素內容與順序逐位不變；`buildFamilyOrder()` 對同一 `(participantId, sessionIndex)` 的輸出不變。
- `resolveFamilyDrillId()` 對每個既有 family 的回傳值不變。
- 全 repo 只有一份 family allowlist；新模組不得複製 `KNOWN_SESSION_FAMILY_IDS` 的內容。
- `drillFamily.ts` 不 import DOM／Three／`node:*`／時鐘／亂數。

## Definition of Done

- [ ] §2.3 四條不變量測試全綠，含 practice-only 解耦逐一負向斷言。
- [ ] `micro_flick_three_target_test_v1.test.ts:228` 既有負向測試**零修改**仍綠。
- [ ] `buildFamilyOrder()` 既有測試零修改全綠；新家族未進入 `TEST_FAMILY_IDS`。
- [ ] `SessionRunner.ts` 不再 import 任何 drill 模組，且其既有測試零修改全綠。
- [ ] 全 repo grep 家族 id 字面值，確認無第二份清單。
- [ ] progress 記錄 blast radius、測試數與實際契約。

## Commit

```text
feat(session): add single-source drill family registry
```
