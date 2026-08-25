# T2 — 休息倒數 overlay + `SessionRunner.poll()` 接入 renderLoop

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Low |
| **Touches** | `src/ui/RestOverlay.ts`(新)、`src/session/SessionRunner.ts`(擴充 `poll()`)、`src/main.ts`(renderLoop 回呼接線) |
| **狀態** | 🟡 已實作並提交，待實機 session-plan 驗證(2026-08-25) |

## Objective

交付 FR-G5:休息 overlay 可設定秒數、顯示倒數,不阻斷資料匯出流程,休息期間不寫入任何 sim/`SharedState` 狀態。

## In scope

1. `RestOverlay.ts`:純 DOM 倒數顯示元件(`show(remainingMs)`/`hide()`/`dispose()`),不內建 `setInterval`/`setTimeout`。
2. `SessionRunner.poll(nowMs)`:由既有 `renderLoop((now) => {...})` 回呼逐帧呼叫,推進 `rest` phase 的 `remainingMs`,倒數結束時觸發下一家族的 `advance()`。
3. `main.ts` 接線:`renderLoop` 回呼內新增一行呼叫 `sessionRunner?.poll(now)`(比照既有 `simLoop.pump(now)` 的呼叫型式,但不影響 sim/render 既有邏輯順序)。

## Out of scope

- WP-41 `buildFamilyOrder()` 接線(T3)。
- `DrillRunner.ts`/`SimLoop.ts` 的任何修改。

## Steps

- [x] (2026-08-25) 建立 `RestOverlay.ts`(比照 `CueOverlay.ts`/`SessionSetup.ts` 既有 DOM overlay 型式:`position:fixed`/`z-index`/純文字更新)。
- [x] (2026-08-25) `SessionRunner.ts` 的既有 `poll(nowMs)` 以 `nowMs - restStartedAt` 計算 `remainingMs`,到期呼叫 `advance()`。
- [x] (2026-08-25) `main.ts` 的 `renderLoop` 回呼新增 `sessionPlanRunner.poll(now)`；呼叫置於 `simLoop.pump(now)` 前，且本切片未修改 `src/sim/*`、`SharedState.ts` 或 `DrillRunner.ts`。
- [x] (2026-08-25) 單元測試覆蓋:`SessionRunner.poll()` 在 `rest` phase 倒數至 0 時觸發 `advance()`;非 `rest` phase 呼叫 `poll()` 為 no-op。
- [x] (2026-08-25) 自動化驗證: `npm.cmd run test:ci` 通過(130 Vitest 檔/965 tests + Playwright);`RestOverlay` 的 `pointer-events:none` 由單元測試覆蓋，因此不會攔截既有 pointer-lock/canvas input。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `RestOverlay`/`SessionRunner.poll()` 不呼叫任何 `sharedState`/`drillRunner`/`activeTargetManager` API | `git diff` 對 `src/sim/*`、`src/state/SharedState.ts` 為空 |
| ② | 倒數到期自動觸發下一家族 | 單元測試通過 |
| ③ | 手動驗證休息期間不干擾既有鎖定/匯出流程 | progress.md 記錄手動驗證結果 |

## Commit

`feat(wp-42): T2 — RestOverlay + SessionRunner.poll() renderLoop 接線(FR-G5)`
