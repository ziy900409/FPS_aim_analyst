> ⚠️ **T0 交付的前提條件（2026-09-08）**——開工前必讀 [README §2.3](README.md) 的**已凍結**歸屬表與 [progress.md](progress.md) §T0：
> 1. **家族為 4 個新 id**（含 `spider-shot-wide`），非規劃時的 3 個。
> 2. **`FAMILY_BY_DRILL_ID` 必須引用 drill 模組匯出的 `drillId`／`id` 常數，禁止手打字面值**（D-58-T0-2）——repo 內 drill id 連字號／底線混用，規劃表因手打而產生六處錯誤。
> 3. 表涵蓋 **36 個 exact drillId**（`tracking` 11、`micro-flick` 8、`peek-click-transfer` 6、`spider-shot` 3、`counterstrafe` 3…）。
> 4. `resolveFamilyDrillId('spider-shot')` 回的是 **`spider-shot-v3`**，不是 v1／v2。
> 5. **解耦（FR-58.3）在現況已成立**（兩道與家族正交的閘，見 GD-35 ⑤）⇒ 本 task 的第 5 步是把既有事實**釘死成回歸保護**，而非建立新行為。

# WP-58 T1 — Drill ↔ Family 雙向單一來源

## Objective

依 T0 凍結的歸屬表建立 `src/session/drillFamily.ts`，把 family→drill 與 drill→family 放在同一模組，新增**四**個家族 id（T0 更正）至 `KNOWN_SESSION_FAMILY_IDS`（純加法），並以測試釘死「家族歸屬 ⇏ Assessment 資格」的解耦（FR-58.1～58.3）。

## Steps

1. 新增 `src/session/drillFamily.ts`，匯出 `FAMILY_BY_DRILL_ID`、`SCHEDULABLE_DRILL_IDS` 與遷入的 `resolveFamilyDrillId()`。
2. 把 `resolveFamilyDrillId()` 自 `SessionRunner.ts` 移出（含其七個 drill import），`SessionRunner.ts` 改 import 新模組；函式主體逐位不變。
3. 於 `sessionSchedule.ts` 新增 `SCHEDULABLE_FAMILY_IDS = ['tracking','detection','micro-flick','spider-shot-wide']`（**T0 更正：四個，非三個**——`spider-shot-wide` 於 T0 由 owner 追加，理由見 [README §2.3](README.md) 與 [GD-35](../../../DECISIONS.md) ②），併入 `KNOWN_SESSION_FAMILY_IDS`；`TEST_FAMILY_IDS` 與 `TRANSFER_*` 常數不動。
4. 撰寫 README §2.3 的四條不變量測試。
5. 撰寫解耦負向測試：對每個 practice-only drill（micro-flick、pilot v1/v2、tracking/detection 系列）斷言「在 `FAMILY_BY_DRILL_ID` 內」且「不在 `DrillMetricRegistry`」同時成立。
6. 跑既有 `micro_flick_three_target_test_v1.test.ts`、`sessionSchedule.test.ts`、`SessionRunner.test.ts`、metadata 相關測試，證明零修改仍綠。

## Invariants

- `TEST_FAMILY_IDS` 的四元素內容與順序逐位不變；`buildFamilyOrder()` 對同一 `(participantId, sessionIndex)` 的輸出不變。
- `resolveFamilyDrillId()` 對每個既有 family 的回傳值不變。
- 全 repo 只有一份 family allowlist；新模組不得複製 `KNOWN_SESSION_FAMILY_IDS` 的內容。
- `drillFamily.ts` 不 import DOM／Three／`node:*`／時鐘／亂數。

## Definition of Done

- [x] §2.3 四條不變量測試全綠，含 practice-only 解耦逐一負向斷言。（`src/session/drillFamily.test.ts`，49 tests）
- [x] `micro_flick_three_target_test_v1.test.ts:228` 既有負向測試**零修改**仍綠。
- [x] `buildFamilyOrder()` 既有測試零修改全綠；新家族未進入 `TEST_FAMILY_IDS`。
- [x] `SessionRunner.ts` 不再 import 任何 drill 模組，且其既有測試零修改全綠（`resolveFamilyDrillId`／`resolveWarmupDrillId`／`WarmupAvailability` 以 re-export 保留公開介面）。
- [x] 全 repo grep 家族 id 字面值，確認無第二份清單（唯二命中為 `spider_shot_wide_v1.test.ts` 的 near-miss **drill id** 字串，非家族清單）。
- [x] progress 記錄 blast radius、測試數與實際契約。

## Commit

```text
feat(session): add single-source drill family registry
```
