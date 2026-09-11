# WP-65 T3 — 待命提示與倒數數字 overlay

> FR-65.6 · NFR-65.7 · OQ-65.2

## Objective

讓倒數**看得見**。現行 3 秒倒數完全沒有任何畫面呈現——即使 T1/T2 把起算時機修對了，受試者仍只會看到「畫面卡住三秒然後目標突然出現」。本 task 交付一個純 DOM overlay（D1：階段 A 不引入 framework），在待命相位顯示開始提示、在倒數相位顯示 3 → 2 → 1。

依賴 T1 的 `phase` 與 `countdownRemainingMs`，**可與 T2 並行**（T2 未完成時，以手動把 `requireArm` 開起來的本機分支驗證即可）。

## Steps

1. **新檔 `src/ui/DrillStartOverlay.ts`**，比照 [`HUD.ts`](../../../../../src/ui/HUD.ts) 的結構慣例（建構期一次建 DOM、`update()` 只寫 `textContent`／`style`、`dispose()` 移除）：
   - `createDrillStartOverlay(options?: { parent?: HTMLElement }): DrillStartOverlayHandle`
   - 單一根節點 `<section id="drill-start-overlay">`，`aria-live="assertive"` 讓螢幕閱讀器播報倒數（既有 `stage10-accessibility.spec.ts` 有無障礙斷言的先例，T6 會跑到）。
   - 內含兩個預建的文字節點：提示行與數字行。**不在 `update()` 內 `createElement`**（NFR-65.7）。
2. **樣式**（OQ-65.2 預設：畫面中央大字）：
   - `position:fixed; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column`
   - `pointer-events:none` —— 讓待命時的點擊**穿透到 canvas** 取鎖。漏掉這條會直接卡死整個待命閘（overlay 吃掉那一次點擊）。這是本 task 最容易犯且後果最嚴重的錯。
   - `z-index`：高於 HUD（`18`）、低於 Result dialog 與 Controls。建議 `30`；實際值以 `overlay-layering.spec.ts` 的既有分層斷言為準，T6 會驗。
   - 數字用 `font-variant-numeric: tabular-nums`（同 HUD 的 `renderMetric`），避免 3→2→1 時寬度跳動。
3. **`update(phase, countdownRemainingMs)` 的三分支**：
   | phase | 提示行 | 數字行 | 根節點 |
   |---|---|---|---|
   | `'armed'` | `點擊左鍵開始` | 空 | 顯示 |
   | `'countdown'` | `準備` | `String(Math.ceil(countdownRemainingMs / 1000))` | 顯示 |
   | 其他（`idle`/`running`/`ended`） | — | — | 隱藏 |

   用 `root.hidden = true/false` 或 `style.display`，擇一並保持一致。`Math.ceil` 讓 3000 ms 顯示為 `3`、1 ms 顯示為 `1`、0 ms 顯示為 `0`——**`0` 只會在極短瞬間出現**（下一 tick 即轉 `running` 而隱藏），可接受；若實機覺得刺眼，改用 `Math.max(1, Math.ceil(...))` 並記入 `progress.md`。
4. **接線**（`src/main.ts`）：
   - 在 `const hud = createHUD();`（[main.ts:982](../../../../../src/main.ts#L982)）附近建構 overlay。
   - 在 `liveFrame` 內、緊鄰既有 `hud.update(...)` 呼叫（[main.ts:1836](../../../../../src/main.ts#L1836)）之處加一行 `startOverlay.update(phase, drillRunner.countdownRemainingMs)`。`phase` 該處已有區域變數，不重複讀取。
   - **`countdownRemainingMs` 只在此一處被讀取**——保持 sim→render 唯讀的單一出口。
5. **單元測試** `src/ui/DrillStartOverlay.test.ts`（jsdom，比照 `HUD.test.ts` / `ResultScreen.test.ts` 的既有模式）：
   - 三分支各一條：`armed` 顯示提示且數字為空、`countdown` 顯示對應整數、`running` 隱藏。
   - 邊界：`countdownRemainingMs` 為 3000 / 2999 / 1 / 0 的顯示值各一條。
   - **`pointer-events` 斷言**：根節點的 computed/inline style 含 `pointer-events:none`。這條看似瑣碎，但它是步驟 2 那個「會卡死整個功能」的錯誤的唯一自動化防線。
   - 無配置斷言：連續呼叫 `update()` 100 次後，根節點的 `children.length` 不變（NFR-65.7 的可測代理）。

## Invariants

- `HUD.ts` 本切片零修改（Time 卡屬 T4）。
- 不改任何既有 overlay 的 `z-index`（`lock-hint:10`、`metrics-hud:18`、`protocol-status:45`）。
- overlay 不讀 `SharedState`、不讀 `DrillConfig`、不寫任何狀態。
- 不新增字型檔或圖片（GD-9 不觸及）。

## Definition of Done

- [ ] `src/ui/DrillStartOverlay.test.ts` 全綠，含三分支 + 四個邊界值 + `pointer-events:none` + 無配置共 ≥ 9 條斷言
- [ ] 實機截圖三張存入 `progress.md`：待命提示、倒數顯示 `3`、倒數顯示 `1`
- [ ] 實機：待命時點擊可正常取鎖（證明 `pointer-events:none` 生效，非只靠單元測試）
- [ ] 實機：倒數期間 overlay 不遮蔽 HUD Time 卡、不被 Controls 遮住；分層以截圖佐證
- [ ] `frameLog` 對照：開啟 overlay 前後各跑一場同 drill，p95 幀時間差值記入 `progress.md`，且**未新增 over-budget window**（比照 WP-60 F6 的既有做法）
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0
- [ ] `progress.md §T3` 記錄：實際採用的 `z-index` 值與理由、`Math.ceil` 對 0 的處理決定

## Commit

```text
feat(ui): show the arming prompt and countdown on screen
```
