# WP-70 T4 — 恢復條件入口（E2）

> **本 WP 最大、風險最高的一塊。** 它要解開一個既有耦合：目前「進入 fullscreen」與
> 「啟動 Session Plan」綁在資格閘的同一個 `onEnter` 裡，導致 plan 進行中沒有任何方式回到全螢幕
> （KI-040 缺陷 B ＋ §3）。

## Objective

提供一條**不重啟 orchestrator** 的路徑，讓操作員重新證明顯示條件並回到同一項。

## 背景（KI-040 §3，T4 須以當前行號複核）

資格閘的 `onEnter` 會走 `startSessionPlan()` → `sessionPlanRunner.start()`，而後者在 phase 非
`idle`/`done` 時 `throw new Error('SessionRunner is already active')`；即使沒 throw 也是
`enterStep(0)`（整個 plan 從頭）。⇒ 重開資格閘**救不了**進行中的 plan。

## Steps

1. **解耦**：把「請求 fullscreen + 跑三項檢查」與「啟動哪一個 session 模式」分開。
   資格閘現行把兩者綁在 `onEnter`；抽出可重用的「條件驗證」單元，讓啟動流程與恢復流程共用它。
   ⚠️ 不得為恢復流程複製一份檢查邏輯（C-D4）。
2. **新增恢復流程**（`src/ui/ConditionRecoveryScreen.ts` 或等價），契約見 README §2.3：
   - `open({ onRecovered })` 顯示說明 + 一顆按鈕；
   - ⚠️ **按鈕 click handler 內同步呼叫 `requestFullscreen()`**（FM-70.4，與 WP-69 FM-4 同型：
     任何 `await`／排程在前都會失去 user activation）；
   - 進入 fullscreen 後跑 perf 探測與 gate 檢查（解析度是否重驗依 OQ-70.3 決定）；
   - 全過 → `onRecovered(report)`；未過 → 留在畫面、顯示逐項 ✓✗ 與可重試（FR-70.9）。
3. **接線**：從暫停面板（WP-69 `PauseOverlay`）提供入口。
   ⚠️ 依 FR-70.11，「繼續本項」在 WP-69 語意下**必然是 restart 本項**（暫停中結算 ⇒
   `pause-fence-unclosed` ⇒ `discarded`，OQ-69.4 已定），文案不得暗示接續錄製。
   恢復成功後走既有 `restartActiveDrill()`，**不**走任何 orchestrator 入口。
4. **零推進反證**：恢復流程不得呼叫 `sessionPlanRunner.start()`／`advance()`／
   `completeCurrentCondition()`／`downloadJSON`／`historyPersistence.save()`（FR-70.10、NFR-70.5）。
5. 測試：
   - **spy 呼叫矩陣**：恢復流程跑完，上述五個的呼叫數皆為 **0**，且 cursor／conditionIndex／
     `exports[]` 逐位不變；
   - **成功路徑**：click → fullscreen → 檢查通過 → `onRecovered` → 該項 restart 且 attempt +1；
   - **兩條失敗路徑**：使用者/瀏覽器拒絕 fullscreen；進了 fullscreen 但 perf 未過 ⇒ 皆留在畫面
     且訊息具名可重試（FR-70.9）；
   - **source-scan**：click handler 內 `requestFullscreen()` 早於任何 `await`（FM-70.4）；
     恢復流程不 import `startSessionPlan`／`startProtocol`（FM-70.3）；
   - DOM 建構期一次配置（`createElement` 計數不變，NFR-70.4）。

## Definition of Done

- [ ] `npx vitest run` exit 0
- [ ] **五個推進/保存/下載入口的 spy 呼叫數皆為 0**，且 cursor／conditionIndex／`exports[]` 逐位不變
- [ ] 成功路徑 + **兩條**失敗路徑皆有具名測試（只有成功路徑不算，FR-70.9）
- [ ] source-scan 釘住 `requestFullscreen()` 在第一個 `await` **之前**（FM-70.4）
- [ ] source-scan 釘住恢復流程不 import `startSessionPlan`／`startProtocol`（FM-70.3）
- [ ] 條件檢查邏輯與資格閘**共用同一份實作**（C-D4），以 import 關係或 source-scan 佐證
- [ ] 更新路徑 `createElement` 呼叫數不變（NFR-70.4）
- [ ] OQ-70.3 已關閉，結論（是否重驗原生解析度）記入 `progress.md`
- [ ] 入口文案不含「接續 / 繼續錄製」等暗示接續的措辭（FR-70.11）

## Commit

```text
feat(ui): add a condition recovery entry point
```
