# WP-69 — Progress

## Snapshot

- **狀態**：🟡 T0 已落閘（2026-09-15），T1 可開工
- **分支**：`chore/agents-skills-tree`
- **規劃日期**：2026-09-15
- **下一步**：T1 — attempt/disposition contract
- **決策**：[GD-46](../../../DECISIONS.md#gd-46--wp-69-暫停後永久失去實驗效力時間戳不可信即丟棄只有整場-restart-可恢復資格2026-09-15規劃)

## Planning evidence

- 已依 `.claude/skills/engineering-planning/SKILL.md` 讀取 `CLAUDE.md`、exec-plan index/decisions、`CONTEXT.md`、design standards/template，以及直接上游 WP-65 與平行 schema WP-67。
- CodeGraph 規劃期辨識的高風險節點：`createSimLoop`（53 callers/test references）、`Clock`（43）、`DrillRunner`（9）、`createInputSampler`（2）、`HistoryPersistence`（單一 app caller），以及三個 runner 的完成/推進狀態機。
- 現況關鍵事實：`liveFrame()` 在 ended 後無條件 build payload/save/advance；`HistoryPersistence` 只排除 practice、不排除 suspect；`SimLoop` 對 >250 ms delta 會 re-anchor；`restartActiveDrill()` 已重建 sim/RNG 並清 recorder/UI，可作 full restart 單一核心。

## Task log

| Task | 狀態 | 證據 / 決策 / 意外 |
|---|---|---|
| T0 | ✅ | 2026-09-15。編號重查、blast radius、baseline 四閘、pause time spike、integrity 詞彙凍結、OQ-69.1～69.3 全關。production diff = 空。見 [§T0](#t0-entry-gate2026-09-15) |
| T1 | ⬜ | — |
| T2 | ⬜ | — |
| T3 | ⬜ | — |
| T4 | ⬜ | — |
| T5 | ⬜ | — |
| T6 | ⬜ | — |
| T-exit | ⬜ | — |

## Decision log

| ID | 決定 | 狀態 |
|---|---|---|
| D-69.P1 | pause 是 orthogonal runtime state，不擴充 `DrillPhase` | 規劃採納；T0 複核 |
| D-69.P2 | pause 立即 sticky invalid；resume 不恢復，只有 full restart 建新 candidate | 使用者已拍板 |
| D-69.P3 | timestamp health 通過才保留 invalid diagnostic；失敗則無 payload並清 recorder | 使用者已拍板 |
| D-69.P4 | finalization gate 必須早於 payload/metrics/save/advance | 規劃採納；T0 spike 複核 |
| D-69-T0-1 | `RecordingIntegrityReason` 凍結為 8 個封閉 reason，判準以現行 fixture 實測反推（見 §T0.5） | T0 採納 |
| D-69-T0-2 | tick 軸判準取 **bit-exact** `dt === tickMs`（零容差）；event 軸判準取 **一個 tick 的回退窗**，非零容差 | T0 採納（實測支撐） |
| D-69-T0-3 | OQ-69.1 由使用者**推翻 README 預設**：invalid diagnostic 改「只在結果頁手動下載」，不自動下載 | 使用者 2026-09-15 拍板 |
| D-69-T0-4 | `meta.validity.pauseOccurred` 預期只移動 3 筆 canonical digest（帶 `validity` 父物件者）；第 4 筆變動即 bug | T0 採納 |

## Open Questions

OQ-69.1～69.3 已於 T0 全數關閉（見 [§T0.6](#t06-oq-關閉2026-09-15使用者拍板)）。目前無未決 OQ。


---

## T0 entry gate（2026-09-15）

> 交付物 = 本節 + README §1.4 的 OQ 結論 + checklist 翻牌。**production code diff = 空**（本 commit 僅動 `docs/`）。

### T0.1 編號與平行 WP 重查

| 來源 | 重查結果（2026-09-15） |
|---|---|
| `docs/exec-plan/README.md §2` 最大採納號 | **WP-69**（本 WP 自己；前一個為 WP-68 ✅） |
| `docs/exec-plan/active/*/` 實際資料夾 | 最大為 `stage15/wp-69-pause-invalid-restart/` |
| `DECISIONS.md` 已落帳最大 | **GD-45**（WP-68 T-exit） |
| 已預約未落帳 | **GD-43**（WP-67）、**GD-46**（本 WP） |
| `grep -c "^### GD-43 "` / `GD-46` / `GD-47` | `0` / `1` / `0` ⇒ GD-46 未被他人取用，**不需順延** |
| stage14 §3 三個候選 | 自我標示未批准，依 [GD-15](../../../DECISIONS.md) 不佔號（該檔 2026-09-14 註記已順延為 WP-69/70/71，但未採納） |

⇒ **維持 WP-69 / GD-46，不改號。**

**WP-67 對帳（FM-9）**：`wp-67-.../progress.md` 的 Progress 表 T0～T-exit **全部 ⬜**，production 零落地 ⇒ 目前無 rebase 衝突。兩案的 canonical-digest 影響面經實測為**互斥**：

| WP | 新欄 | 缺席語意 | 預期移動的 digest 筆數 |
|---|---|---|---|
| WP-67 | `meta.opening`（meta 層） | **缺席不補預設**（D-67-2） | **0**（鍵不存在 ⇒ 位元不動） |
| WP-69 | `meta.validity.pauseOccurred` | optional-in／**required-out**（承 D-65-3） | **3**（只有帶 `meta.validity` 父物件的 fixture） |

`CANONICAL_DIGEST_BEFORE_T5`（[src/data/exportPayloadSchema.test.ts:61](../../../../../src/data/exportPayloadSchema.test.ts#L61)）現有 8 筆，其中帶 `meta.validity` 的**恰好 3 筆**：`09_18_05` / `09_24_18` / `09_37_24`（其餘 5 筆 `validity` 缺席）。這與 WP-65/T5 加 `pointerLockLost` 時的實際結果**逐筆相同**（該檔註解已載明）。⇒ **T1 只准改這 3 筆，第 4 筆變紅即代表補錯預設，回頭修程式不准改表**（D-69-T0-4）。兩案先後落地皆只動自己那幾列，**不需要共用 fixture 基線**。

### T0.2 Blast radius（重跑，不沿用規劃期行號）

CodeGraph 已回應（`codegraph_explore`），輔以機械式 reference count（`grep -rln` over `src/ tests/ scripts/ research/`）：

| 符號 | 檔案數 | production | test | 本 WP 觸及點 |
|---|---|---|---|---|
| `createSimLoop` | 34 | 4 | 30 | T2：改餵 mapped time，**不改 pump 演算法** |
| `createDataRecorder` | 39 | 4 | 35 | T4：discard 走既有 `reset()`，不新增第二個 recorder |
| `createInputSampler` | 3 | 2 | 1 | T3：注入 `isGameplayInputEnabled()` / `mapEventTime()` |
| `createPointerLock` | 2 | 2 | 0 | T3：resume 取鎖；⚠️ **無單元測試覆蓋** |
| `showResultAndTrackHistory` | 1 | 1 | 0 | T4：接 disposition；⚠️ **無單元測試覆蓋** |
| `createHistoryPersistence` | 6 | 2 | 4 | T4：`excluded: invalid-attempt` 第二道防線 |
| `createSessionRunner` | 5 | 2 | 3 | T5 |
| `createProtocolRunner` | 4 | 3 | 1 | T5（codegraph 標「no covering tests」指 `ProtocolRunner` **型別**，模組本身有測試） |
| `createTrackingPilotRunner` | 4 | 3 | 1 | T5 |
| `restartActiveDrill` / `buildCurrentExportPayload` | 1 / 6 | 1 / 3 | 0 / 3 | T4：full-restart coordinator 與 payload 建立點 |

**現況機制複核（逐條對上 README §0 的假設，全部成立）**：

- [SimLoop.ts:859](../../../../../src/loop/SimLoop.ts#L859) `pump()`：`accSec += Math.min(rawDeltaS, 0.25)`；[:892](../../../../../src/loop/SimLoop.ts#L892) `if (rawDeltaS > 0.25) { simTimeMs = nowMs; accSec = 0; }` ⇒ catch-up 與 re-anchor **兩個**後果都在（T0.4 已量化）。
- [main.ts:1960](../../../../../src/main.ts#L1960) `liveFrame()`：`phase === 'ended'` 後**無條件** build payload → `showResultAndTrackHistory()` → `downloadJSON()` → `sessionPlanRunner.advance()` / `completeActiveProtocolCondition()`。無任何 disposition 分支。
- [HistoryPersistence.ts](../../../../../src/history/HistoryPersistence.ts) `save()`：只以 `meta.assessment === undefined` 短路成 `excluded: 'practice'`；**suspect / pointerLockLost 照樣存**（FM-2 成立）。
- [main.ts:1485](../../../../../src/main.ts#L1485) `restartActiveDrill()`：`drillRunner.restart()` + `resetRunPresentation()` + `buildSimLoop()`（重建 ⇒ 重置 RNG stream 與 `tickIndex`）+ `start()` ⇒ 可作 full-restart 單一核心，**但目前不清 attempt validity**（該欄尚不存在）。
- [TrackingPilotRunner.ts](../../../../../src/session/TrackingPilotRunner.ts)：`retryCurrentBlock()` **只接受 `block-outcome` 相位**，而要進該相位必須先跑 `completeCurrentBlock()` → `options.exportBlock()` 並 push 一筆帶 payload 的 record；`abortCurrentBlock()` 則會 `advanceFromBlock()` 前進。⇒ **README §2.5「不得借用 `abortCurrentBlock()`、需新增 discard/retry 入口」經原始碼複核為正確**，且理由比規劃期更強：現行唯一的 retry 路徑會**強制先建立 payload**，直接違反 `discarded` 的「不得建立 payload」。

### T0.3 Baseline 凍結（commit `7b1c941`，branch `chore/agents-skills-tree`）

⚠️ **前置意外**：`node_modules/` 為空（0 項），四個閘全部起不來。先跑 `npm ci`（exit 0，added 67 packages）才取得基線。**下一個 session 若看到 `tsc is not recognized`，先數 `node_modules`，不要懷疑程式。**

| 閘 | 命令 | exit | 計數 |
|---|---|---|---|
| typecheck | `npm run typecheck`（`tsc --noEmit` ×2） | **0** | — |
| build | `npm run build` | **0** | `✓ built in 2.46s`（chunk >500 kB 警告為既有） |
| 全量單元 | `npx vitest run` | **0** | **3386 passed / 2 skipped**（3388）；檔案 **273 passed / 1 skipped**（274） |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） |
| Edge e2e（Pointer Lock focused） | `npx playwright test --project=edge --workers=1 raw-mouse-sampling input-sampler full-drill` | **0** | **15 passed / 0 failed**（1.8m） |

`tests/regression` 的 **324** 與 WP-66 T-exit 記錄一致 ⇒ 回歸基線未漂移。全量 3386 高於 WP-66 的 3186（其後 WP-63/68 新增），屬預期。

e2e 前置：`netstat` 確認 **5173 無人佔用**（避免測到別人的 server）；`.playwright-tmp/history-dev` 現有 **352** 個 participant 目錄（尚未到會讓 history-library 變紅的量級，本次 focused 集亦不含該 spec）。

### T0.4 Spike：naive pause vs mapped pause（數值）

暫時性 spec `src/loop/__tests__/wp69-t0-pause-spike.test.ts`，**取證後已刪除**（承 WP-65 T6 spike 先例）。跑**真的** `createSimLoop`，不重寫 pump。條件：`SIM_HZ=128`（tick = 7.8125 ms）、rAF 60 FPS（16.667 ms/frame）、pause 3000 ms。

| 量 | (a) naive pause（暫停時不呼叫 `pump`） | (b)(c) mapped active time |
|---|---|---|
| 暫停期間每幀 ticks | —（根本沒呼叫） | **0**（180 幀全 0，sum=0、max=0） |
| resume 首幀 ticks | **32**（正常幀 = 2 ⇒ **16×**） | **2**（＝正常幀） |
| resume 首幀 sim 時間推進 | **250.000 ms**（＝ `Math.min(δ,0.25)` 上限） | **15.625 ms**（＝ 2 × 7.8125） |
| 其後一幀的 tick 戳記跳幅 | **2782.292 ms**（只做了 2 個 tick 的工） | — |
| ⇒ **re-anchor 注入的時間軸不連續** | **2766.667 ms** | **0**（`reAnchored: false`） |

**(d) 零 pause identity**：200 幀、兩條 loop（裸 `now` vs `mapper.mapWallTime(now)`），各 **426** 個 tick，tick 戳記序列 `Object.is` **逐位相同** ⇒ NFR-69.1 的 identity 前提在 mapper 形狀上成立。

> **T0 修正了規劃期的一個細節**：re-anchor 的傷害**不在 catch-up 那一幀**。`simTimeMs = nowMs` 發生在該幀的 tick 都已蓋完戳記之後，所以 catch-up 幀看起來「只」多跑 32 個 tick、時間推進 250 ms；**真正 2766.667 ms 的不連續出現在下一幀**。T2 的斷言若只看 resume 首幀會**完全看不到 re-anchor**，必須多 pump 一幀。

### T0.5 `RecordingIntegrityReason` 封閉詞彙與 pause fence 判準

**判準來源 = 現行乾淨 fixture 實測反推**（`research/fixtures/exports/*.json`，9 份，**13,262 ticks / 634 events**），不是憑空訂閾值：

| 觀測 | 結果 |
|---|---|
| tick `t` 非 finite | **0 / 13,262** |
| tick `t` 回退（`t[i] < t[i-1]`） | **0** |
| tick `dt` 相異值（逐檔） | **1**（每一檔都只有一個值） |
| tick `dt` 偏離 7.8125 超過 1e-9 | **0 / 13,253** ⇒ `dt` 是**逐位精確**的 7.8125（2 的冪，float 可精確表示） |
| event `t` 非 finite | **0 / 634** |
| event 落在 `[firstTick − tickMs, lastTick]` 之外 | **0** |
| event 相鄰回退（`t[i] < t[i-1]`） | **1 / 625 相鄰對**，最大 **0.2025 ms** |
| 回退 ≥ 一個 tick（7.8125 ms）者 | **0** ⇒ 一個 tick 的窗有 **38.6×** 餘裕 |

> ⚠️ **T0 抓到的最重要一件事：「events 必須單調遞增」的 validator 會當場拒收一份乾淨的正式 payload。**
> `counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json` 的 idx 67：`visible`(t=24287.00250) → `key`(t=24286.80000)，回退 0.2025 ms，而該檔 `meta.suspect=false`、`lateEventCount=`**0**。
> **所以它不是遲到事件**（`lateEventCount` 是既有的遲到構念，此處為 0）。機制在 [SimLoop.ts:703 `simStep()`](../../../../../src/loop/SimLoop.ts#L703)：`recordVisibleEvents(state, tickEndMs, recorder)` 在 `consume()` **之前**執行 ⇒ 同一個 tick 內，sim 蓋 `tickEndMs` 的事件會先入 `events[]`，然後才輪到蓋 DOM `event.timeStamp`（落在 `[tickStart, tickEnd)`）的輸入事件。**這是跨構念的時鐘混寫，不是亂序**，其上界恰為**一個 tick**。
> ⇒ event 軸的判準**必須**是「回退 < 一個 tick」，零容差會誤殺；tick 軸則相反，可以、也應該取 bit-exact。

**封閉詞彙（8 個，T1 起不得擴充，只能升版）**：

| # | `RecordingIntegrityReason` | 判準 | 乾淨語料命中 |
|---|---|---|---|
| 1 | `tick-non-finite` | 任一 `ticks[i].t` 非 finite | 0 |
| 2 | `tick-regression` | `ticks[i].t < ticks[i-1].t` | 0 |
| 3 | `tick-step-off-grid` | `ticks[i].t - ticks[i-1].t !== 1000/simHz`（**bit-exact，零容差**） | 0 |
| 4 | `event-non-finite` | 任一 `events[i].t` 非 finite | 0 |
| 5 | `event-out-of-window` | event `t` 落在 `[firstTick − tickMs, lastTick]` 之外 | 0 |
| 6 | `event-backward-step-exceeds-tick` | `events[i-1].t - events[i].t >= 1000/simHz`（**一個 tick 的窗**，見上方警告） | 0 |
| 7 | `pause-fence-unclosed` | pause／resume 次數不相等，或有 tick／gameplay event 的戳記落在某個 pause 區間內 | n/a（新構念） |
| 8 | `pause-attempt-overflow` | 該 attempt 曾 pause **且** `bufferOverflow` 或 `recorderOverflow` 為真（OQ-69.3） | n/a（新構念） |

**驗收條件（T1 必須綠）**：1–6 對現有 **9 份 fixture 全數放行**（命中數全 0，如上表）。7–8 只可能在 paused attempt 上命中，對零 pause 路徑恆為 false ⇒ NFR-69.1 不受影響。

### T0.6 OQ 關閉（2026-09-15，使用者拍板）

| OQ | README 預設 | **結論** | 後果 |
|---|---|---|---|
| **OQ-69.1** | 自動下載 | **推翻 ⇒ 只在結果頁提供手動下載鈕** | 見下方 ⚠️；README §1.4 已改寫；README §3 「invalid diagnostic auto-download 的容量成本」一條隨之失效 |
| **OQ-69.2** | 任何錄製中掉鎖都算 | **維持預設** | 與 [main.ts:1474](../../../../../src/main.ts#L1474) 既有 `pointerLockLost` 判準（`countdown`/`running`）**逐字同窗**，不新增第二套定義（C-D4） |
| **OQ-69.3** | paused attempt 上的 overflow 一律 discard | **維持預設** | 入封閉詞彙 #8；乾淨未 pause run 的 `suspect` 語意**逐位不動**，本 WP 不偷改全域品質政策 |

> ⚠️ **OQ-69.1 改選手動後，T0 先行查出一個會讓它直接失效的既有障礙**：
> `#result-screen` 是 `position:fixed; inset:0` 且 **`z-index:30`**（[ResultScreen.ts:76](../../../../../src/ui/ResultScreen.ts#L76)）；`#drill-controls` 是 `position:fixed; left:50%; bottom:16px` 且 **`z-index:32`**（[Controls.ts:65](../../../../../src/ui/Controls.ts#L65)）。⇒ **drill-controls 疊在 Result 之上**，Result 下緣置中一帶的按鈕會被蓋住、點不到。
> **對 T4 的硬性要求**：invalid 下載鈕不得放在 Result 面板下緣置中區，或必須置於 `z-index > 32`。
> **對 T6 的硬性要求**：e2e **不准只斷言按鈕存在**，必須斷言「真的點得到並取得檔案」；另注意 live 匯出的 `download` 事件**恆 timeout**（blob 立刻 revoke），需攔 `createObjectURL` + `dispatchEvent('click')`。
> **對產品的殘餘風險（明帳）**：手動鈕的代價正是 README OQ-69.1 原本點名的那一條——操作員不按就等於沒保留。T4 必須讓「本次無效、此檔僅供稽核」在 Result 上不可錯過。

### T0.7 Definition of Done 對帳

- [x] `progress.md §T0` 記錄 WP/GD 重查來源（T0.1）、最新 blast radius（T0.2）與 baseline 的命令/exit code/count（T0.3）
- [x] spike 以數值記錄 naive pause 與 mapped pause 的 tick/re-anchor 差異（T0.4）
- [x] `RecordingIntegrityReason` 與 pause fence 判準有封閉表格（T0.5，8 項），且現有 clean fixture **全數通過**（命中數全 0）
- [x] OQ-69.1～69.3 均有明確結論（T0.6），無「待實作再看」
- [x] production code diff 為空（本 commit 僅動 `docs/`）

### T0.8 Surprises

1. **`node_modules/` 是空的** —— 四個驗證閘一個都跑不起來，`npm ci` 後才有基線。
2. **re-anchor 的傷害延後一幀才可見**（T0.4），規劃期預期的 spike 斷言形狀會漏掉它。
3. **一份乾淨 fixture 裡有真的 event 回退**（T0.5），且**不是** `lateEventCount` 那個既有構念，而是 `simStep()` 內 sim 蓋 `tickEndMs` 早於 `consume()` 的跨時鐘混寫。零容差 validator 會誤殺正式資料。
4. **`#drill-controls`（z-index 32）蓋在 `#result-screen`（30）之上**（T0.6），正好打在 OQ-69.1 新選的手動下載鈕上。
5. **`TrackingPilotRunner` 現行唯一的 retry 路徑會強制先建立 payload**（T0.2），與 `discarded` 的「不得建立 payload」直接衝突 —— 比規劃期所述更強的「必須新增入口」理由。
