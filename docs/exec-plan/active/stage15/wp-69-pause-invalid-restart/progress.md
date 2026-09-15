# WP-69 — Progress

## Snapshot

- **狀態**：✅ **已交付**（2026-09-15，T-exit）。T0–T6 + T-exit 全數完成
- **分支**：`chore/agents-skills-tree`
- **規劃日期**：2026-09-15
- **下一步**：無阻塞項。⚠️ 跨 WP 遺留：[OQ-69.5](#open-questionst-exit-後)（CodeGraph 索引涵蓋範圍，屬工具層）
- **決策**：[GD-46](../../../DECISIONS.md#gd-46--wp-69-暫停後永久失去實驗效力時間戳不可信即丟棄只有整場-restart-可恢復資格2026-09-15-t-exit) ✅
- **T-exit 判定一句話**：FR-69.1～69.12 與 NFR-69.1～69.8 逐條有具名機械證據，無「完成但無證據」的列 ⇒ **✅ 完全交付、無具名缺口**（[D-69-TE-1](#d-69-te-1--交付判定為完全交付殘餘風險明帳保留而非關閉2026-09-15)）；本 gate 另修好三處文件不一致，其中 `operator-manual.md` 的 Esc 語意過期是操作員會實際踩到的（[§TE.6](#te6-本-gate-查出並修復的三處文件不一致)）

## Planning evidence

- 已依 `.claude/skills/engineering-planning/SKILL.md` 讀取 `CLAUDE.md`、exec-plan index/decisions、`CONTEXT.md`、design standards/template，以及直接上游 WP-65 與平行 schema WP-67。
- CodeGraph 規劃期辨識的高風險節點：`createSimLoop`（53 callers/test references）、`Clock`（43）、`DrillRunner`（9）、`createInputSampler`（2）、`HistoryPersistence`（單一 app caller），以及三個 runner 的完成/推進狀態機。
- 現況關鍵事實：`liveFrame()` 在 ended 後無條件 build payload/save/advance；`HistoryPersistence` 只排除 practice、不排除 suspect；`SimLoop` 對 >250 ms delta 會 re-anchor；`restartActiveDrill()` 已重建 sim/RNG 並清 recorder/UI，可作 full restart 單一核心。

## Task log

| Task | 狀態 | 證據 / 決策 / 意外 |
|---|---|---|
| T0 | ✅ | 2026-09-15。編號重查、blast radius、baseline 四閘、pause time spike、integrity 詞彙凍結、OQ-69.1～69.3 全關。production diff = 空。見 [§T0](#t0-entry-gate2026-09-15) |
| T1 | ✅ | 2026-09-15。`src/attempt/` 三模組 + 88 個新測試；9 份 clean fixture 全數放行；canonical digest 只動 3 筆（完全印證 D-69-T0-4）。見 [§T1](#t1-attempt-disposition-contract2026-09-15) |
| T2 | ✅ | 2026-09-15。`PausableTimeMapper` + main.ts 時鐘管線（mapped clock 注入 SimLoop）；50 個新測試；naive-pause 失敗模式固化成永久測試。四閘全綠 + Edge e2e 13 passed。見 [§T2](#t2-pausable-active-time2026-09-15) |
| T3 | ✅ | 2026-09-15。gameplay 閘（input + camera 共用）、`suspend()` release edge、`PauseOverlay`、Pointer Lock resume 倒數、Restart 收斂；61 個新測試 + 六刀 mutation 反證。四閘全綠 + Edge e2e 15 passed。見 [§T3](#t3-input--pointer-lock--overlay2026-09-15) |
| T4 | ✅ | 2026-09-15。`AttemptFinalizationGate`（consequence matrix）+ main.ts 五個消費點 + History 第二道防線 + Result 稽核下載 + PauseOverlay 作廢 view；76 個新測試 + 十二刀 mutation 全部見血；OQ-69.4 關閉。四閘全綠 + Edge e2e 15 passed。見 [§T4](#t4-finalization--persistence-gate2026-09-15) |
| T5 | ✅ | 2026-09-15。`describeAttemptHold()` + `TrackingPilotRunner.retryRunningBlock()` + `main.ts` 的 `holdOrchestratorsOnAttempt()` 單一接縫；33 個新測試 + 六刀 mutation 全部見血。四閘全綠 + Edge e2e 15 passed。見 [§T5](#t5-orchestrator-retry2026-09-15) |
| T6 | ✅ | 2026-09-15。真 Edge 4-case live E2E：Standalone Resume 成功/失敗、invalid diagnostic、forced discard；Session/BR Protocol/Pilot 同項 retry + clean advance。全量 3709 passed / 2 skipped；回歸 324；文件與 graph 更新。見 [§T6](#t6-live-edge--regression--docs2026-09-15) |
| T-exit | ✅ | 2026-09-15。production diff = 空。FR-69.1～69.12／NFR-69.1～69.8 逐條對到**逐字測試名**；gate caller 出口清單六類全數在閘後（CodeGraph 涵蓋不足，改以 grep 為權威，沿 D-68.T0-4）；全量閘 Vitest **3709 passed／2 skipped**、回歸 **324**、Edge full e2e **119 passed / 0 failed**（20.4m）、canonical 非預期 diff **0**。⚠️ 查出並修復三處文件不一致（operator manual 的 Esc 語意過期、MAP.md 缺入口、checklist T6 未翻）。見 [§T-exit](#t-exit-acceptance-gate2026-09-15) |

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
| D-69-T1-1 | **pause fence 以 active time 記錄，不是 wall time**（偏離 README §2.1 的 `atWallMs` 參數命名） | T1 採納（機械必然，見 §T1.3） |
| D-69-T1-2 | 非法轉換一律 no-op，不 throw（這些 method 直接掋在 UI 事件上） | T1 採納 |
| D-69-T1-3 | `finalize()` 先判 integrity 再判 validity；`discarded` 取凍結詞彙順序的第一個 reason | T1 採納（FM-7） |
| D-69-T2-1 | `pause()` / `resume()` 回傳 active ms（README §2.2 寫 `void`）；fence 的兩端由 mapper 給同一個 double，呼叫端不得自行重算 | T2 採納（見 §T2.3） |
| D-69-T2-2 | resume 後的映射錨在 `(wall, active)` 配對而非減去 offset：`(w − resumeWall) + resumeActive` 對**所有**可表示輸入在 `w === resumeWall` 逐位還原 | T2 採納（見 §T2.3） |
| D-69-T2-3 | mapper 對非 finite 輸入與 resume 的 wall 倒退 **throw**（不靜默夾住）；`mapWallTime` 本身**不**做單調性檢查，因為 T3 要用同一入口映射可能早於當前幀的 DOM `event.timeStamp` | T2 採納（見 §T2.5） |
| D-69-T2-4 | mapper 歸零放進 `resetRunPresentation()`（四條 full-restart 路徑的共同點），並以 source-scan 測試釘住「reset 之後必須 `buildSimLoop()`」的順序 | T2 採納 |
| D-69-T3-1 | `InputSampler.suspend(atWallMs)` 收 **wall** ms（README §2.3 寫 `atActiveMs`）；映射統一在 sampler 內部做，`releaseAds` 也一併改走 `mapEventTime` | T3 採納（見 §T3.3） |
| D-69-T3-2 | up edge 的採計條件改為「sampler 自己採計過對應的 down」，鍵盤因此與 fire/ads 對齊（新增固定長度 `heldKeys` 帳面）；gameplay 閘只擋 down/move | T3 採納（見 §T3.3） |
| D-69-T3-3 | `PointerLockHandle` 新增 `onError()`：`pointerlockerror` 不翻 `locked` ⇒ 不發 change 回撥，沒有它取鎖失敗在該模組內完全無聲 | T3 採納（見 §T3.4） |
| D-69-T3-4 | `runAttempt.restart()` 與 `timeMapper.restart()` 同放 `resetRunPresentation()` ⇒ 換武器／換 drill／換場景也會 attempt +1（不只 Restart 鈕） | T3 採納（見 §T3.6） |
| D-69-T4-1 | gate 的 `decide()` 回傳 **plan**（七個後果欄位）而非 bare `AttemptDisposition`（README §2.4 寫後者） | T4 採納（見 §T4.3） |
| D-69-T4-2 | **OQ-69.4 結論**：暫停中離開/切換一律 `discarded`，T4 不在導航前強迫 resume、不放寬 T0.5 判準 | T4 採納（見 §T4.5） |
| D-69-T4-3 | `finalizeAttempt()` 一場 memo 一次。memo 是**正確性**不是最佳化：收工後 recorder 與釋鎖事件還會動 | T4 採納（見 §T4.4） |
| D-69-T4-4 | 尚未結算的隨手匯出只有在 `pauseOccurred` 時才問 gate；從未暫停的路徑行為逐位不變（NFR-69.1） | T4 採納（見 §T4.6） |
| D-69-T4-5 | 稽核檔下載鈕放 Result **面板頂端警示條**，不進 `result-actions` footer（T0.6 的 z-index 硬性要求） | T4 採納 |
| D-69-T4-6 | `HistorySaveState.excluded.reason` 擴成 `'practice' \| 'invalid-attempt'`，且 invalid 優先於 practice | T4 採納 |
| D-69-T4-7 | `discarded` 用 `PauseOverlay` 的第五個 view 呈現，**不**用 Result —— Result 存在本身就代表「有一份結果」 | T4 採納 |
| D-69-T5-1 | Session／Protocol 不加 production 程式碼：`advancesOrchestrator` 一關就沒人呼叫 `advance()`／`completeCurrentCondition()`，再加一層 `if` 就是第二個判準（C-D4）。T5 對這兩者的交付是 held × clean 成對測試 | T5 採納（見 §T5.3） |
| D-69-T5-2 | pilot 的 held 入口是獨立的 `retryRunningBlock()`，不借 `abortCurrentBlock()`（它會 `advanceFromBlock()` 前進，FM-6），且刻意不重載 config —— full restart 是 `main.ts` 單一 coordinator 的職責 | T5 採納（見 §T5.5） |
| **D-69-TE-1** | **交付判定為「完全交付、無具名缺口」；殘餘風險（手動下載的人為風險、暫停中導航無稽核檔、不宣稱指標效度、`main.ts` 技術債）明帳保留於 GD-46 ⑨ 而非隨 gate 關閉** | **T-exit 採納**（見 [§D-69-TE-1](#d-69-te-1--交付判定為完全交付殘餘風險明帳保留而非關閉2026-09-15)） |
| D-69-TE-2 | gate caller 稽核以 **grep 為權威**，CodeGraph 僅作下界（索引涵蓋 98/228，三個核心交付檔零命中）；沿用 WP-68 的 D-68.T0-4，不因 CLAUDE.md 的「Trust codegraph results」而採信未涵蓋檔的空結果 | T-exit 採納（見 §TE.3） |

## Open Questions

OQ-69.1～69.3 已於 T0 全數關閉（見 [§T0.6](#t06-oq-關閉2026-09-15使用者拍板)）；**OQ-69.4 已於 T4 關閉**（見 [§T4.5](#t45-oq-694-的結論暫停中離開就是-discardedd-69-t4-2)）。**本 WP 範圍內零遺留**；T-exit 另開的 **OQ-69.5 屬工具層、非本 WP**（見 [§Open Questions（T-exit 後）](#open-questionst-exit-後)）。

| ID | 問題 | 提出 | 歸屬 |
|---|---|---|---|
| **OQ-69.4** ✅ | 「正在 paused 時離開/切換 drill」依 T0.5 凍結判準會得到 `discarded`（fence 未閉合）——但 pause 之前的時間軸其實是可證的。T4 要不要在導航前先要求 resume（才能拿到 `invalid-retained` 稿核檔），還是接受直接 discard？ | T1（2026-09-15） | **T4 已答：接受 discard**（§T4.5） |
| **OQ-69.5** 🟡 | CodeGraph 索引只涵蓋 `src/` 228 個非測試 `.ts` 中的 98 個，`sync` 卻回「Already up to date」；WP-68 T0 與本 gate 已兩度改用 grep。要修工具設定，還是改 CLAUDE.md 的「Trust codegraph results」指示？ | T-exit（2026-09-15） | **非本 WP**（工具層），留給使用者決定 |

> T1 本身不替 OQ-69.4 做決定：實作上**逐字執行 T0 凍結的判準**（pause/resume 次數不相等 ⇒ `pause-fence-unclosed`），不在實作期悔放寬。


---

## T-exit acceptance gate（2026-09-15）

> 交付物 = **證據**，不是程式碼。本 gate 的 production diff 為空；唯一的 source 變更是文件與索引。
> 判定一句話：**FR-69.1～69.12 與 NFR-69.1～69.8 逐條有具名機械證據，無「完成但無證據」的列 ⇒ 判定為 ✅ 完全交付**（[D-69-TE-1](#d-69-te-1--交付判定為完全交付殘餘風險明帳保留而非關閉2026-09-15)）。本 gate 另查出並修好**三處文件不一致**（§TE.6），其中一處是操作員會實際踩到的行為描述過期。

### TE.0 本 gate 的驗證環境（所有數字的前提）

| 項 | 值 |
|---|---|
| git SHA（gate 起跑時） | `4bc2fdf1dd06ff128398ef2cb00cfb383abd5465` |
| branch | `chore/agents-skills-tree`（working tree 起跑時 clean） |
| 瀏覽器 | Edge **`149.0.7827.55`**（Playwright `channel: 'msedge'`，`--project=edge`，真 GPU） |
| `crossOriginIsolated` | **`true`**（e2e 內實測，非推論） |
| e2e worker | `--workers=1`（KI-030 的多 worker flakiness 不入本 gate 的判讀） |
| dev/preview server | `5173`／`4173`，history root 走 `.playwright-tmp/history-*`（與 T4/T5/T6 同） |
| Pointer Lock / display | 真 `document.exitPointerLock()` 觸發 pause（非合成事件）；真 GPU（`metadata.realGpu: true`），非 SwiftShader |

**本 gate 的 live 實測值**（四條 WP-69 case 的機器可讀輸出，非目視）：

| 量 | 值 |
|---|---|
| Standalone：pause 前後 `tickCount` | **390**（前後相同）；`fireCount` **0**；`fenceCount` **1** |
| Standalone：resume | 排除 wall time **3313.41 ms**；`lockConfirmationCount` **1** |
| Standalone：Restart 後 attempt | **3** |
| Standalone：強制 discard | `bufferOverflow` **9488** → `{kind:'discarded', reason:'pause-attempt-overflow'}`；`recording` 四欄全 **0**；Result 隱藏；下載數 **1**（就是那份稽核檔） |
| Standalone：稽核檔 | 恰一份 `tracking_scene_v1-2026-09-15T15_56_24.338Z.invalid-paused.json`（marker 只出現一次） |
| Session Plan | held cursor **0** → clean retry attempt **3**，正式下載 **1**（檔名不含 `.invalid-paused`） |
| BR Protocol | held condition **0**、`exportCount` **1** → clean retry 後 condition **1**，正式下載 **1** |
| Tracking Pilot | audit 一筆 `{blockIndex:0, role:'practice', previousAttempt:1, disposition:{kind:'discarded', reason:'pause-fence-unclosed'}}`；`recordCount` **1**、正式下載 **1** |

> ⚠️ **`tickCount` 為 390，T6 記的是 397——這不是回歸。** 該值是「操作員在第幾個 tick 按下暫停」的實時結果，隨真瀏覽器的排程抖動而變；本案例斷言的是**pause 前後兩次讀數相同**（凍結）與 `fireCount` 新增為 0，不是某個固定 tick 數。真正逐位的 determinism 斷言在 NFR-69.1／69.8 的 Vitest 側（`Object.is`），不靠 live 數字。

### TE.1 Functional acceptance matrix（A-69.1～A-69.12 ≡ FR-69.1～69.12）

> 「檔案」欄的測試以 `npx vitest run <file>` 執行（exit 0）；live 欄以 `npx playwright test --project=edge --workers=1` 執行（exit 0）。
> Live 欄只填**真 Edge 實測值**；空白代表該條沒有 live 面，不是沒有證據。

| FR | 具名斷言（測試名逐字） | 檔案 | Live 證據 |
|---|---|---|---|
| **69.1** 錄製相位掉鎖即凍結 | `running 掉鎖 → paused + invalid-paused`；`{1,10,300}s pause: every frame returns ticks=0 and nothing advances` | `wp69-pause-lifecycle.test.ts`、`wp69-pause-time.test.ts` | pause 前後 `tickCount` 固定 **390**、`fireCount` 新增 **0** |
| **69.2** 第一次 pause 即 sticky | `invalidates on the first pause`；`does not restore eligibility when {the resume request starts, Pointer Lock is re-acquired, the resume countdown completes}`（三條）；`exposes no mutator that clears validity other than restart()`（窮舉）；`resume 完成後 validity 仍是 invalid-paused` | `RunAttemptController.test.ts`、`wp69-pause-lifecycle.test.ts` | Resume 完整跑完後仍產出 `.invalid-paused` 檔 |
| **69.3** armed/idle/ended 不算 pause | `%s 掉鎖不 pause、不失效（FR-69.3：開場釋鎖脈衝與收工釋鎖維持乾淨）` —— `it.each(['armed','idle','ended'])` 三相位，與 `running 掉鎖 → paused + invalid-paused` 同一個 rig 對照 | `wp69-pause-lifecycle.test.ts` | 開場取鎖脈衝未觸發 overlay |
| **69.4** overlay 文案與兩顆鈕、同步 request | `成功：click → 一次 request → locking → 取鎖 → 倒數 → active`；`beginPause 把 mapper 的回傳值直接餵給 fence，再補 release edge` | `wp69-pause-lifecycle.test.ts`、`PauseOverlay.test.ts` | overlay 實際出現「本次已失去實驗效力」 |
| **69.5** resume 倒數取自 drill、失敗可重試 | `resume 倒數長度取自該 drill 的 timing.countdownMs（不另立常數）`；`error（pointerlockerror）：留在 paused 並帶可重試訊息`；`request rejection：同樣留在 paused 並帶訊息（第二條收斂路徑）`；`失敗後可以再按一次「繼續」並成功（不會卡在沒有出口的畫面）` | `wp69-pause-lifecycle.test.ts` | rejection → retry → lock → 完整倒數；`lockConfirmationCount` = **1** |
| **69.6** full restart 建新 attempt | `attempt +1、validity fresh、fence 清空、mapper 回 identity`；`clears pause state, validity and fences, and increments the attempt`；`replays the same tick-index states after a pause, resume and full restart` | `wp69-pause-lifecycle.test.ts`、`RunAttemptController.test.ts`、`wp69-pause-time.test.ts` | Restart 後 attempt = **3** |
| **69.7** 三態 | `eligible-candidate keeps every existing path open and clears nothing`；`states every consequence on every row (a new field cannot default itself in)`；三態呼叫矩陣三條 | `AttemptFinalizationGate.test.ts`、`wp69-finalization.test.ts` | 三態在 live 各出現至少一次 |
| **69.8** invalid-retained 的檔名與禁區 | `invalid-retained：payload 與 metrics 有，history／replay／advance／正式下載全為 0`；`invalid-retained 收工當下不產生任何檔；按下去才有，且檔名帶 .invalid-paused`；`is idempotent — double-marking cannot happen` | `wp69-finalization.test.ts`、`AttemptFinalizationGate.test.ts` | 手動下載恰一份 `*.invalid-paused.json` |
| **69.9** discarded 無 payload | `discarded：payload builder 一次都沒被呼叫，recorder 被清空（FR-69.9／FM-7）`；`discarded 清空後不再 pump，避免後續 rAF 把 ended ticks 寫回 recorder`；`discarded 連稽核檔都沒有（沒有 payload 就沒有檔）` | `wp69-finalization.test.ts` | 強制 overflow = **9488**；`recording` 全歸零、下載不增、Result 隱藏 |
| **69.10** 三 runner 停在同一步 | Session：`paused 時直接 Restart 仍 hold 同一個 step，且不下載` ＋ `連續兩次 pause + restart：step 仍不動，attempt 走到 3`；Protocol：`paused 時直接 Restart 仍 hold 同一個 condition，且 exports[] 不長` ＋ `最後一個 condition 被 held 時不觸發 protocol complete（整份 protocol 仍未完成）`；Pilot：`paused 時直接 Restart 仍先 audit discarded，且同一 block 只增加一次 attempt` | `wp69-orchestrator-retry.test.ts` | 三條 live case（Session cursor、Protocol condition/export、Pilot audit）各自 held → clean retry |
| **69.11** 兩個構念不合併 | `round-trips a payload that self-reports the pause`；`parses a pre-WP-69 payload that omits the flag, defaulting it to false (optional-in)`；`rejects a non-boolean flag (optional-in is not lenient-in)`；WP-65 的 `pointerLockLost` 三條同型測試仍全綠 | `exportPayloadSchema.test.ts`、`metadata.test.ts` | 錄製中掉鎖的 live payload 兩旗標同時 true |
| **69.12** navigation 不可繞過 gate | `暫停中換 drill/scene/weapon：先過 gate 得到 discarded，再由 restart 清乾淨`；`resetRunPresentation 在 runAttempt.restart() 之前先結算暫停中的 attempt（FR-69.12）`；`從未暫停的導航不觸發 finalization（乾淨路徑零新增工作，NFR-69.1）` | `wp69-finalization.test.ts` | WP-66 scene roundtrip 必須先等真 pause event、再按真 Restart 才可換場景 |

### TE.2 Non-functional acceptance matrix（NFR-69.1～69.8）

| NFR | 具名斷言 | 檔案 | 判讀 |
|---|---|---|---|
| **69.1** 零 pause 逐位不變 | `{30,60,144,240} FPS: mapped and unmapped traces are Object.is identical, tick for tick`（四條）；`overlay 恆為 hidden、mapper 恆為 identity、attempt 恆為 eligible-candidate`；`從未暫停的導航不觸發 finalization`；`standalone drill 的 held attempt 不寫任何 orchestrator 狀態列` | `wp69-pause-time.test.ts`、`wp69-pause-lifecycle.test.ts`、`wp69-finalization.test.ts`、`wp69-orchestrator-retry.test.ts` | `Object.is` 而非 `toBeCloseTo` ⇒ 逐位，非近似 |
| **69.2** pause 零 tick、resume 無 catch-up | `every frame returns ticks=0 and nothing advances`；`a sub-tick resume frame produces at most one tick (T2 DoD)`；`reproduces the T0.4 naive-pause failure — the reason the mapper exists` | `wp69-pause-time.test.ts` | ⭐ 最後一條是**負向對照**：naive pause 的 32-tick catch-up 與 2766.667 ms re-anchor 被固化成永久測試，mapper 若被拆掉會立刻紅 |
| **69.3** resume 後時間軸連續 | `a pause is invisible in the output: mapped equals a never-paused run, tick for tick`；`a 300 s pause is equally invisible — length does not matter, only the mapping`；`holds 128 Hz across three pause cycles and stays exactly on the tick grid` | `wp69-pause-time.test.ts` | 三個 pause cycle ⇒ 不是只證單次 |
| **69.4** pause／倒數期零偷跑 | `pause 期間 ring 寫入、camera delta、fire 與 tick 全部零新增`；`resume 倒數期間（鎖已拿回來）仍零新增 —— 只有這個閘擋著（FM-5）`；`pause 邊界補送 release edge，held 狀態不殘留（sim 消費後全部 false）`；`倒數完成後 camera 與 ring 立刻恢復（閘不是 sticky，sticky 的是 validity）` | `wp69-pause-lifecycle.test.ts` | 第四條反證 input 閘**不是** sticky —— sticky 的只有 validity |
| **69.5** 熱路徑零配置 | `never reaches for {performance.now(), Date.now(), Math.random(), document, window}`（五條，註解先剝除再掃）；`跑遍含 discarded 的全部 view 三輪，零新增 DOM node`；`跑完所有 view 轉換後 createElement 呼叫數不變` | `pausableTimeMapper.test.ts`、`PauseOverlay.test.ts` | overlay 以 `createdCount` 機械計數，非目視 |
| **69.6** 純 TS DOM + 實機 Pointer Lock | `src/attempt` 零 DOM／Three／sim／`SharedState`／research／`node:*` import 且零 `Date.now()`／`Math.random()`／`performance.now()`（掃 raw source）；live e2e 覆蓋 resume **失敗**與**成功**兩路 | `architecture.test.ts`、`wp69-pause-invalid-restart.spec.ts` | 零框架；Pointer Lock user gesture 只在 Edge 實機成立 |
| **69.7** 零呼叫反證 | `never lets a non-eligible attempt reach history, replay or an orchestrator advance`；`savesHistory 為假時連 historyPersistence.save() 都不呼叫（第一道防線）`；`advancesOrchestrator 的閘早於三個 runner 的推進呼叫（FM-6）`；三態呼叫矩陣三條 | `AttemptFinalizationGate.test.ts`、`wp69-finalization.test.ts` | unit（spy 計數）＋ live（下載檔名清單）兩層 |
| **69.8** restart parity | `replays the same tick-index states after a pause, resume and full restart`；`pairs every resetRunPresentation() call with a buildSimLoop() right after it` | `wp69-pause-time.test.ts` | 第二條釘住順序：先歸零 mapper、後重建 loop |

### TE.3 Gate caller 稽核（T-exit 步驟 2）

⚠️ **CodeGraph 對本問題再次不可採信，沿用 [D-68.T0-4](../../stage13/wp-68-micro-flick-v9-measurement-parity/progress.md) 的處置。** 本 gate 實測 `codegraph_status` 回 **156 files / 4390 nodes**，其中 `src/` 僅 **98** 檔（repo 實有 **228** 個非測試 `.ts`）；WP-69 的三個核心交付檔（`RunAttemptController`／`AttemptFinalizationGate`／`recordingIntegrity`）在索引中**零命中**，而 `codegraph sync .` 回「Already up to date」。⇒ 屬**涵蓋範圍缺口**而非 staleness，與 WP-68 T0 觀察到的是同一現象、隔一個 WP 再度複現。**本節結論以 grep over `src/ tests/ scripts/` 為權威**（CLAUDE.md 的「Trust codegraph results」在索引未涵蓋該檔時不適用）。

**出口清單（每一條會產生後果的路徑都必須在閘之後）**：

| 出口 | production call sites | 閘 |
|---|---|---|
| 建 payload | `buildCurrentExportPayload()` | `if (!plan.buildsPayload) return;` —— source-scan 釘住它早於 payload builder，且整個 gate 早於第一個 `await` |
| 正式下載 | `main.ts` 6 處 `downloadJSON` ＋ 2 處 `downloadCSV` = **8**（測試逐條列舉，第 9 處即紅） | 面板 4 顆鈕走 `requireOfficialExport()` 且早於建 payload；收工自動下載與 pilot block 匯出在 `advancesOrchestrator` 之後 |
| 稽核下載 | 1 處，且是唯一帶 `invalidAttemptBasename()` 的一處 | `plan.download !== 'diagnostic-manual'` 直接拒絕 |
| 歷史保存 | `historyPersistence.save()` 2 處 | 第一道：`savesHistory` 為假則**根本不呼叫**；第二道：`HistoryPersistence` 讀 `payload.meta.validity?.pauseOccurred === true` → `excluded: 'invalid-attempt'` |
| Orchestrator 前進 | `handleDrillEnded()`／`sessionPlanRunner.advance()`／`completeActiveProtocolCondition()` | 三者都在 `if (!plan.advancesOrchestrator) return;` **之後** |
| Pilot hold | `handleInvalidAttempt()` → `retryRunningBlock()` | `abortCurrentBlock()` **不在** hold 路徑上（它只由 operator harness 的主動 Abort 觸發，語意不同，FM-6） |

`HistoricalRunDetail.ts` 的 `downloadJSON` 讀的是**已存進 History 的別人的 payload**，而 invalid attempt 依上表兩道防線根本進不了 History ⇒ 不構成第 9 個出口。

**符號參照數（grep，`src/ tests/ scripts/`，格式「檔數（production 檔數）」）**：`finalizeAttempt` 2（1）、`holdOrchestratorsOnAttempt` 3（1）、`requireOfficialExport` 2（1）、`createAttemptFinalizationGate` 5（2）、`planFinalization` 4（2）、`createRunAttemptController` 8（2）、`createPausableTimeMapper` 6（2）、`evaluateRecordingIntegrity` 3（2）、`invalidAttemptBasename` 4（2）、`describeAttemptHold` 4（2）。**每一個 production 消費點都恰是「1 個 app 接縫 ＋ 1 個模組自身」** ⇒ 無第二套判準（C-D4）。

### TE.4 全量閘（T-exit 步驟 3）

| 閘 | 命令 | exit | 計數 | 對比 T6 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.10s`（chunk >500 kB 為既有警告） | 同 |
| 全量單元 | `npx vitest run` | **0** | **3709 passed / 2 skipped**；檔案 **284 passed / 1 skipped** | **逐數相同** |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |
| WP-69 觸及面 focused | 本 WP 動過的 20 個單元檔 | **0** | **664 passed**（20 files） | — |
| Edge full e2e | `npx playwright test --project=edge --workers=1` | **0** | **119 passed / 0 failed**（20.4m） | **逐數相同**（T6 亦為 119/119） |
| canonical fixture 非預期 diff | `exportPayloadSchema.test.ts` 8 筆逐筆 | **0** | 8/8 `serializes … unchanged` | 同 |

### TE.5 Schema／fixture／parity／call-matrix（T-exit 步驟 4）

1. **Canonical digest**：`CANONICAL_DIGEST_BEFORE_T5` 8 筆全部 `serializes … unchanged`（逐筆具名測試）。D-69-T0-4 的預測「只動帶 `meta.validity` 父物件的 3 筆」在 T1 實測**完全命中**（`09_18_05`／`09_24_18`／`09_37_24`），其餘 5 筆逐位不變；T2～T6 再無移動。**「第 4 筆變動即 bug，回頭修程式不准改表」的守衛仍在表上。**
2. **Zero-pause digest**：NFR-69.1 的四條 FPS identity 測試 ＋ `tests/regression` 324 逐數不變 ⇒ 未 pause 路徑對本 WP 不可觀測。
3. **Invalid／discard call matrix**：三態各一條具名測試，斷言的是**呼叫次數**（spy）而非從結果反推狀態；`invalid-retained` 的 history／replay／advance／正式下載四者皆 **0**，`discarded` 連 payload builder 都 **0**。
4. **Same-seed restart parity**：`replays the same tick-index states after a pause, resume and full restart`（NFR-69.8），配 `pairs every resetRunPresentation() call with a buildSimLoop() right after it` 釘住順序。
5. **WP-67 對帳（FM-9）**：`wp-67` 仍 T0～T-exit 全 ⬜、production 零落地 ⇒ 無 rebase 衝突，兩案 digest 影響面互斥的 T0 結論維持有效。

### TE.6 本 gate 查出並修復的三處文件不一致

> 這三處都不是程式缺陷，但第 1 項會讓操作員在現場做錯事，因此不列為 nit。

1. ⭐ **`operator-manual.md` 仍在描述 WP-69 之前的 Esc 語意。** §4.4 的受測者操作表寫「**Esc**｜解除滑鼠鎖定」，§8.3 故障排除只有 fullscreen/suspect 一列 —— 整份操作手冊沒有任何一個字提到「錄製中掉鎖 = 暫停 ＋ 本次永久作廢」。而 `operator-manual.md` 正是 CLAUDE.md §2 指定給操作人員的**唯一入口**。⇒ 一位只讀操作手冊的施測助理，會在受測者按 Esc 後以為「再點一下取回鎖就好」，然後把一份 `invalid-retained` 當成正式資料交出去。**已修**：§4.4 補 Esc 後果與對受測者的事前說明，§8.3 補三列（已暫停／`invalid-retained` 結果頁／`discarded` 作廢面板），皆指向 `operational/pause-invalid-restart.md`。
2. **`docs/MAP.md` 沒有 `operational/pause-invalid-restart.md` 的入口。** T6 新增的操作文件只從 `CONTEXT.md` 與 tracking pilot runbook 可達，而 MAP.md 是 CLAUDE.md §2 指定的「先看這個」。⇒ **已修**：新增 `## Operational Pause / Attempt-Validity Entry` 區塊。
3. **`task-checklist.md` 的 T6 box 沒有跟著 T6 commit 翻。** T6 已於 `4bc2fdf` 落地且 progress.md 記為 ✅，但 checklist 仍是 ⬜ —— 違反 CLAUDE.md §3 第 4 條。⇒ **已修**：T6 與 T-exit 兩格一併翻 ✅。

### TE.7 Definition of Done 對帳

- [x] **FR-69.1～69.12 與 NFR-69.1～69.8 無任何「完成」但無證據的列** —— §TE.1／§TE.2 每一列都填**逐字測試名**（不是「有測試覆蓋」這種宣稱），live 欄只填真 Edge 實測值。
- [x] **invalid/discarded 對正式保存、trend、threshold、advance 的零呼叫有 unit + live evidence** —— unit：三態呼叫矩陣（spy 計數）＋ `never lets a non-eligible attempt reach history, replay or an orchestrator advance`；live：三條 orchestrator case 的 held × clean 成對比較（沒有 clean 那一半，「不變」斷言會在 rig 根本沒跑起來時也全綠）。
- [x] **timestamp corrupt 案例證明 payload/metrics/download/replay 均未建立** —— `discarded：payload builder 一次都沒被呼叫`（builder 本身是 spy，不是事後檢查產物）＋ live 強制 overflow 後 `recording` 全歸零、Result 隱藏、下載數不增。
- [x] **full restart 同 seed/input fresh-run parity 通過，且只 clean retry 能前進** —— NFR-69.8 parity 測試 ＋ 三 runner 的 held／clean 成對。
- [x] **全量驗證綠；任何 skip/替代證據有 owner、原因與後續處置** —— §TE.4。全量單元的 **2 skipped tests / 1 skipped file** 具名為 `tests/history/historyRepository.perf.test.ts` 的 `describe.skipIf(!RUN_BENCHMARK)`（WP-48 的 opt-in 5,000-run benchmark，commit `9314d84`）：owner = WP-48／NFR-48.2-48.3，原因 = 需顯式環境變數才跑的效能基準，後續處置 = 無（設計上就不在預設閘內）。與 T0 baseline、T6 **逐數相同**，本 WP 未新增任何 skip。
- [x] **GD-46、README index、stage index、task checklist、progress 狀態一致** —— GD-46 翻 ✅ 並補 ⑧ 實作證據 ＋ ⑨ 殘餘風險；exec-plan README（stage 15 標題 ＋ WP-69 狀態格）、stage15 README、WP-69 README（狀態／決策／T-exit 列）、task-checklist、本檔五處同步。

### TE.8 OQ／風險／技術債的結清狀態（沒有靜默遺留）

| 項 | 狀態 | 處置 |
|---|---|---|
| OQ-69.1／69.2／69.3 | ✅ T0 關閉 | 69.1 被使用者推翻為手動下載；殘餘風險「不按即未保留」入 GD-46 ⑨(a) |
| OQ-69.4 | ✅ T4 關閉 | 暫停中導航 = `discarded`；代價「連稽核檔都沒有」入 GD-46 ⑨(b) 與操作手冊 |
| FM-1～FM-9 | ✅ 九條各有機械證據 | FM-1 有負向對照測試；FM-2 有兩道防線；FM-3 `DrillPhase` diff 為零；FM-4～FM-8 見 §TE.1／TE.2；FM-9 見 §TE.5 #5 |
| 技術債：`main.ts` god node | 🟡 **仍在帳** | 本 WP 只抽三個可測模組，未重構 bootstrap（README §3 明載，GD-46 ⑨(d) 重申） |
| 技術債：CodeGraph 涵蓋範圍缺口 | 🟡 **仍在帳，跨 WP** | 第二次複現（WP-68 T0 → WP-69 T-exit）。屬工具層而非本 WP 標的；影響是每個 gate 都得改用 grep ⇒ 見 [OQ-69.5](#open-questionst-exit-後) |

### D-69-TE-1 — 交付判定為「完全交付」，殘餘風險明帳保留而非關閉（2026-09-15）

**判定**：WP-69 ✅ 完全交付，**無具名缺口**。

理由：20 條 FR／NFR 全部有逐字可執行的斷言，且最關鍵的三條（零 pause identity、pause 零 tick、restart parity）用的是 `Object.is` 逐位比對而非近似；零呼叫類需求同時有 spy 與真瀏覽器兩層反證；三個最容易退化的接縫（gate 早於 payload、gate 早於第一個 `await`、hold 早於 `buildsPayload` 分岔）各有 source-scan 測試釘住**順序**而非只釘存在。

**但「完全交付」不等於「沒有代價」**：GD-46 ⑨ 的四項（手動下載的人為風險、暫停中導航無稽核檔、不宣稱任何指標效度變化、`main.ts` 技術債）是**設計後果**，刻意寫進決策帳本而不是隨 T-exit 一起關掉。特別是第三項 —— 本 WP 決定的是「這一場能不能被採納」，**沒有**放寬任何既有 eligibility／quality gate，`eligible-candidate` 距離 accepted 還隔著全部既有閘（C-D3）。

**Alternatives considered**：(a) 把殘餘風險一併標成「已處理」⇒ 帳本會看起來更乾淨，但下一個讀者會以為稽核檔是自動保存的，駁回；(b) 因 CodeGraph 涵蓋缺口而判為「部分交付」⇒ 那是工具層問題且已有 grep 權威來源與 WP-68 先例，與本 WP 的交付內容無關，駁回。

### Open Questions（T-exit 後）

| ID | 問題 | 歸屬 |
|---|---|---|
| **OQ-69.5** 🟡 | CodeGraph 索引只涵蓋 `src/` 228 個非測試 `.ts` 中的 98 個，且 `sync` 回「Already up to date」而非報告缺口；WP-68 T0 與 WP-69 T-exit 已兩度因此改用 grep。這是工具設定問題（涵蓋範圍／ignore 規則），但它讓 CLAUDE.md「Trust codegraph results — 不要再用 grep 覆驗」這條程序指示在**目前狀態下是錯的**。要修工具設定，還是改 CLAUDE.md 的指示？ | **非本 WP**（工具層）。留給使用者決定要開獨立 chore 還是改協定；在此之前，凡結論依賴完整 caller 列舉者一律以 grep 為權威 |

### TE.9 Surprises

1. ⭐ **操作手冊沒跟上（§TE.6 #1）。** T6 寫了一份完整的 `operational/pause-invalid-restart.md`，也更新了 `CONTEXT.md`、`schema.md` 與 tracking pilot runbook —— 唯獨漏掉 `operator-manual.md`，而那是**唯一一份給非工程師讀的文件**。教訓：新增一份深度操作文件時，「有沒有人從操作員入口走得到它」是**獨立的一問**，不會因為深度文件寫得好而自動成立。
2. **`task-checklist.md` 的 box 與 commit 脫節（§TE.6 #3）。** T6 的 progress、README 狀態、commit 全都對，只有 checklist 沒翻。這類單點漏翻不會被任何測試抓到，只會被下一個 gate 抓到 —— 這正是 T-exit 步驟 5 存在的理由。
3. **`DECISIONS.md` 的寫入慣例與實務不符。** §寫入慣例 寫「解決時…整條移到 §3」，但 GD-40／41／42／45 四條 ✅ 全部留在 §2。本 gate 依**實務**（與相鄰的 GD-45 一致）處理 GD-46，未移到 §3；慣例文字與實務何者為準未擅自改動，記於此供後續決定。
4. **CodeGraph 第二次失準（§TE.3）。** WP-68 T0 已下過 D-68.T0-4，本 gate 獨立複現且範圍更明確（98/228，三個核心交付檔零命中）。第二次出現代表這不是偶發 ⇒ OQ-69.5。

---


## T6 live Edge + regression + docs（2026-09-15）

### T6.1 交付與真瀏覽器量測

- 新增 `tests/e2e/wp69-pause-invalid-restart.spec.ts` 四條真 Edge lifecycle；瀏覽器為 Edge
  `149.0.7827.55`，`crossOriginIsolated=true`。
- Standalone 真 `document.exitPointerLock()` 後：pause 前後 tick 固定為 **397**、fire 新增 **0**、pause
  fence **1**；Resume request rejection 仍留在 pause，下一次取鎖成功後完整倒數；排除 wall time
  **3419.42 ms**，lock confirmation **1**。Restart 後 attempt = **3**；強制 10,000 keyboard
  events 得到 overflow **9488**，`discarded` 不下載；完整 invalid run 手動下載恰一份
  `*.invalid-paused.json`。
- Session Plan：paused Restart 後 cursor = **0**；clean retry attempt = **3**，正式下載 **1**。
- BR Protocol：paused Restart 後 condition = **0**、export count = **1**；clean retry 後 condition = **1**，
  正式下載 **1**。
- Tracking Pilot：同一 block 先 audit 一筆 `discarded/pause-fence-unclosed`（previousAttempt = **1**），
  clean retry 後 records = **1**、正式下載 **1**，才前進。

Live E2E 同時抓到三個只會在整合層露出的缺口並固定成回歸：paused navigation 原先會在 orchestrator
audit 前清掉 attempt；discarded 收工後下一個 rAF 又會把 recorder 填回；WP-66 的 scene roundtrip probe
在 running 時主動釋鎖，現在必須等真正的 pause event，再按真 Restart 才可換場景。

### T6.2 A-69 acceptance evidence

| Acceptance | 證據 |
|---|---|
| A-69.1 pause 凍結 active time/sim | Edge `tickCount=397` 不變；`wp69-pause-time.test.ts` 的「active time is frozen for the whole pause」與 30/60/144/240 FPS matrix |
| A-69.2 pause 後 sticky invalid | Edge Resume 完成後仍產生 `.invalid-paused`；`wp69-pause-lifecycle.test.ts`「resume 完成後 validity 仍是 invalid-paused」 |
| A-69.3 只有 running 掉鎖才 pause | `wp69-pause-lifecycle.test.ts` 的 running 與 `armed/idle/ended` table tests |
| A-69.4 pause UI 與 input/fire 封鎖 | Edge `fireCount=0`、tick 不增；`PauseOverlay.test.ts` 與 lifecycle 的 pause/countdown 零新增 tests |
| A-69.5 Resume 失敗、成功與倒數 | Edge 同一案例實測 rejection → retry → lock → countdown；lifecycle 的 Resume 三路 tests |
| A-69.6 full Restart 建 fresh attempt | Edge attempt = 3；`wp69-pause-time.test.ts` same-seed restart parity 與 lifecycle restart test |
| A-69.7 三態 consequence matrix | `wp69-finalization.test.ts`「三態的呼叫矩陣」：eligible / invalid-retained / discarded |
| A-69.8 invalid diagnostic | Edge 手動下載恰一份 `.invalid-paused`；finalization 的「稽核檔只有手動一條路」tests |
| A-69.9 integrity fail discard | Edge overflow = 9488、下載 0、recorder 清空；finalization discarded 與 post-clear pump tests |
| A-69.10 runner hold/retry | 三條 Edge Session/Protocol/Pilot cases；`wp69-orchestrator-retry.test.ts` held × clean pairs |
| A-69.11 schema 可區分 pause 與 suspect | `schema.md` 的 `pointerLockLost` / `pauseOccurred`；metadata/schema Vitest 覆蓋，`suspect` 保持獨立 |
| A-69.12 navigation 同一 gate | Edge scene roundtrip；finalization/orchestrator source tests 釘住 restart 前 finalize + hold |

### T6.3 Exit gates

| Gate | 結果 |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run build` | ✅ 208 modules，2.04 s（只有既有 chunk warning） |
| `npx vitest run` | ✅ 284 files passed / 1 skipped；3709 tests passed / 2 skipped |
| `npx vitest run tests/regression` | ✅ 33 files / 324 tests passed |
| focused WP-69 Vitest | ✅ 16 files / 396 tests passed |
| focused Edge WP-69 | ✅ 4/4，3.8 min |
| full Edge，`--workers=1` | ✅ **119/119**，22.2 min |
| canonical fixture unexpected diff | ✅ 0 |
| `npm run graph:update` | ✅ AST graph 更新 |

操作語意已寫入 `CONTEXT.md`、`docs/operational/schema.md`、
`docs/operational/pause-invalid-restart.md`，並在 tracking pilot runbook 加上同 block retry/audit 規則。

## T5 orchestrator retry（2026-09-15）

> 交付物 = 三個 orchestrator 在 held attempt 之後的**外顯**行為：一句共用文案、pilot 的重跑入口與
> audit、以及 `main.ts` 那一個把三者接起來的接縫。**T4 已經讓它們不會前進**（`advancesOrchestrator`
> 早退）；T5 補的是另一半——操作員看得到「這一項還沒完成」，pilot 記得住「第幾次、為什麼」。

### T5.1 交付檔案

| 檔案 | 內容 | 測試數 |
|---|---|---|
| `src/attempt/AttemptFinalizationGate.ts` | `describeAttemptHold(plan)`：三 runner 共用的**一句話**，`null` = 可前進 | +5 |
| `src/session/TrackingPilotRunner.ts` | `HeldAttemptDisposition`、`TrackingPilotInvalidAttempt`、`invalidAttempts`、`retryRunningBlock()` | +5 |
| `src/pilot/trackingPilotSession.ts` | `handleInvalidAttempt()`——與 `handleDrillEnded()` 互斥的第二條路 | +2 |
| `src/attempt/__tests__/wp69-orchestrator-retry.test.ts` | 三 runner 真模組整合 rig（held × clean 成對）+ `main.ts` source-scan | 21 |
| `src/main.ts` | `holdOrchestratorsOnAttempt()` + 收工分支的一行呼叫（見 T5.2） | — |

### T5.2 main.ts 的接點（唯讀清單，便於 T6 接手）

| 接點 | 位置 | 作用 |
|---|---|---|
| `holdOrchestratorsOnAttempt(plan)` | T4 finalization 區塊末尾 | held attempt 的**唯一**處置點；三 runner 都不自己重算 disposition |
| `if (!plan.advancesOrchestrator) holdOrchestratorsOnAttempt(plan);` | 收工分支，`finalizeAttempt()` 之後、`!plan.buildsPayload` 分岔**之前** | 見 §T5.4 |
| `trackingPilotSession?.handleInvalidAttempt(plan.disposition)` | 同函式，最優先 | pilot 是唯一需要記帳（audit + attempt +1）而不只是停住的 runner |
| `const sessionPhase: SessionRunnerPhase = ...` | 同函式 | 沿用 WP-58 T3 的顯式標註（DoD 第 6 條：union 改動要編譯期爆掉） |

### T5.3 為什麼 Session/Protocol 沒有新的 production 程式碼（D-69-T5-1）

T5 的步驟 1、2 讀起來像是要在兩個 runner 裡加東西。實際不需要，而這正是 T4 的設計成立的證據：
`advancesOrchestrator` 一關，`advance()` 與 `completeCurrentCondition()` **根本沒被呼叫**，cursor 與
`exports[]` 是靠「沒有人動它們」保持不變的，不是靠新寫的守衛。

在兩個 runner 裡再加一層 `if (disposition…)` 會直接違反 T5 步驟 4 與 C-D4——那就是第二個判準，而且
是從 payload 反推的那一種。所以本 task 對這兩個 runner 的交付是**測試**：held × clean 成對跑同一個
rig，held 那半斷言 cursor/conditionIndex/`exports[]`/下載逐位不變，clean 那半斷言前進確實發生（沒有
這一半，一個根本沒跑起來的 rig 會讓每一條「不變」斷言都綠）。

### T5.4 hold 必須早於 `buildsPayload` 分岔（不是風格）

`discarded` 在 `!plan.buildsPayload` 那一行就 `return` 了。hold 若放在 T4 既有的
`if (!plan.advancesOrchestrator) return;` 旁邊，**只有 `invalid-retained` 會被處置**——最該讓操作員
知道「這一場什麼都沒留下」的那一種反而最安靜，pilot 的 audit 也會漏掉每一筆 discarded。
所以 hold 放在 gate 之後的第一行，且仍在第一個 `await` 之前（T4.4 的同一條順序），兩件事各有一條
source-scan 釘住。

### T5.5 pilot 為什麼不重載 config、也不借 `abortCurrentBlock()`（D-69-T5-2）

`abortCurrentBlock()` 會 `advanceFromBlock()`——它前進。README §2.5 明文禁止借用它，理由就是這個
（FM-6）。`retryRunningBlock()` 因此是獨立入口，且刻意**不呼叫 `loadDrillConfig`**：full restart 是
`main.ts` 單一 coordinator 的職責（`restartActiveDrill()` → `resetRunPresentation()` → `buildSimLoop()`），
而同一個 block 的 config/seed 逐位相同——「不用重載」正是「這還是同一個 block」的直接後果。

attempt 在 held 的當下就 +1，不等 restart。`startBlock(blockIndex, attemptNumber)` 一向在 block 被玩
**之前**發佈 phase，所以 `phase.attempt` 的既有語意就是「即將跑的那一次」；held 之後即將跑的就是
`previousAttempt + 1`。兩個時點各記一次會多一個接縫，也多一次漂移機會。

`payload` 沒有進 audit（README §2.5 寫的是「可選存在」）：要塞進去就得讓 hold 等 `await
buildCurrentExportPayload()`，那會把它推到第一個 await 之後（§T5.4 的同一條線）。稽核檔的取得路徑
是 Result 上的手動下載鈕（OQ-69.1），audit 只回答「第幾次、為什麼」。

### T5.6 四閘 + e2e

| 閘 | 命令 | exit | 計數 | 對比 T4 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.03s` | 同（chunk >500 kB 為既有警告） |
| 全量單元 | `npx vitest run` | **0** | **3703 passed / 2 skipped**；檔案 **284 / 1 skipped** | 3670 → 3703（**+33**，恰為本 task 新增數）；檔案 283 → 284 |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |
| Edge e2e（focused） | `npx playwright test --project=edge --workers=1 full-drill input-sampler raw-mouse-sampling` | **0** | **15 passed**（1.4m） | 與 T0/T3/T4 基線同一集、同一計數 |

e2e 前置：5173 無人佔用；`.playwright-tmp/history-dev` 352 個 participant 目錄（與 T4 同）。

### T5.7 Mutation check（六刀，全部見血）

| # | 拆掉什麼 | 紅燈數 |
|---|---|---|
| 1 | 收工分支的 `holdOrchestratorsOnAttempt(plan)` 呼叫 | 2 |
| 2 | `retryRunningBlock()` 不 bump attempt | 7 |
| 3 | audit 覆寫前筆（`invalidAttempts.length = 0`） | 1 |
| 4 | `describeAttemptHold()` 恆回 `null` | 12 |
| 5 | `handleInvalidAttempt()` 改走 `completeCurrentBlock()` | 1 |
| 6 | hold 裡 pilot 接手後不 `return` | 1 |

### T5.8 Surprises

1. **第六刀一開始沒見血。** pilot 在跑時 Session/Protocol 都不是 active，所以少掉那個 `return`
   目前不改變任何可觀察行為——rig 測到的是 rig 自己的 `return`。這條規則（pilot 的 status 才是權威）
   只能靠 source-scan 釘，補上之後第六刀才紅。**沒有跑 mutation 就不會發現這件事**。
2. **rig 第一版讓一個 held attempt 繼承了前一場乾淨的 plan。** `finalizedPlan` 的 memo 在 `main.ts`
   是由 `resetRunPresentation()` 清的，而**每一次** drill load 都經過它（`loadDrillById` 與
   `loadDrillConfigDirect` 都走 `activateDrill()`）。rig 的兩個 loader 原本是空的 `async () => {}`，
   於是 memo 變成「一個 manifest run 一份」而不是「一場一份」，第二個 block 的 pause 被靜默放行。
   比照 T4.9 #2：又一次是 rig 不忠實，而它剛好示範了那個共同點為什麼是契約。
3. **Session 與 Protocol 一行 production 程式碼都沒加**（§T5.3）。規劃期的步驟 1/2 讀起來像要改
   runner；實際要交的是測試。這不是偷工，是 T4 的 plan 設計本來就把後果收斂到一個欄位。

### T5.9 Definition of Done 對帳

- [x] 三 runner 在 invalid/discarded 後的 step/condition/block index 逐位不變
      （三組 `it.each` 各自對 `session.phase` / `protocol.current` / pilot phase 做整物件比對，
      且每組都配一個 clean 對照證明 rig 真的跑到了會前進的位置）
- [x] full restart 後 attempt +1，drill/config/scene/weapon/seed 與前 attempt 相同
      （`rig.restart()` 後 `runAttempt.attempt` +1、`validity` 回 `eligible-candidate`、
      `session.phase` 與 held 當下逐位相同；連續兩次 pause + restart 的 +2 版本）
- [x] invalid/discarded 不進 Session download、Protocol exports、Pilot completed payload 集合
      （`sessionDownloads` 為 `[]`、`protocol.exports` 為 `[]`、`pilot.records` 為 `[]`；
      最後一個 condition 被 held 時 `onProtocolComplete` 呼叫數為 0）
- [x] Pilot audit 保留每次失敗 attempt 的 reason/disposition，不覆寫前筆；正式 block record 只在
      candidate 通過後成立（連續兩次失效 → `previousAttempt` 為 `[1, 2]`；`records` 仍為空，
      直到那個 block 真的乾淨跑完才長出一筆且 `attempt` 記的是成功的那一次）
- [x] 正常 clean flow 的 rest/advance/done callbacks 與既有測試逐位不變
      （回歸 324 零漂移、全量單元只增不改、三組 clean 對照、Edge e2e 同一集 15 passed）
- [x] `SessionRunnerPhase`/`TrackingPilotRunnerPhase` 的 union 未改動，且 `main.ts` 的讀取點帶
      顯式型別標註（source-scan 釘住 `const sessionPhase: SessionRunnerPhase =`）
---

## T4 finalization / persistence gate（2026-09-15）

> 交付物 = `AttemptFinalizationGate`（純模組）+ `main.ts` 的五個消費點 + `HistoryPersistence` 第二道
> 防線 + Result 的稽核下載 + `PauseOverlay` 的作廢 view。**T4 讓 pause 第一次真的有後果**
> —— T3 之前 `finalize()` 在 production 沒有任何呼叫端。orchestrator 的明確 retry 入口仍是 T5；
> 本 task 只保證三個 runner **不會前進**。

### T4.1 交付檔案

| 檔案 | 內容 | 測試數 |
|---|---|---|
| `src/attempt/AttemptFinalizationGate.ts` | disposition → **consequence matrix**（七欄）、`invalidAttemptBasename()`、`describeDiscardReason()` | 30 |
| `src/attempt/__tests__/wp69-finalization.test.ts` | 真模組整合 rig（呼叫矩陣）+ `main.ts` source-scan 漂移守衛 | 27 |
| `src/history/HistoryPersistence.ts` + `.test.ts` | `excluded: 'invalid-attempt'` 第二道防線 | +5 |
| `src/ui/ResultScreen.ts` + `.test.ts` | `setInvalidAttempt()`：頂端警示條 + 稽核下載鈕 + 收起正式匯出／重播 | +8 |
| `src/ui/PauseOverlay.ts` + `.test.ts` | 第五個 view `discarded`（同一組節點切文案，「繼續」整顆收掉） | +6 |
| `src/ui/HistorySaveStatus.ts` | 兩個排除理由讀得出差別 | — |
| `src/main.ts` | 見 T4.2 | — |
| `research/.../tests/test_loader_invalid_paused.py` | Python `load_export()` 讀得到 `pauseOccurred=true`，欄面不變 | 3 |

### T4.2 main.ts 的接點（唯讀清單，便於 T5 接手）

| 接點 | 位置 | 作用 |
|---|---|---|
| `finalizationGate` | `runAttempt` 之後 | 三態 → plan 的唯一入口 |
| `recordingSnapshotForGate()` / `finalizeAttempt()` / `attemptPlanForExport()` / `requireOfficialExport()` / `downloadInvalidDiagnostic()` / `invalidAttemptNoticeFor()` | `createExportPanel` 之前 | T4 的全部政策，集中一段 |
| `pauseOccurred: runAttempt.pauseOccurred` | `collectMeta()` 的 `validity` | payload 自述不可採納（第二道防線的讀取來源） |
| `const plan = finalizeAttempt();` | `liveFrame()` 收工分支**第一行**（第一個 `await` 之前） | 見 §T4.4 |
| `if (!plan.buildsPayload) { … return; }` | 同分支 | `discarded`：零 payload、零 metrics、清 arena/frame log |
| `showResultAndTrackHistory(payload, plan)` | 同分支 | Result 警示 + `savesHistory` 閘 |
| `if (!plan.advancesOrchestrator) return;` | 同分支，三個 runner 之前 | FM-6 |
| `if (runAttempt.pauseOccurred) finalizeAttempt();` | `resetRunPresentation()` **第一行** | FR-69.12 的全部機制 |
| `discardedNoticeView` | pause runtime | 作廢告知，優先於相位 |

### T4.3 為什麼 gate 回傳 plan 而不是 disposition（D-69-T4-1）

README §2.4 把 gate 寫成 `decide(...): AttemptDisposition`。照字面做，gate 只是 `finalize()` 的一層
轉發——而 `finalize()` 已經存在，所以那一層不會帶來任何東西。

本 WP 要關的失效模式（FM-2/FM-6/FM-7）不是「判錯」，是「**判對了**，然後五個地方各自把那個判斷翻譯
成後果，翻譯得不完全一樣」。`meta.suspect` 正是這樣長出來的。所以 gate 交出的是**後果本身**：七個
欄位、三列常數，呼叫端讀欄位而不是寫規則。新增第六個消費者是讀一個欄位，不是再寫一次 if。

矩陣裡真正有內容的是三處不對稱（模組 doc 有完整表格）：`invalid-retained` **仍然**建 payload、顯示
數值（時間軸可證，數字是真的，只是不可採納）；`discarded` 在 **payload** 那一行就拒絕，不是在 save
那一行（FM-7：payload 一旦存在，數值早就到了 Result、replay 與每個下載 helper）；只有 `discarded`
清 arena（`invalid-retained` 的 arena 必須活著，操作員還沒按稽核下載）。

### T4.4 gate 必須在第一個 `await` 之前跑（不是風格）

收工分支的上一行是 `document.exitPointerLock()`。那會在**下一個 task** 補一筆 `pointer_lock` 事件，
其戳記晚於最後一個 tick。若 gate 在 `await buildCurrentExportPayload()` 之後才問，它看到的就是一筆
落在 `[firstTick − tickMs, lastTick]` 之外的事件 ⇒ `event-out-of-window` ⇒ **一場乾淨的 run 被判
`discarded`**。這與 FM-7 是同一條順序的兩面，兩個 source-scan 測試各釘一面。

同一個理由讓 `finalizeAttempt()` 必須 memo（D-69-T4-3）：收工之後 `liveFrame()` 不看相位照樣 pump，
recorder 與事件序列都還在動。不 memo 的話，Result 上按下稽核下載時重判一次，可能拿到與收工當下
不同的答案——那正是 DoD 第 6 條說的 double finalization。memo 在 `resetRunPresentation()` 清掉。

### T4.5 OQ-69.4 的結論：暫停中離開就是 discarded（D-69-T4-2）

依 T0.5 凍結的判準，暫停中結算 ⇒ pause/resume 次數不等 ⇒ `pause-fence-unclosed` ⇒ `discarded`。
T4 **逐字執行**，不在導航前強迫 resume，也不在實作期把判準放寬成「暫停中可以就地閉合 fence」。

理由不是「T0 說了算」，而是：那一場**根本沒有跑到 `ended`**。它是被放棄的，不是被完成的。
「暫停之前的時間軸可證」與「這一段該不該留成紀錄」是兩件事，前者成立不蘊含後者。

**代價明帳**：暫停中直接換 drill/scene/weapon 或按 Restart，連稽核檔都不會有。想保留稽核檔的操作員
必須先按「繼續」把這一場跑完（那條路徑給的是 `invalid-retained` + 手動下載）。這條代價與 OQ-69.1
的殘餘風險同源——兩者都是「操作員不做那個動作就等於沒保留」。

機制上它只是 `resetRunPresentation()` 的第一行：四條 full-restart 路徑的共同點，且下一行的
`runAttempt.restart()` 一跑 fence 與 validity 就沒了，所以那一行就是「navigation 不可繞過 gate」的
全部。從未暫停的導航不觸發任何結算（`emptyMatrix()` 反證）。

### T4.6 隨手匯出的分界（D-69-T4-4）

匯出鈕讀 `attemptPlanForExport()`：已結算就用那一份；**尚未**結算的隨手匯出只有在「這一場曾暫停」
時才問 gate。從未暫停、尚未收工的匯出維持既有行為逐位不變。

這條分界是刻意的。把 integrity 判準套到任意時點的隨手匯出上不在 FR-69.7–69.9 的範圍（那三條談的是
**finalization**），只會給乾淨路徑長出新的拒絕理由——而待命期的 `pointer_lock` 事件本來就可能短暫
落在 tick 窗之外（T4.4 的同一個機制）。NFR-69.1 講的是行為，不只是位元。

### T4.7 四閘 + e2e

| 閘 | 命令 | exit | 計數 | 對比 T3 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.50s` | 同（chunk >500 kB 為既有警告） |
| 全量單元 | `npx vitest run` | **0** | **3670 passed / 2 skipped**；檔案 **283 / 1 skipped** | 3594 → 3670（**+76**，恰為本 task 新增數）；檔案 281 → 283 |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |
| Edge e2e（focused） | `npx playwright test --project=edge --workers=1 full-drill input-sampler raw-mouse-sampling` | **0** | **15 passed**（1.6m） | 與 T0/T3 基線同一集、同一計數 |
| Python（新增） | `pytest .../test_loader_invalid_paused.py .../test_loader_annotation_events.py` | **0** | **10 passed** | 新增 3 |

canonical digest **零移動**——T1 的 `collectMeta()` 早就把 `pauseOccurred` normalize 成 `false` 寫進
每一份帶 `validity` 的 payload，T4 只是把那個值接上真正的來源（見 §T4.9 #4）。

e2e 前置：5173 無人佔用；`.playwright-tmp/history-dev` 352 個 participant 目錄（與 T3 同，未到會讓
history-library 變紅的量級，且本次 focused 集不含該 spec）。

### T4.8 Mutation check（十二刀，全部見血）

| # | 拆掉什麼 | 紅燈數 |
|---|---|---|
| 1 | 收工分支的 `!plan.buildsPayload` 早退 | 2 |
| 2 | `!plan.advancesOrchestrator` 閘 | 1 |
| 3 | `resetRunPresentation()` 的導航結算 | 1 |
| 4 | `collectMeta` 的 `pauseOccurred: runAttempt.pauseOccurred` | 1 |
| 5 | `showResultAndTrackHistory()` 的 `savesHistory` 閘 | 1 |
| 6 | 四顆匯出鈕中任一顆的 `requireOfficialExport()` | 1 |
| 7 | 不再把 plan 傳進 `showResultAndTrackHistory()` | 1 |
| 8 | `HistoryPersistence` 的 `invalid-attempt` 排除 | 3 |
| 9 | 矩陣：`invalid-retained.savesHistory = true` | 7 |
| 10 | 矩陣：`discarded.buildsPayload = true` | 13 |
| 11 | `ResultScreen` 不再收起正式匯出／重播 | 1 |
| 12 | 作廢 view 不再優先於相位 | 1 |

### T4.9 Surprises

1. **`main.ts` 的既有註解裡就寫著它所描述的呼叫名。** WP-48 的 fire-and-forget 說明逐字含
   `sessionPlanRunner.advance()／completeActiveProtocolCondition()`，本 task 自己的註解也提到
   `runAttempt.restart()`。逐字掃原始文字的順序斷言因此在**程式碼完全正確**時先紅了一次。受測的
   主張是「可執行的接線長這樣」，所以掃描前必須 `stripComments()`（沿用 `architecture.test.ts` 的
   先例，也是 T2.6 #4 踩過的同一種坑）。
2. **rig 第一版沒有重建 SimLoop，於是一場乾淨的 restart 被判成 `discarded`。** mapper 歸零後舊 loop
   的 `simTimeMs` 與新的 active 域差了一整段 ⇒ re-anchor ⇒ `tick-step-off-grid`。這是 rig 不忠實的
   結果（`main.ts` 的 `resetRunPresentation()` 之後**必定**緊接 `buildSimLoop()`，T2 已用 source-scan
   釘住），但它剛好從反面示範了那個順序為什麼是契約。
3. **收工釋鎖補的 `pointer_lock` 事件會把乾淨的一場推出 tick 窗。**（§T4.4）規劃期只寫了「gate 要早
   於 payload」，沒寫「要早於第一個 `await`」——而後者才是實際會踩到的那一條。
4. **canonical digest 零移動，而且這是對的。** 一開始預期會再動 3 筆（比照 T1）。實際零移動，因為 T1
   的 `requireValidity()` 已經把缺席的 `pauseOccurred` normalize 成 `false` 並 required-out 寫進每一份
   帶 `validity` 的 payload；T4 只是把那個位置的**值**接上真正的來源。位元早在 T1 就付過了。
5. **pytest 在這台機器用預設 tmp root 會 `PermissionError`**（`%LOCALAPPDATA%\Temp\pytest-of-*` 存取
   被拒）。要跑 research 側測試必須帶 `--basetemp=<可寫目錄>`，否則三個測試全部 error 而看起來像程式
   壞了。
6. **`ResultScreen` 既有的「警示條在 body 之上」測試是用常數索引 `toBe(1)` 寫的**，頂端多一條警示就
   紅。改成斷言它自己註解裡本來就說的那件事（排在 body 之前），比原本更貼近意圖，也不會再因為相鄰
   元素增減而漂移。

### T4.10 Definition of Done 對帳

- [x] 三態對 payload builder / metrics / download / history / replay 的呼叫矩陣逐格有 spy 斷言
      （`wp69-finalization.test.ts` 三個 `toEqual(CallMatrix)`，八個欄位一次比完，少比一格會漏）
- [x] invalid-retained JSON 可由 TS parser 讀（T1 的 schema round-trip + `pauseOccurred=true` 專節）
      與 Python `load_export()` 讀（新增 3 個 pytest，含「缺席 ≠ true」的負向對照）
- [x] invalid/discarded 對 `HistoryClient.saveRun` 與正式 history/trend 的呼叫數均為 0
      （第一道：`main.ts` 連 `save()` 都不呼叫；第二道：`HistoryPersistence` 的 `saveRun` 呼叫數 = 0）
- [x] discarded 路徑 payload builder/serializer 呼叫數為 0，recorder count 回 0
      （`expect(rig.calls).toEqual({ ...emptyMatrix(), recorderReset: 1 })` + snapshot events 為空）
- [x] clean assessment/practice 路徑與 T0 baseline 相同（回歸 324 零漂移、canonical digest 零移動、
      Edge e2e 同一集 15 passed、乾淨路徑的正式匯出仍可用）
- [x] navigation 不可繞過 gate（`resetRunPresentation()` 第一行 + source-scan 順序守衛），
      且沒有 double finalization/download（memo 測試：第二次進收工分支不改變任何後果）
---

## T3 input / Pointer Lock / overlay（2026-09-15）

> 交付物 = gameplay 閘（InputSampler 與 camera consumer 共用）、pause 邊界的 release edge、
> `PauseOverlay`、Pointer Lock resume 與恢復倒數、Restart 收斂到既有 full-restart coordinator。
> **T3 讓 pause 第一次真的會發生**（T2 只鋪了時鐘管線）。finalization／export／orchestrator 仍未動
> —— `finalize()` 目前沒有任何 production 呼叫端，那是 T4/T5。

### T3.1 交付檔案

| 檔案 | 內容 | 測試數 |
|---|---|---|
| `src/input/InputSampler.ts` | `InputSamplerOptions`（`isGameplayInputEnabled` / `mapEventTime`）+ `heldKeys` + `suspend()` | +11 |
| `src/input/PointerLock.ts` | 新增 `onError()` 接縫 | — |
| `src/input/PointerLock.test.ts` | **該模組首個單元測試**（T0.2 標示為無覆蓋）：成功 / NotSupported fallback / error / move 轉發 | 10 |
| `src/ui/PauseOverlay.ts` + `.test.ts` | 純 TS DOM 面板、四個 view、建構期一次配置；`locking` 只停用「繼續」，Restart 永遠是保底出口 | 15 |
| `src/main.ts` | pause runtime（見 T3.2）、camera 閘、第四個 `onChange` 訂閱者、`onError`、`resetRunPresentation` | — |
| `src/attempt/__tests__/wp69-pause-lifecycle.test.ts` | 真模組整合 rig + `main.ts` source-scan 漂移守衛 | 25 |

### T3.2 main.ts 的接點（唯讀清單，便於 T4 接手）

| 接點 | 位置 | 作用 |
|---|---|---|
| `runAttempt` + `isGameplayInputEnabled()` | `pointerLock` 建構之後 | gameplay 採計／套用的單一閘；宣告點必須早於 camera consumer 與 InputSampler |
| `pointerLock.onMove` 內的閘 | camera 佈線 | resume 倒數期間鎖已回來，只有這個閘擋著視角偷跑 |
| `createInputSampler(..., { isGameplayInputEnabled, mapEventTime })` | 輸入採集 | 所有 down/move 過閘；**所有**戳記過 mapper |
| pause runtime 區塊（`beginPause` / `requestResume` / `failResume` / `confirmResumeLock` / `updatePauseRuntime`） | `drillStartOverlay` 與 `inputSampler` 之間 | app 這一層唯一的 pause 接線；`timeMapper` 宣告點一併上移到這裡 |
| 第四個 `pointerLock.onChange` + `pointerLock.onError` | WP-65 T5 的效度訂閱者之後 | 掉鎖→pause／取鎖→倒數／失敗→回 paused |
| `updatePauseRuntime(now)` | `liveFrame()` 第一段 | **必須早於** `timeMapper.mapWallTime(now)` |
| `runAttempt.restart()` | `resetRunPresentation()` | 與 `timeMapper.restart()` 同一個點 |

`pointer_lock` 事件的戳記一併改走 `timeMapper.mapWallTime(performance.now())`：未 pause 時 mapper 是
逐位 identity ⇒ 既有匯出不變；少了這層映射，**第二次**掉鎖會蓋上 wall 戳記而落到 tick 窗之外
（`event-out-of-window` ⇒ 整場 discard）。這是 T3 掃出來、T2 沒看見的殘留 wall 讀點（見 §T3.9 #4）。

### T3.3 對 README §2.3 的兩處刻意偏離（D-69-T3-1 / D-69-T3-2）

1. **`suspend(atWallMs)` 收 wall，不收 active**（README 寫 `suspend(atActiveMs)`）。sampler 內部的
   每一個 push 點都過 `mapEventTime`，所以呼叫端一律傳 wall——「這個要映射、那個不用」的分岔一旦
   存在，遲早有人會漏掉一個（`releaseAds` 本來就是漏網的那一個，`pointer_lock` 是另一個）。
   代價是參數名與 README 不同；換得的是「沒有任何呼叫端需要知道 mapper 存在」。
2. **up edge 的採計條件改成「採計過對應的 down」**。原本 keyup 無條件入 ring，而 fire/ads 早就靠
   `fireButtonHeld`／`adsButtonHeld` 把關。若沿用舊語意，暫停中受試者放開 A/D 會讓一筆 keyup 溜進
   ring；它蓋的是**凍結的** active time，因此可能大於 `lastTick` ⇒ `event-out-of-window` ⇒ 整場被
   自己的 validator 丟掉。把三類控制對齊到同一條規則後，`suspend()` 清帳這件事自動關上了那個門，
   不需要對 up edge 另加一道閘（gameplay 閘因此只擋 down/move，語意更窄也更好解釋）。

### T3.4 為什麼 `PointerLock` 非得長出 `onError`（D-69-T3-3）

`setLocked(next)` 在 `next === locked` 時直接 return。取鎖失敗時 `locked` **本來就是** `false`，
所以 `pointerlockerror` → `setLocked(false)` 是 no-op，**一個 change 回撥都不會發出**。
只接 `onChange` 的話，一次失敗的 resume 會讓面板永遠停在「正在重新取得滑鼠鎖定…」。

因此 resume 的失敗有兩條收斂路徑，兩條都接：`request()` 的 Promise rejection（Chromium 現行行為）
與 `onError`（document 事件）。兩者都只在 `locking` 相位生效，其餘相位一律忽略。

順帶補上該模組的第一份單元測試（T0.2 明確標示「無單元測試覆蓋」），涵蓋 T3 真正依賴的四條語意，
不追求把整個 Pointer Lock 生命週期補完——那不是本 task 的範圍。

### T3.5 `beginPause()` 的順序是契約，不是風格

```ts
runAttempt.pause(timeMapper.pause(performance.now()));
inputSampler.suspend(performance.now());
```

mapper 的回傳值**直接**餵給 fence：fence 兩端因此是同一個 double，退化成一個點，沒有任何戳記可能
落在裡面（D-69-T1-1／D-69-T2-1）。拆成「先 `mapWallTime()` 算一次、再另外 `pause()` 一次」會讀兩次
時鐘，fence 張開一個 sliver，`pause-fence-unclosed` 從機械證明降級成容差。

這條有兩層反證：**負向對照**（rig 裡「只開 fence、不凍時鐘」的變體 ⇒ `discarded`
`pause-fence-unclosed`）與 **source-scan**（逐字釘死 `runAttempt.pause(timeMapper.pause(` 這個巢狀
形狀）。兩者缺一不可：前者證明語意，後者擋 `main.ts` 漂移。

### T3.6 Restart 的落點（D-69-T3-4）

`runAttempt.restart()` 與 `timeMapper.restart()` 同放 `resetRunPresentation()`——四條 full-restart
路徑（Restart 鈕／換武器／換 drill／換場景）的共同點。**後果要明帳**：換武器、換 drill、換場景
也會 attempt +1。那是對的（那些確實是新的 attempt），但 README FR-69.6 只談 Restart，故在此記下。
Restart 之後走既有 `drillRunner.start()` ⇒ 主動釋鎖 ⇒ 回到 `armed`，需要重新取鎖並跑初始倒數
（WP-65 的既有語意，本 WP 一字未改）。

### T3.7 四閘 + e2e

| 閘 | 命令 | exit | 計數 | 對比 T2 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.48s` | 同（chunk >500 kB 為既有警告） |
| 全量單元 | `npx vitest run` | **0** | **3594 passed / 2 skipped**；檔案 **281 / 1 skipped** | 3533 → 3594（**+61**，恰為本 task 新增數）；檔案 278 → 281 |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |
| Edge e2e（focused） | `npx playwright test --project=edge --workers=1 full-drill input-sampler raw-mouse-sampling` | **0** | **15 passed**（1.7m） | 與 T0 基線同一集、同一計數 |

canonical digest 零移動（在全量單元內綠）——本 task 對未 pause 路徑是 identity。
e2e 前置：5173 無人佔用；`.playwright-tmp/history-dev` 352 個 participant 目錄（未到會讓
history-library 變紅的量級，且本次 focused 集不含該 spec）。

### T3.8 Mutation check（六刀，全部見血）

新測試不是佈景。逐一把接線拆掉後的紅燈：

| # | 拆掉什麼 | 結果 |
|---|---|---|
| 1 | `onKeyDown` 的 gameplay 閘 | **5 紅**（sampler 單元 + 生命週期 rig 兩層） |
| 2 | `beginPause` 的巢狀呼叫改成兩次讀時鐘 | 1 紅（source-scan） |
| 3 | camera consumer 的閘 | 1 紅（source-scan） |
| 4 | `liveFrame` 的 `updatePauseRuntime(now)` | 1 紅（source-scan） |
| 5 | `resetRunPresentation` 的 `runAttempt.restart()` | 1 紅（source-scan） |
| 6 | `createInputSampler` 的 `mapEventTime` 接線 | 1 紅（source-scan） |

⚠️ **#2、#4、#6 第一刀都是綠的**，守衛改好之後才見血，見 §T3.9。

### T3.9 Surprises

1. **兩個 source-scan 守衛第一次寫錯方向，mutation 才抓到。**
   - `indexOf(a) < indexOf(b)` 在 `a` **不存在**時（回 `-1`）恆真 ⇒ 把 `updatePauseRuntime(now)`
     整行刪掉反而讓測試變綠。順序斷言必須先各自斷言「存在」。
   - `beginPause` 的順序原本寫成「`runAttempt.pause(` 出現在 `timeMapper.pause(` 之前」——那只是巢狀
     呼叫的**文字**順序，把它拆成兩條獨立敘述後仍然滿足。真正的契約是巢狀形狀本身，只能逐字釘。
2. **`mapEventTime` 是個靜默接點。** 拆掉它，未暫停路徑完全正常（mapper 是 identity），只有
   「暫停過一次之後」的事件戳記會悄悄落在 wall 域。整個單元與 e2e 套件都不會紅——因為 production
   目前還沒有任何自動化路徑會真的暫停。這類接點只有 source-scan 擋得住。
3. **`pointerlockerror` 在既有 `PointerLock` 裡是完全無聲的**（§T3.4）。規劃期 FM-4 寫「以
   `pointerlockchange/error` 收斂」時，`error` 那一半在程式碼裡根本沒有出口。
4. **T3 掃出一個 T2 漏掉的 wall 讀點**：`recorder.recordEvent({ type: 'pointer_lock', …, t:
   performance.now() })`。T2 的三個接點清單本身沒錯，但它只列了「量測時間的映射點」，沒有回頭掃
   「還有誰在直接讀時鐘、把值寫進 recorder」。第二次暫停之後那個戳記會落到 tick 窗外。
5. **UI 測試的假 DOM 不解析 `cssText`。** overlay 的初始隱藏寫在建構期的 `cssText` 裡，
   `style.display` 因此是空字串——第一版斷言 `display === 'none'` 直接紅。

### T3.10 Definition of Done 對帳

- [x] overlay 文案逐字含「本次已失去實驗效力」「繼續仍無效」「只有完整重新測試才能再次接受門檻」
      （三個 `toContain`，且文案在建構期就存在、不必先 `update()`）
- [x] pause 與 resume-countdown 期間 ring write count、camera yaw/pitch、held states 與 shot count
      無新增（兩個 describe：未鎖定的 pause 與**已鎖定**的倒數各一組；後者是 FM-5 唯一的擋點）
- [x] Resume request 在 button click stack 內發生（overlay 的同步回撥測試 + rig 的「click 回來時
      `requestCalls() === 1`」）；成功／NotSupported fallback／error 三路有測試（前二者在
      `PointerLock.test.ts` 對**真**模組，error 的兩條收斂路徑各一個 rig 測試）
- [x] armed／idle／ended 掉鎖仍為 `pauseOccurred=false`（`it.each` 三個相位）；countdown／running 為 true
- [x] Restart 後 attempt +1、validity fresh、fence 清空、mapper 回 identity、overlay 收起；
      同 config/seed 與「需重新取鎖並跑初始 countdown」沿用既有 `drillRunner.start()` 釋鎖語意
- [x] overlay 建構期一次配置，更新路徑零新增 DOM node（跑完三輪全部 view 後 `createElement` 計數不變）

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

---

## T1 attempt/disposition contract（2026-09-15）

> 交付物 = `src/attempt/` 三個純模組 + `meta.validity.pauseOccurred` additive 欄位。**不接線**：`main.ts`、SimLoop、input、UI、history 全部零 diff —— 本 task 只立契約，T2–T5 才接。

### T1.1 交付檔案

| 檔案 | 內容 | 測試數 |
|---|---|---|
| `src/attempt/recordingIntegrity.ts` | T0.5 凍結的 8 個 `RecordingIntegrityReason` 判準，純函式 `evaluateRecordingIntegrity()` | 39 |
| `src/attempt/RunAttemptController.ts` | `PauseRuntimePhase` / `AttemptValidity` / `AttemptDisposition` + sticky 狀態機 + `finalize()` | 34 |
| `src/attempt/architecture.test.ts` | 依賴邊界掃描（DoD 第 5 條） | 15 |
| `src/data/metadata.ts` / `exportPayloadSchema.ts` | `validity.pauseOccurred` optional-in / required-out；`suspect` OR 納入 | +9 |

### T1.2 四閘（全綠）

| 閘 | 命令 | exit | 計數 | 對比 T0 基線 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.21s` | 同（chunk >500 kB 為既有警告） |
| 全量單元 | `npx vitest run` | **0** | **3483 passed / 2 skipped**；檔案 **276 / 1 skipped** | 3386 → 3483（**+97**：88 個 `src/attempt/` + 9 個 metadata/schema）；檔案 273 → 276 |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |

### T1.3 對 README §2.1 的一處**刻意偏離**：fence 存 active time，不存 wall time（D-69-T1-1）

README §2.1 把 `pause()` / `finishResumeCountdown()` 的參數寫成 `atWallMs`。**照字面做會讓 T0.5 的第 7 條判準產生偽陽性**，所以 T1 改存 active time，參數改名 `atActiveMs`。

理由是機械的：`pause-fence-unclosed` 的判準之一是「有 tick／event 的戳記落在某個 pause 區間內」，而 tick/event 戳記是 **active time**。若 fence 存 wall time `[w1, w2]`（`w2 − w1` = 真實暫停牆鐘長度），resume 之後的 tick 其 active time 從 `w1` 繼續往前長 —— 於是**每一個 resume 後的 tick 都會落進 `[w1, w2]`**，一場正常的 pause→resume 會被自己的 validator 判成 discarded。

存 active time 則相反：mapper 正確時 active time 在 pause 期間凍結 ⇒ `resumedAtMs === pausedAtMs`，fence 退化成一個點，**沒有任何戳記可能落在裡面**。這讓該檢查從「容差」升級成「凍結的機械證明」：

- 正常情形 ⇒ 退化 fence ⇒ 恆放行（`RunAttemptController.test.ts` 的 `admits ticks straddling a degenerate fence`）。
- **T2 若讓 active time 在 pause 期間偷跑** ⇒ fence 張開 ⇒ 被它吞掉的 tick 就是證據 ⇒ `discarded`（`discards when active time advanced during the pause (mapper leak)`）。

⇒ 這條檢查同時是 **T2 的回歸偵測器**，在 T1 就先架好。`confirmLock(atWallMs)` 維持 wall time（純稽核，不參與時鐘語意）。

### T1.4 canonical digest：D-69-T0-4 完全印證

| 預測（T0.4） | 實測 |
|---|---|
| 只有帶 `meta.validity` 父物件的 **3 筆**會移動 | ✅ **恰好 3 筆**：`09_18_05` `e62c8b40f6d51fb4` → `be406f8793cc4c4e`、`09_24_18` `daa8782429b5904c` → `e725f627bce38982`、`09_37_24` `71814344e3dc42f7` → `0e8a86413b324c2d` |
| 其餘 **5 筆**逐位不變 | ✅ 5 筆零變動（`validity` 缺席 ⇒ 鍵不存在 ⇒ 位元不動） |

⇒ 這 5 筆不動正是「預設只落在這一個鍵、沒有污染任何既有欄位」的反證。`exportPayloadSchema.test.ts` 的表格註解已補上 WP-69 段落，並寫明**第 4 筆變紅 = 回頭修程式，不准改表**。

### T1.5 Definition of Done 對帳

- [x] Resume 無法把 `invalid-paused` 改回 `eligible-candidate`；只有 `restart()` 可以 —— 四條恢復路徑（`beginResume` / `confirmLock` / `finishResumeCountdown` / 重複 `pause`）各一個測試，外加一條窮舉所有 mutator 的測試
- [x] 三態每一分支皆有正向 + 反證測試（`eligible-candidate` 4 / `invalid-retained` 4 / `discarded` 5）
- [x] `pointerLockLost` 與 `pauseOccurred` 可分別解析；四種組合全數 round-trip（parser 與 `collectMeta` 各一組）
- [x] pre-WP-69 payload 可讀（9 份 fixture 全綠 + optional-in 缺席測試）
- [x] 模組依賴掃描證明零 DOM / Three / sim / `SharedState` / research / `node:*` import，且零 `Date.now()` / `Math.random()` / `performance.now()`（`architecture.test.ts`，`import.meta.glob('?raw')`，沿用 `src/scene/architecture.test.ts` 先例）

### T1.6 Surprises

1. **T0.5 的 fence 判準把「暫停中直接收工」判成 `discarded`。** pause 之後不 resume 就 finalize ⇒ pause/resume 次數不等 ⇒ `pause-fence-unclosed` ⇒ 無 payload。這是 T0 凍結判準的**正確**後果（實作時逐字照做，不放寬），但它對 FR-69.12「paused 時離開/切換 drill」是有產品後果的：pause 之前那段時間軸其實可證。已開 **OQ-69.4** 交 T4 決定。撰寫測試時我自己先踩到這個坑（原本預期 `invalid-retained`），紅燈是對的。
2. **`Math.nextUp` 不是標準 JS。** 要證明 tick 軸真的 bit-exact（D-69-T0-2）得用 `Float64Array`/`BigUint64Array` 手動加 1 ULP。已封在 `recordingIntegrity.test.ts` 的 `nextUp()` helper。
3. **`toEqual` 對 additive 欄位是硬性斷言。** 兩個 WP-65 的 `pointerLockLost` round-trip 測試因為 validity 從 5 鍵變 6 鍵而變紅 —— 與 digest 移動同源，都是 required-out 的預期成本，不是回歸。
4. **T0.5 的語料計數可機械複驗**：9 份 fixture 合計 **13,262 ticks / 634 events**，與 T0 記錄逐數相同，已固化成測試（語料若被換掉會立刻紅）。

---

## T2 pausable active time（2026-09-15）

> 交付物 = `src/loop/pausableTimeMapper.ts` + `main.ts` 的時鐘管線（三個接點）+ 50 個新測試。
> **production 尚無 pause 觸發點** —— mapper 在正式路徑恆為 identity，pause/resume 的呼叫端是 T3。
> 本 task 鋪的是「暫停時時間怎麼不動」的機制，不是「什麼情況會暫停」的政策。

### T2.1 交付檔案

| 檔案 | 內容 | 測試數 |
|---|---|---|
| `src/loop/pausableTimeMapper.ts` | 純算術 mapper：`mapWallTime` / `pause` / `resume` / `restart` + `paused` / `excludedWallMs` | — |
| `src/loop/pausableTimeMapper.test.ts` | 三條不變量各一組 + fail-fast + 與 `RunAttemptController` 的 fence 對接 + 純度掃描 | 36 |
| `src/loop/__tests__/wp69-pause-time.test.ts` | 真 `createSimLoop` 整合：四 FPS identity、凍結、no-catch-up、多次 pause、restart parity、main.ts 順序守衛 | 14 |
| `src/main.ts` | 三個接點（見 T2.2） | — |

### T2.2 main.ts 的三個接點（唯讀清單，便於 T3 接手）

| 接點 | 位置 | 作用 |
|---|---|---|
| `activeClock` 注入 `createSimLoop` | `buildSimLoop()` | loop 建構期的 `lastMs`/`simTimeMs` 與 `pump()` 餵入值同域；重建 loop 不會一邊 wall 一邊 active |
| `mapWallTime(now)` → `pump()` + HUD elapsed | `liveFrame()` | 量測時間的唯一映射點；**render-only 壽命（命中回饋 / tracer / ADS FOV / 急停閂鎖）刻意留在 wall `now`** |
| `timeMapper.restart()` | `resetRunPresentation()` | 四條 full-restart 路徑的共同點，且都緊接 `buildSimLoop()`（順序已被測試釘住） |

drill countdown **不需要改**：`countdownRemainingMs` 由 sim tick 導出（WP-65），tick 停了它自然凍結。
`sessionPlanRunner.poll(now)` / `trackingPilotSession?.poll(now)` 維持 wall —— 那是 drill **之間**的休息倒數，不是量測時間。

### T2.3 兩處對 README §2.2 的刻意偏離（D-69-T2-1 / D-69-T2-2）

1. **`pause()` / `resume()` 回傳 active ms**（README 寫 `void`）。fence 的兩端必須是**同一個 double**，否則 T1 的 `pause-fence-unclosed` 會從「機械證明」退化成「容差」。讓 mapper 直接交出那個值，呼叫端無從算錯。
2. **錨在 `(wall, active)` 配對，不用 offset 減法**。`w − offset` 只在捨入剛好配合時能在 resume 當下逐位還原 `frozenActive`；`(w − resumeWall) + resumeActive` 在 `w === resumeWall` 時是 `0 + resumeActive`，對**所有**可表示輸入恆真。不變量要對所有輸入成立，不是對看起來合理的輸入成立。

「首次 pause 前 identity」用**短路**（直接 `return wallNowMs`）而非 `w − 0`：後者對 `-0` 不是 identity，且短路讓 NFR-69.1 變成讀得出來的保證而不是推導出來的巧合。

### T2.4 四閘 + e2e

| 閘 | 命令 | exit | 計數 | 對比 T1 |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | — | 同 |
| build | `npm run build` | **0** | `✓ built in 2.46s` | 同（chunk >500 kB 為既有警告） |
| 全量單元 | `npx vitest run` | **0** | **3533 passed / 2 skipped**；檔案 **278 / 1 skipped** | 3483 → 3533（**+50**，恰為本 task 新增數）；檔案 276 → 278 |
| 回歸 | `npx vitest run tests/regression` | **0** | **324 passed**（33 files） | **逐數相同，零漂移** |
| Edge e2e（focused） | `npx playwright test --project=edge --workers=1 full-drill input-sampler` | **0** | **13 passed**（1.6m） | 全鏈路 drill → 匯出 → 統計在 mapped clock 下未變 |

canonical digest **零移動**（`exportPayloadSchema.test.ts` 在上表全量單元內綠）——本 task 對未 pause 路徑是 identity，本來就不該動任何一筆。

### T2.5 fail-fast 的邊界在哪（D-69-T2-3）

- `mapWallTime` / `pause` / `resume` / `restart` 對非 finite 一律 `RangeError`。
- `resume` 對 wall 倒退（`w < pausedAtWall`）`RangeError`：把倒退的時鐘折進錨點會讓 active time 往回走，下游只會在匯出時以 `tick-regression` 浮現，那時現場證據已經沒了。
- **`mapWallTime` 刻意不做單調性檢查。** T3 會用同一個入口映射 DOM `event.timeStamp`，而事件戳記合法地早於當幀的 rAF `now`（T0.5 已實測到一份乾淨 fixture 內有 0.2025 ms 的跨構念回退）。在這裡加單調閘會對正式資料誤殺。

### T2.6 Surprises

1. **T0.4 的頭條常數（resume 首幀 32 / 2 ticks）不是不變量，是排程巧合。** 它們取決於暫停落在 7.8125 ms 網格的哪個位置——accumulator 帶著殘餘量。我照抄 T0 的數字寫斷言，四條全紅（實測拿到 33 / 3）。**修正後的做法是對照組**：跑一條「完全沒暫停、但 frame 落在相同 active 時刻」的 control rig，斷言 mapped 的 tick 軸與它**逐位相同**。這比常數更強（證明「暫停在輸出裡完全不存在」）也不吃排程。naive 那條則改斷言「多出 >28 個 tick」與「注入 >2700 ms 的空洞」，並在註解保留 T0 的 2766.667 ms 出處。
2. **殘餘 accumulator 跨 pause 必須保留，不能歸零。** resume 後第一個 sub-tick 幀可能仍產生 1 個 tick（不是 0）——因為暫停前沒跑完的那不到一個 tick 的時間被正確地留著。把它清掉會是同一個 bug 的另一種口味（時間在暫停邊界蒸發）。DoD 的 `ticks <= 1` 因此是正確的寫法，`=== 0` 不是。
3. **mutation check**：把 `mapWallTime` 的凍結短路拿掉後，兩個檔案共 **8 個測試**轉紅（涵蓋 mapper 單元與 SimLoop 整合兩層）。測試有牙齒，不是佈景。
4. **純度掃描要先剝註解**。模組 doc 正當地寫著 `performance.now()`（說明呼叫端該傳哪個時鐘域的值），逐字掃描會把說明文字當成違規。受測的主張是「沒有可執行行讀時鐘」，不是「檔案裡不准出現這個詞」。

### T2.7 Definition of Done 對帳

- [x] pause 1/10/300 秒期間每幀 `pump()` 都回 `ticks=0`，sim state / recorder tickCount / fireCount / hitCount / weapon.ammo 全不變（三個時長各一個測試，逐項斷言）
- [x] resume 第一幀不 catch up、無 >250 ms re-anchor —— 以「與 control rig 逐位相同 + 注入空洞恆為 0」證明；sub-tick 幀 `ticks <= 1`（見 T2.6 #2）
- [x] 從未 pause 的 30/60/144/240 FPS trace 逐欄 `Object.is`（mapped vs 未經 mapper 的同一 loop）；回歸 324 零漂移、canonical digest 零移動
- [x] gameplay HUD 不含 pause wall duration（`elapsedActive === elapsedWall − excludedWallMs`）；render-only 動畫維持 wall `now`（T2.2 明列哪些留在 wall）
- [x] `SimLoop.ts` **零 diff** —— tick dt、accumulator clamp、re-anchor、target motion 一字未動
