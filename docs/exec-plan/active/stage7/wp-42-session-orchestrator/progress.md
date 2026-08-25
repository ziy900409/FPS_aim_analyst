# WP-42 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-42.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-25 | CodeGraph + `rg` 覆核 §0：四個目標 config 仍未登記於 `availableDrills`，`loadDrillById()` 仍只可載入已登記項目；`ProtocolRunner` 仍強制 `ResolutionMode` 並由外部手動推進；四家族 mode 現況未變。完成 D-42.1～D-42.5，T1 可依 README §2.6 開工。 |
| T1 session plan + runner | 🟡 已實作 | 2026-08-25 | 新增 availableDrills 三項、SessionRunner／preset／setup UI 與 additive metadata；SessionRunner、SessionPlanSetup 與 metadata 測試皆由 `npm.cmd run test:ci` 通過。待實機驗證三個新增 drill 的完整選取→倒數→目標→結束→匯出流程。 |
| T2 rest overlay | 🟡 已實作 | 2026-08-25 | `src/ui/RestOverlay.test.ts` verifies inert DOM-only overlay, countdown formatting, hide, and disposal. `src/session/SessionRunnerPoll.test.ts` verifies no-op outside rest and automatic advance at expiry; `main.ts` supplies the existing render-loop timestamp to `sessionPlanRunner.poll(now)`. `npm.cmd run test:ci` passed (130 Vitest files / 965 tests + Playwright). 待實機驗證含休息的 session plan。 |
| T3 family order wiring | ⬜ | — | — |
| T-exit 驗收 + 文件定稿 | ⬜ | — | — |

## Decision Log

### D-42.1 — SessionRunner 新建小狀態機，不重用 ProtocolRunner

- **決定**：T1 新建語意專屬的 `SessionRunner`，沿用 `main.ts` 的啟動接線，不重用 `ProtocolRunner<TPayload>`。
- **證據**：`ProtocolCondition.mode` 仍是必填 `ResolutionMode`，`assertReadyState()` 強制比對；現有 BR consumer 仍以 `'native'` 填入無關欄位。其 `start()`／`beginNextCondition()`／`completeCurrentCondition()` 仍須由外部手動呼叫，不能直接承接 FR-G5 休息倒數。
- **Alternatives Considered**：重用 `ProtocolRunner` 並在外包裝倒數，將維護兩層狀態且為家族排程填入語意虛假的 mode，沒有實質降低 T1 複雜度。

### D-42.2 — 熱身僅由 counterstrafe 提供；其餘三家族明示略過

- **決定**：counterstrafe warmup 載入既有 `counterstrafe-free-v1`；hold-click、hold-track、spider-shot 直接轉 assessment，並顯示「本家族無熱身，直接開始正式測試」。本 WP 不新增或 monkey-patch Practice config，正式關閉 OQ-S7-2。
- **證據**：hold-click、hold-track、spider-shot 均為 assessment；counterstrafe-free 為 practice；cued/reversal 均為 assessment。現有 pilot config 是校準候選產生器，不是可供 session 載入的正式 Practice config。
- **Alternatives Considered**：新增三個 Practice config 或在 orchestrator 覆寫 mode。前者修改凍結協定且超出範圍；後者會產生未經協定驗證的假熱身。

### D-42.3 — availableDrills additive 補三項，不納入 counterstrafe-cued-v1

- **決定**：T1 僅登記 `spider-shot-v1`、`counterstrafe-reversal-v1`、`counterstrafe-free-v1`；cued 維持未登記。
- **證據**：四個目標 config 在 `main.ts` 仍沒有 import 或 registry 項目，`loadDrillById()` 找不到項目即拋出 `Unknown drill`。`pilotConfigs.ts` 的 counterstrafe 校準入口仍只消費 reversal。
- **Alternatives Considered**：同時登記 cued。它目前沒有 session-plan 或 pilot 校準需求，會無必要擴大首次全鏈路驗證範圍；未來可另以 additive 小任務納入。

### D-42.4 — pilot-default 直接引用既有凍結量值；不阻塞 T1

- **決定**：不新造數字：Spider Shot 使用既有 `targets.count`／`timing.timeLimitMs`；其他單一條件格家族在 T1 直接引用既有 `endCondition.value`。OQ-S7-13 不阻塞 T1，但實作時須確認欄位對應。
- **證據**：`spiderShotV1` 固定 `targets.count: 20`、`timing.timeLimitMs: 120000`、`endCondition.value: 20`；`pilotConfigs.ts` 也只由現有 assessment config clone 後調整 practice 或校準參數。
- **Alternatives Considered**：向研究者索取新 trial 數或先設計自由數值表單。這會形成與凍結協定分歧的第二個數字來源，亦違反 preset 僅可選的範圍。

### D-42.5 — 休息倒數以既有 renderLoop 時鐘輪詢

- **決定**：T2 由既有 `renderLoop` 的 `now` 呼叫 `SessionRunner.poll(nowMs)`；`RestOverlay` 僅渲染剩餘時間，不建立 `setInterval`、`setTimeout`、worker 或 sim 狀態互動。
- **證據**：既有 drill countdown 屬 sim tick；本 WP 的休息期必須是純 DOM orchestration，且不得讀寫 `SharedState`。
- **Alternatives Considered**：在 overlay 內自行計時。這會形成第二個時鐘源，可能與 rAF 畫面節奏脫鉤。

## Surprises

- 規劃階段讀碼(README §0-2)發現:stage7 README 原文把「四個測試家族的既有能力」當作既定事實,但 `main.ts` 的 `availableDrills` 實際上只登記了 hold-click/hold-track 兩個家族——spider-shot 與 counterstrafe 三個變體全部只存在於 unit test 與 `pilotConfigs.ts`,從未被 `loadDrillById()` 實際載入過。這不是 stage7 README 或 WP-41 讀碼已發現的落差,是本 WP 規劃階段新發現,已反映進估時上修(2–3d → 3–4.5d)。
- T0 覆核差異:README §2② 的「既有 9 個項目」計數已過時；目前 registry 是 7 個直接項目加上 3 個 `trackingBrVariants` 展開項目。此差異不影響缺口判定或 T1 的 additive 策略。
- T2 verification environment: sandboxed Vitest/Vite could not read `vite.config.ts` (`Cannot read directory "../../../..": Access is denied`). The same targeted tests and full `npm.cmd run test:ci` passed when run with the approved local build/test permission; this is a sandbox filesystem limitation, not a product test failure.

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S7-2 | 三個家族是否需要新增 Practice-mode 變體供熱身使用 | ✅ 已關閉(D-42.2)：本 WP 不新增 Practice config；三個無變體家族明示略過熱身。 |
| OQ-S7-11 | SessionRunner 引擎:新建 vs 重用 `ProtocolRunner` | ✅ 已關閉(D-42.1)：新建小型、語意專屬狀態機；只沿用既有啟動接線。 |
| OQ-S7-12 | Counterstrafe assessment 步驟載入 reversal 還是同時涵蓋 cued | ✅ 已關閉(D-42.3)：僅使用 reversal；cued 保持未登記。 |
| OQ-S7-13 | `perFamilyTrialShape` 實際數值來源 | 🟡 不阻塞 T1(D-42.4)：直接引用現有凍結量值；實作時確認各欄位對應。 |
