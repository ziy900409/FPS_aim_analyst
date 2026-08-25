# T2 — 休息倒數 overlay + `SessionRunner.poll()` 接入 renderLoop

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Low |
| **Touches** | `src/ui/RestOverlay.ts`(新)、`src/session/SessionRunner.ts`(擴充 `poll()`)、`src/main.ts`(renderLoop 回呼接線) |
| **狀態** | ⬜ 待開工 |

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

- [ ] 建立 `RestOverlay.ts`(比照 `CueOverlay.ts`/`SessionSetup.ts` 既有 DOM overlay 型式:`position:fixed`/`z-index`/純文字更新)。
- [ ] `SessionRunner.ts` 新增 `poll(nowMs)`:`rest` phase 內以 `nowMs - restStartedAtMs` 計算 `remainingMs`,到期呼叫 `advance()`。
- [ ] `main.ts` 的 `renderLoop` 回呼新增 `sessionRunner?.poll(now)` 呼叫,確認呼叫順序不影響既有 `simLoop.pump(now)`/`drillRunner.tick` 既有邏輯(`git diff` 對這兩者應為空)。
- [ ] 單元測試:`SessionRunner.poll()` 在 `rest` phase 倒數至 0 時觸發 `advance()`;非 `rest` phase 呼叫 `poll()` 為 no-op。
- [ ] 手動驗證:實機跑一次含休息的 session plan,確認倒數視覺正確、休息期間無法開火/无目標生成(因為此時 `drillRunner.phase` 應為 `idle`,不受本 WP 直接控制,只需確認 overlay 不干擾既有鎖定/解鎖流程)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `RestOverlay`/`SessionRunner.poll()` 不呼叫任何 `sharedState`/`drillRunner`/`activeTargetManager` API | `git diff` 對 `src/sim/*`、`src/state/SharedState.ts` 為空 |
| ② | 倒數到期自動觸發下一家族 | 單元測試通過 |
| ③ | 手動驗證休息期間不干擾既有鎖定/匯出流程 | progress.md 記錄手動驗證結果 |

## Commit

`feat(wp-42): T2 — RestOverlay + SessionRunner.poll() renderLoop 接線(FR-G5)`
