# WP-58 T4 — Session Plan 表單改版與程式預覽

## Objective

把 `SessionPlanSetup` 從「家族勾選 + 單一秒數」改版為「drill 清單 + reps + 兩級秒數 + 編譯後預覽表」，並擴充 `RestOverlay` 顯示邊界與下一個 drill（FR-58.12／58.13／58.17、OQ-58.3）。

## Steps

1. 加入模式切換：標準 Assessment（走 frozen 路徑，保留 `includeWarmup`）／自訂 program（顯示清單編輯區）。
2. 自訂區：`SCHEDULABLE_DRILL_IDS` 下拉 + 「加入」按鈕 → 有序清單；每列含拖曳把手、drill id、reps 數字輸入、移除鈕。
3. 兩個獨立秒數欄位：drill 休息、家族休息，各自帶 min/max 驗證與錯誤訊息。
4. 每次清單／秒數變動即呼叫 `compileSessionProgram()` 重繪預覽表：逐步驟顯示 `▶ drill (rep n/N)` 或 `⏸ Ns · boundary → nextDrill`；表頭顯示 `summarizeProgram()` 的步數與休息合計。
5. 編譯拋錯時顯示具名錯誤並**禁用提交**；不得提交未通過編譯的 plan。
6. `onSubmit` 改為回傳 `{ mode, items, drillRestSeconds, familyRestSeconds }`（frozen 模式回傳 `{ mode:'frozen', families, restSeconds, includeWarmup }`）。
7. `RestOverlay.show()` 擴充參數以顯示邊界標籤與下一個 drill id（依 OQ-58.3 決議）；既有 `show(remainingMs)` 呼叫點同步更新。
8. 撰寫 component tests：加入／排序／移除／reps 邊界值／秒數邊界值／預覽正確性／錯誤時禁用提交。
9. 撰寫鍵盤與 ARIA 測試（NFR-58.7）：不使用拖曳也能改變順序（上移/下移或鍵盤操作）、reps 與秒數輸入有標籤、錯誤訊息可讀。
10. 預覽重繪 benchmark（NFR-58.4，400 run steps P95 < 50 ms）；必要時加 debounce。

## Invariants

- UI 為純 TS + DOM overlay（D1），不引入框架。
- 預覽表**只**由 `compileSessionProgram()` 產生，不得在 UI 層重算邊界或秒數。
- frozen 模式的既有行為（家族拖曳排序、單一休息秒數、`includeWarmup`）保持可用。
- 表單不得提供任何修改 drill 內部參數（trial 數、seed、hitbox…）的入口。

## Definition of Done

- [ ] 加入／排序／移除／reps／兩秒數皆有 component test 且全綠。
- [ ] 預覽表逐步驟正確，含 `boundary` 標籤與 `nextDrillId`；17 步 golden 情境在 UI 層有一致呈現的測試。
- [ ] 編譯錯誤時提交被禁用，錯誤訊息具名且可讀。
- [ ] `RestOverlay` 擴充後既有測試更新並全綠。
- [ ] 鍵盤可完成全流程；ARIA 標籤與錯誤訊息測試通過。
- [ ] 400 run steps 預覽重繪 P95 < 50 ms 有量測數據。
- [ ] progress 記錄 UI 契約、測試數與量測。

## Commit

```text
feat(ui): edit and preview custom session programs
```
