# WP-37 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-37.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

T0 ✅ (2026-08-24):覆核 WP-33 T-exit 與 README §0 八項讀碼對帳；無程式碼或測試異動。T1 可依已凍結的 cue contract 開工。

T1 ✅ (2026-08-24 11:23Z):交付 `counterstrafe-cued-v1` 的 additive `DrillEvent.cue`、`CueScheduleConfig(kind:'single')` 與 schema guard、既有 foreperiod 起點的 cue 排程、`PeekWindowTs.cues`、純 DOM `CueOverlay` 和協定 config。先跑未修改的 `TargetManager` / `schema` / `DrillRunner` / `counterstrafe_ad_v1` / WP-22 determinism 基準（91 tests）全綠；完成後 `npm run test:ci` 全綠（115 Vitest files / 896 tests；21 Playwright tests）。

## Decision Log

### D-37.1 — Cue schedule contract 與 reversal 狀態機歸屬(2026-08-24)

- **Decision:** 保留 top-level `DrillConfig.cue?: CueScheduleConfig` 命名；將設定定義為 discriminated union：`{ kind: 'single'; holdDurationMs?: never } | { kind: 'hold-reversal'; holdDurationMs: number }`。`schema.ts` 必須在執行期強制同一互斥/必填規則。
- **Decision:** `hold-reversal` 的 hold→reversal 狀態機落在 `DrillRunner.tick()`，不是 `TargetManager`。
- **Rationale:** `DrillRunner` 已持有 `state.held`、running/ended 的生命週期及 `resetAll()` 邊界；hold 是玩家輸入持續時間的判定。`TargetManager` 保持目標 spawn、可見性與 `nextSide` 排程職責，避免把輸入生命週期混入 target 管理。
- **Alternatives considered:** (1) `TargetManager` 可貼近 single-cue 的 foreperiod 蓋章，但無輸入生命週期職責，會擴大其依賴面；未採用。(2) 保留 `holdDurationMs?` 的寬鬆介面並只靠 schema 排除無效組合；未採用，因為辨別聯集可同時防止 TypeScript 呼叫端建立無效設定。

### D-37.2 — cue 與既有時間閘的併用規則(2026-08-24)

- **Decision:** `single` cue 在既有 `pendingSpawnAtMs` 首次設定的同一 tick 蓋章，方向取當下已決定的 `nextSide`；它是 foreperiod 起點的加性事件，不改 spawn delay、spawn 時刻或 target side。
- **Decision:** `hold-reversal` 第一個 cue 以目標可見為起點；`DrillRunner` 只在該目標仍存活時追蹤連續 hold，達 `holdDurationMs` 的同 tick 記第二個反向 cue。它不延長、重設或取代 `peekTimeoutMs` / `presentationMs`；目標被任一既有到期閘撤除時，reversal tracking 取消並在下一個目標重新開始。
- **Rationale:** cue 是量測時間戳，不得改寫既有 target/timeout 語意；保留 `config.cue` 省略時逐位相容。
- **Alternatives considered:** 新增 reversal 專屬逾時或由 cue 直接驅動 target lifecycle；均會創造第二套到期語意，留待 T2 僅在既有閘無法表達需求時重新評估。

### D-37.3 — cue 的 sim→data 記錄握手(2026-08-24)

- **Decision:** `TargetManager` 在 single-cue foreperiod 起點將 `{t,direction}` 寫入 `SharedState.cues`；`SimLoop` 於目標 manager 推進後、`visible` 事件前匯出並清空此暫態佇列。
- **Rationale:** 與既有 `TargetManager → SharedState.tVisible → SimLoop.recordVisibleEvents → DataRecorder` 路徑同型，讓 target 管理保持不依賴 data recorder，且保證同 tick cue 先於 visible 寫入。
- **Alternatives considered:** (1) 讓 `TargetManager` 直接依賴 `DataRecorder`；未採用，因為會把資料層耦進 spawn 管理。(2) 在 `TargetManager` 公開 callback/drain API；未採用，因為會擴張 22 個既有 TargetManager 使用點的介面契約。

## Surprises

無。README §0 的八項讀碼對帳均成立；唯一需追蹤的缺口已列為 OQ-S6-21（正式歷史守門尚未接進主匯出路徑）。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-19 | reversal 狀態機落點:`DrillRunner` vs `TargetManager` | ✅ closed — `DrillRunner`（D-37.1） |
| OQ-S6-20 | reversal 逾時機制:沿用 `peekTimeoutMs` 或獨立 | 🟡 T2 open — 現有 `peekTimeoutMs` / `presentationMs` 迴圈可機械共存；T2 需驗證撤除時取消 tracking，暫不新增第二逾時。 |
| OQ-S6-21 | free-v1 Practice 匯出是否已有守門 | 🟡 T3/WP-38 dependency — `main.ts`/`ResultScreen.ts` 尚無 `mode` 分流，`buildCompatibilityKey()` 目前僅由 tests/研究 metrics 呼叫；凍結契約指定正式歷史執行期強制由 WP-38 擁有。T3 僅可確保 free config 標記 `practice` 且自身不建立 compatibility key。 |
| OQ-S6-22 | `cueToKeyMs` 錨點是否需雙重報告 | 🟢 open(不阻塞開工) |
