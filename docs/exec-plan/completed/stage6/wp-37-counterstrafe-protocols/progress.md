# WP-37 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-37.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

T0 ✅ (2026-08-24):覆核 WP-33 T-exit 與 README §0 八項讀碼對帳；無程式碼或測試異動。T1 可依已凍結的 cue contract 開工。

T1 ✅ (2026-08-24 11:23Z):交付 `counterstrafe-cued-v1` 的 additive `DrillEvent.cue`、`CueScheduleConfig(kind:'single')` 與 schema guard、既有 foreperiod 起點的 cue 排程、`PeekWindowTs.cues`、純 DOM `CueOverlay` 和協定 config。先跑未修改的 `TargetManager` / `schema` / `DrillRunner` / `counterstrafe_ad_v1` / WP-22 determinism 基準（91 tests）全綠；完成後 `npm run test:ci` 全綠（115 Vitest files / 896 tests；21 Playwright tests）。

T2 ✅ (2026-08-24 11:52Z):交付 `counterstrafe-reversal-v1` assessment config 與 `DrillRunner` 的目標可見→連續 hold→反向 cue 狀態機。第一 cue 在 target visible tick 寫入，對應 A/D 按住達 `holdDurationMs` 後同 tick 寫入反向 cue；放開即重算，且既有 `peekTimeoutMs` / `presentationMs` 先撤目標、再執行 tracking，沒有第二套逾時語意。`PeekWindowTs.cues` 現可把同 visible tick 的 first cue 與該 window 的 reversal cue 一起歸屬。改動前基準 100 tests 全綠；改動後 T2 針對性回歸 109 tests 全綠；`npm run test:ci` 全綠（116 Vitest files / 903 tests；21 Playwright tests）。

T3 ✅ (2026-08-24 16:00Z):交付 practice-only `counterstrafe-free-v1`（既有 free-form config 的等價 TS 包裝，無 `cue`）、`deriveBrakingSamples()` 與 `deriveCounterstrafeMetrics()`。制動從 counter tick 掃至首發；速度 gate 唯一讀取 `CS2_PROFILE.accuracyThreshold`，未變號與首發截斷都保留 flags，絕不以 0 補值。共同指標直接消費 `computeSyncMetrics()` 的 sync-v1 rows，依既有 `stat()` L/R 分層型式組裝，且型別/執行期 keys 均無合成總分。針對性回歸 4 files / 12 tests 與 typecheck 全綠；`npm run test:ci` 全綠（118 Vitest files / 911 tests；21 Playwright tests）。

T-exit ✅ (2026-08-24 16:40Z):覆核框架 v1「三個急停子協定不共用未分層總分」驗收條件——`CounterstrafeMetrics` 型別與 `deriveCounterstrafeMetrics()` 執行期 keys 皆不含任何單一分數欄位,證據見 `counterstrafeMetrics.test.ts:49-`「exports only stratified measures, never a composite counter-strafe score」。定稿 [analysis-counterstrafe.md](../../../../operational/analysis-counterstrafe.md):`cue` 事件語意、`CueScheduleConfig` 兩種 `kind`、reversal 狀態機(含放開鍵重算計時器規則)、制動四量公式(含 `CS2_PROFILE.accuracyThreshold` 單一來源聲明)、共同指標組裝與型式來源、`cueToKeyMs` 錨點與 `hold-click-v1`/`hold-track-v1` 錨點不同的明文提醒(OQ-S6-22,採納 README §7 建議:只報告 cue 錨點值)。CONTEXT.md §A 回寫六則新術語:`cue` 事件、`CueScheduleConfig`、`holdDurationMs`/hold→reversal 狀態機、制動四量、`counterstrafe-cued-v1`/`-reversal-v1`/`-free-v1`。[../README.md](../README.md) §3 WP-37 狀態翻 ✅,並更新 WP-38 entry 條件敘述(WP-34/35/36/37 全數 T-exit)。最終 `npm run test:ci` 全綠(118 Vitest files / 911 tests;21 Playwright tests,與 T3 相同)。

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

### D-37.4 — reversal cue 追蹤與 peek 歸屬(2026-08-24)

- **Decision:** `DrillRunner.tick()` 先執行既有 `peekTimeoutMs` / `presentationMs` 撤除，再只追蹤仍存活可見的 target；hold 計時器以玩家首次在該 target 可見後持有其 cue 對應 A/D 的 sim tick 起算，放開即設回 `null`。達時只發一次相反方向 cue。
- **Decision:** `buildPeekWindows()` 若某 visible tick 有 cue，將該 cue 起至下一個 visible 前的 cues 歸給目前 peek；否則維持既有「前一 visible 至目前 visible 的 foreperiod cue」歸屬。
- **Rationale:** 前者讓 expiration 同 tick 不會寫出過期 reversal cue，且不創造第二 timeout；後者在不擴張 frozen `DrillEvent.cue`（不加 target ID）的前提下，正確收納 `hold-reversal` 的可見同 tick cue 和後續 reversal cue，同時維持 `single` 的 foreperiod 語意。
- **Alternatives considered:** (1) 在 cue 事件加 target ID；未採用，因為 T1 已凍結的 additive contract 不需要為此擴張。(2) 一律以前一 visible 到目前 visible 間的 cues 歸屬；未採用，因為會遺漏或錯置 reversal 的第二 cue。(3) 新增 reversal 專屬逾時；未採用，因為既有撤除閘已能表達生命週期。

### D-37.5 — 制動觀測邊界與指標組裝(2026-08-24)

- **Decision:** 制動掃描從 `tCounter` 的第一筆可用 tick 開始，至首發（若有）或 peek window 結束；首發前仍未變號時回傳 `undefined` 並記 `no_zero_crossing` 與 `window_truncated_by_fire`，不以零值補缺。
- **Decision:** `releaseToFireMs` / `counterHoldMs` / `counterToFireMs` 直接讀 `computeSyncMetrics(payload).rows`；所有側別統計統一以 `compute.ts` 的 `stat()` 型式產生 `{left,right,diff}`。`fireBeforeGateRate` 以有 compatible first fire 的 peeks 為分母；`firstShotHitRate` 以全部 peeks 的既有 `outcome === 'hit'` 為分母。
- **Rationale:** 首發後的移動已不屬於同一次瞄準/制動決策；顯式 flags 保住離線分析的樣本品質。sync rows 與既有統計函式維持 C-D4 的單一定義，且沒有必要建立跨構念分數。
- **Alternatives considered:** (1) 首發後持續掃描到下一次 visible；未採用，會混入 post-shot lifecycle。(2) 在新模組重推 release/hold/counter timing 或另寫統計器；未採用，會違反既有構念單一來源。(3) 將無首發也納入門檻前開火率分母；未採用，該率衡量的是實際首發發生時的門檻違反，`firstShotHitRate` 已獨立保留 no-shot 懲罰。

## Surprises

`PeekWindowTs.cues` 的 T1 初始語意只涵蓋 visible 前的 foreperiod cue；T2 的第一 cue 與 visible 同 tick、第二 cue 位於 window 內，故需新增同-tick 分流。證據：`src/drill/counterstrafe_reversal_v1.test.ts` 覆蓋完整 cue→hold→reversal cue→counter→fire 分析序列；`npm run test:ci` 全綠。T3 讀碼亦確認 `buildCompatibilityKey()` 尚無 main/UI 呼叫點，因此 free-v1 config 本身不可能在既有路徑觸發它；正式歷史守門留給 WP-38 整合。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-19 | reversal 狀態機落點:`DrillRunner` vs `TargetManager` | ✅ closed — `DrillRunner`（D-37.1） |
| OQ-S6-20 | reversal 逾時機制:沿用 `peekTimeoutMs` 或獨立 | ✅ closed — 沿用既有 `peekTimeoutMs` / `presentationMs`；兩者撤除 target 後 tracking 同 tick 取消，測試覆蓋，未新增第二逾時（D-37.4）。 |
| OQ-S6-21 | free-v1 Practice 匯出是否已有守門 | ✅ closed for T3 — `buildCompatibilityKey()` 目前僅由 tests/研究 metrics 呼叫，沒有 main/UI 匯出呼叫點可觸發；`counterstrafeFreeV1` 僅標記 `mode:'practice'` 且不依賴 compatibility-key 模組。正式歷史執行期守門仍由既有凍結契約指定 WP-38 整合。 |
| OQ-S6-22 | `cueToKeyMs` 錨點是否需雙重報告 | ✅ closed — 採納 README §7 建議,只報告以 cue 為錨點的值;`analysis-counterstrafe.md`「`cueToKeyMs` 錨點提醒」節明文記載與 `hold-click-v1`/`hold-track-v1` 可見度 onset 錨點不同,不可跨家族直接比較。 |
