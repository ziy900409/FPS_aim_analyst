# WP-51 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**：依engineering-planning skill完成WP-51規劃；建立T0～T5 + T-exit、dev/preview分層驗收、workspace-contained roots、failure ownership、M18 evidence schema與人工release gate。尚未開始production/test implementation。

## Planning-time observations

- WP-48目前實際已推進到T2，但上層Stage狀態尚待owning WP於exit同步；WP-51 T0以實際HEAD/evidence為準，不代替上游宣告完成。
- DEV-only test hooks不能出現在preview bundle；因此completion/autosave自動化與production-bundle smoke必須分成兩種證據。
- 現行Playwright會reuse server且fixed ports；Stage 10 acceptance需自行擁有process lifecycle，避免stale server與錯root造成假綠。
- 現有部分filesystem tests使用OS temp，與Stage 10 workspace temp紀律不一致；列入WP-48 handoff對帳。

## Open Questions

- **OQ-51.1**：人工實機3D/Pointer Lock/Participant與研究員walkthrough是否阻擋M18？建議是。
- **OQ-51.2**：Chrome與Edge是否都需自動化？2026-09-01 已由 product/tech owner 正式豁免 Chrome manual walkthrough 與 WebGL2 fallback automated project 為 non-blocking post-M18 coverage debt；M18 release gate 維持 system Edge automated + Edge manual WebGPU/GPU/a11y walkthrough。
- **OQ-51.3**：preview是否接受只走公開History→Result→Replay，completion→autosave由dev自動化+preview人工補足？建議接受。

## Evidence log

T0開始後，每筆記錄：date、commit、task、command/scenario、environment、artifact、result、owner。不得貼真實payload或Participant identity。

- **2026-08-28**：完成 **T1 — Acceptance runner、isolated roots、fixtures與evidence schema**。

  **重要偏離**：本次**未**執行完整 T0 entry-gate（WP-48～50 handoff矩陣、baseline重跑記錄、
  OQ-51.1～3決策、browser matrix凍結）——T0 checklist仍為 ⬜。開工前僅針對 T1 依賴行
  （T1-acceptance-harness.md「T0已確認root injection、public History API、DEV completion
  driver與server commands」）逐項讀原始檔確認**存在**且可用：
  - root injection：`FPS_HISTORY_ROOT` 環境變數，`playwright.config.ts` 既有 dev/preview
    webServer entry已各自使用（`server/history/historyPlugin.ts:23`）。
  - public History API：`/api/history/{health,runs,participants,...}`（`server/history/historyApi.ts`）。
  - DEV completion driver：`window.__fpsTest`（`src/testharness/fpsTestHarness.ts`），dev-only。
  - server commands：`npm run dev`（port 5173）／`npm run build && npm run preview`（port 4173），
    兩者皆 `strictPort: true`（`vite.config.ts`）。

  這**不等於**T0通過——WP-48～50實際exit evidence對帳、OQ-51.1～3決策與baseline仍是獨立、
  尚未開始的工作，留給日後補做的T0任務。

  **交付**（`tests/stage10/*.ts` + `scripts/run-stage10-acceptance.mjs` + `package.json`
  `test:stage10`）：
  - `Stage10AcceptanceEnvironment.ts`：`.playwright-tmp/stage10/<runToken>/{dev,preview,downloads}`
    root allocator；單一`stage10.lock`檔做re-entry mutex（fail-fast，不猜測/不殺對方）；
    outside-sentinel（快照真實`data/session-history/`檔案樹/mtime）在cleanup前比對，不符時
    保留run root當證據、cleanup回報`ok:false`但仍釋放lock。
  - `Stage10FixtureFactory.ts`：`runToken`-scoped synthetic participant/run識別，決定性
    `runId`（複用`server/history/historyPaths.ts`的`buildRunIdentity`/`buildRunId`，非另建一套
    hash）；涵蓋多participant、tie-break（同`startedAt`）、unregistered-metric
    （`hold_click_v1`）、incompatible cohort（同participant/drill、不同sensitivity的兩筆
    `spider-shot-v2`）、Practice排除、corrupt/unsupported bootstrap JSON。已對真實
    `HistoryRepository`/`DrillMetricRegistry`跑過round-trip驗證。
  - `Stage10EvidenceReporter.ts`：`M18EvidenceRecord`schema/writer；`record()`對
    `artifact`/`command`/`notes`做forbidden-absolute-path掃描，命中即throw（不讓真實路徑走到
    report檔）。
  - `Stage10Runner.ts`：port preflight（`localhost`，見下方Surprises）＋注入式
    `PortCheck`/`ProcessLauncher`/`ReadinessCheck`；occupied-port/startup-failure/test-failure/
    cleanup-failure regressions全部用fake seam跑（不需真的開Vite），只有真正CLI用real
    implementation。
  - `tests/stage10/cli.ts` + `scripts/run-stage10-acceptance.mjs` + `npm run test:stage10`：
    真實跑一次fresh dev+preview、經公開API seed、驗證root分離／Practice拒存／preview
    bootstrap corrupt+unsupported被`/health`偵測到，寫M18 evidence report後teardown。

  **Replay full/partial/unsupported/invalid fixtures延後**：WP-50只完成T0規劃（無
  `replayCompatibility.ts`/schema落地），現在沒有可分類的對象；留給WP-51 T2（待WP-50出貨後）。

  **T1 DoD自評**：re-entry／occupied-port／invalid-root／startup-failure／test-failure／
  cleanup-failure六項regression全部覆蓋（`Stage10AcceptanceEnvironment.test.ts` +
  `Stage10Runner.test.ts`，28 tests全綠）；`npm run test:stage10`本機實測exit 0、兩個port
  釋放、run root清除、evidence report三項pass。canonical cross-WP journey（完成→autosave→
  Result→History→Replay）**不**在T1範圍——那是T2，且依賴WP-48～50各自exit（目前皆未完成）。

- **2026-08-31**：完成 **T0 — Entry and Upstream Handoff Gate**。

  **確認 WP-48／49／50 皆已 T-exit**（Stage 10 README §9 狀態屬實，非規劃態）：WP-48 T-exit commit
  `bc077f4`（2026-08-27）、WP-49 T-exit commit `7545620`（2026-08-28）、WP-50 T-exit commit
  `c52bf07`（2026-08-31，＝目前 HEAD）。以下矩陣以直接讀原始碼（非文件字面）對帳：

  | Contract | Owning WP | 實際位置 | 版本/狀態 | Verdict |
  |---|---|---|---|---|
  | Assessment-only 保存閘 | WP-48 | `server/history/HistoryRepository.ts:128`（`saveRun` 對缺 `meta.assessment` 拋 `PracticeNotArchivableError`），索引期再檢一次（:367） | schemaVersion 2 | 已交付 |
  | Exact-drillId 分組（不合併 family） | WP-48 | `HistoryRepository.ts:166-184`（`listDrills`）／`:186-194`（`listRuns`） | — | 已交付 |
  | 嚴格 payload 解析（`ExportPayload`） | WP-48 | `src/data/exportPayloadSchema.ts:38` `parseExportPayload()`；`schemaVersion!==2`→`unsupported_schema`（:238） | schemaVersion=2 pinned | 已交付 |
  | Atomic write + path containment | WP-48 | `HistoryRepository.ts:409-455`（tmp+fsync+rename）；`isLexicallyContained`+`assertContainedOnDisk` realpath walk（:460） | — | 已交付 |
  | History HTTP API（6 typed routes） | WP-48 | `server/history/historyApi.ts:34-115` `matchHistoryRoute`：`GET /health`／`POST /runs`／`GET /participants`／`GET /participants/:id/drills`／`GET .../drills/:id/runs`／`GET /runs/:runId`（+ WP-49 追加 `.../observations`） | — | 已交付，與 README §2.4 route table 逐字相符 |
  | Typed browser client | WP-48 | `src/history/HistoryClient.ts:55-68,166-192`：`health/saveRun/listParticipants/listDrills/listRuns/loadRun/observations`，injectable fetch/timeout/abort，`HistoryClientError{code,retryable,status}` | — | 已交付 |
  | Metric registry（exact-id，未註冊→empty state） | WP-49 | `src/history/DrillMetricRegistry.ts:211-250`：`registrationForExactDrill()` 未命中回傳 `undefined`→`project()` 回 `{status:'unregistered-drill'}`；目前僅 `spider-shot-v2` 註冊 | registry v1.0.0 | 已交付 |
  | Cohort / compatibility gating | WP-49 | `DrillMetricRegistry.ts:265-268`（quality gate）、`:34-41`（`toTrendCompatibilityKey` 不含 quality status） | — | 已交付 |
  | Replay compatibility 分級（full/partial/unsupported） | WP-50 | `src/replay/replayCompatibility.ts:68-116` `classifyReplaySupport()`：exact-drillId 精確查表（無 fallback，:34-36），`minimumPlayable:['camera']`（:27） | 6 個官方 Assessment exact drillId 皆 `full` | 已交付 |
  | Seek-by-time 決定性 | WP-50 | `src/replay/ReplayPlayer.ts:33-42,73-89`：注入式 clock `frame(nowMs)`／`doSeek()`，模組內無 wall-clock 讀取 | — | 已交付（state-hash 對照見 T-exit progress） |
  | Replay 期間排他場景擁有權（禁 live Pointer Lock） | WP-50 | `src/main.ts:295`：`if (replayScreenHandle?.visible===true) return;`（canvas click handler） | D-50-P31 | 已交付；`replay.spec.ts` 有 0-call Pointer Lock 斷言 |
  | Result/History→Replay→Back 導覽 | WP-50 | `src/replay/ReplayController.ts`（純狀態機，無 DOM import）；`main.ts` 接線見 WP-50 T6 commits | — | 已交付（`ReplayController.test.ts` 11 cases） |
  | `FPS_HISTORY_ROOT` root injection（Playwright） | WP-48 | `playwright.config.ts:23,30`：dev/preview 各自 `.playwright-tmp/history-{dev,preview}` | — | 已交付，workspace-contained |
  | Vite History plugin + COOP/COEP | WP-48/WP-0 | `vite.config.ts:12-32,37`：`plugins:[coopCoep(), historyPlugin()]`，dev/preview 皆掛 | — | 已交付 |
  | DEV-only 完成測試掛鉤 | WP-48/WP-49 | `src/main.ts` `window.__fpsTest = {...}`，`import.meta.env.DEV` 守衛（含 `saveToHistory`/`showResultAndSaveToHistory` 等） | — | 已交付，production bundle 剝除 |

  **確認一項 handoff blocker（README §0 item 7，未解）**：`tests/history/testHelpers.ts:17`
  `makeTempRoot()` 仍用 `fs.mkdtemp(path.join(os.tmpdir(), prefix))`——真實 OS temp，非
  workspace-contained root；WP-48 progress.md 自陳為既有慣例（刻意維持，非本次回歸）。此為
  **Vitest/Node-level fs 測試層**的既有做法，與 **Playwright/E2E 層**（已 workspace-contained，
  `FPS_HISTORY_ROOT`）分屬不同層級，不互相污染真實 `data/session-history/`。WP-51 自己
  `tests/stage10/Stage10Runner.test.ts`／`Stage10AcceptanceEnvironment.test.ts` 的 Vitest 單元測試
  fixture 也同樣用 `os.tmpdir()`——與此為同一種、已被上游接受的慣例（純 harness 邏輯單元測試，
  非驗證真正的 M18 acceptance root），**不算新缺口**；M18 acceptance 本身的 root（`Stage10Runner`
  真正跑 dev/preview 時用的 `.playwright-tmp/stage10/<runToken>/`）已在 T1 落地為
  workspace-contained（見上方 T1 evidence）。此 handoff blocker 記錄於此，不在 WP-51 默默放寬，
  也不回頭修改 WP-48（不影響 M18 阻塞，純屬 test hygiene 觀察）。

  **確認一項 planned-vs-actual 落差**（README §1.3 constraints）：「failure injection優先使用
  WP-48已核准injectable filesystem seam」——讀 `server/history/HistoryRepository.ts:55-107`
  （`CreateHistoryRepositoryOptions`）後確認**沒有**這樣的 fs port；建構參數只有
  `root`/`maxPayloadBytes`/`now`，無可注入的 `fs` 實作供模擬 EACCES／ENOSPC 等寫入失敗。
  WP-48 實際做法是：（a）`HistoryClient`/`HistoryPersistence` 層用 fake-fetch 模擬 API
  timeout/network/5xx（`HistoryClient.test.ts`/`HistoryPersistence.test.ts`），（b）bootstrap
  corrupt/unsupported JSON 靠**在真正的檔案系統路徑放壞檔**（T1 `Stage10FixtureFactory` 已用此
  法）。**回應（README T0 失敗模式表「planned DTO與actual implementation不同」）**：T3 的
  failure/recovery 驗收改以這兩種已存在的機制為準——API 層失敗走 fake-fetch/mock unit 層
  （非 Stage 10 E2E 範圍，已由 WP-48 T4 覆蓋，T3 只需引用不必重做）；filesystem 層失敗（corrupt
  JSON、conflict、鎖檔 423）走真實檔案操作（放壞檔/佔用 lease 檔），不假設一個不存在的
  fs-injection port；不回頭要求 WP-48 補建 port（超出 WP-51 harness/wiring 授權範圍）。

  **Baseline 重跑**（HEAD `c52bf07`，Node v25.9.0，Windows 11 Enterprise 10.0.26100 64-bit）：

  | Command | Result | 備註 |
  |---|---|---|
  | `npm run typecheck` | exit 0 | browser + `tsconfig.node.json` 兩層皆 0 錯誤 |
  | `npm run test`（Vitest） | exit 0，185 files passed + 1 skipped（186）／1653 tests passed + 2 skipped（1655），14.20s | 對比 WP-48 T0 記錄的 137 files／1,081 tests，成長反映 WP-48 T1～WP-50 T-exit + WP-51 T1 的累積交付，非固定 gate |
  | `npm run build` | exit 0，2.17s | 既有 chunk >500kB 警告（pre-existing bundling，非 Stage 10 引入，不列為 regression） |
  | `npm run test:e2e`（Playwright，`edge` project） | exit 0，58/58 passed，2.4min | 目前 `playwright.config.ts` 僅設一個 project（`edge`／`msedge` channel），無 Chrome、無 WebGL2 fallback project |

  零既有失敗；本次 baseline 無需分類 pre-existing vs regression。

  **Dev/preview/manual、browser matrix、root、failure injection 策略凍結**：

  - **Dev/preview 分層**：沿用 T1 已落地的邊界——dev 用 `window.__fpsTest` DEV-only hook 驗證
    completion→autosave；preview 只用公開 History API seed + 公開 UI 導覽驗證
    History→Result→Replay（OQ-51.3 決策，見下）。
  - **Browser matrix（OQ-51.2 決策）**：採 README recommended default——CI/system Edge 自動化
    （現狀已是唯一 automated project，`playwright.config.ts:14`）；latest Chrome + Edge 各做一次
    人工 WebGPU walkthrough；WebGL2 fallback 自動化。**凍結但記錄兩個未落地缺口**留給 T4／T5：
    （a）目前 `playwright.config.ts` 沒有 Chrome project，也沒有 WebGL2 fallback project——這兩者
    需要在 T4（scale/lifecycle/a11y）或 T5（manual release）前補上，屬於**新增 Playwright
    project／harness 工作**，非本次 T0 範圍；（b）本機（開發機）**未安裝 Chrome**
    （`C:\Program Files\Google\Chrome` 與 x86 路徑皆不存在）——T5 人工 Chrome walkthrough 需要
    另一台機器或先安裝 Chrome，記為 T5 前置阻塞項。
  - **Reference hardware/browser（環境 manifest）**：OS Windows 11 Enterprise 10.0.26100
    64-bit；GPU：NVIDIA GeForce RTX 4070 Laptop GPU（driver 32.0.15.7703，獨顯，供 WebGPU 人工
    驗收使用）+ Intel UHD Graphics（內顯，供 WebGL2 fallback 對照）；Edge 系統版本
    151.0.4129.101（Playwright `channel:'msedge'` 使用的即此系統安裝版本）；Chrome 未安裝
    （見上）。
  - **Failure injection 策略**：見上方 planned-vs-actual 落差段落——API 層用既有 fake-fetch
    unit 測試（不重做），filesystem 層用真實壞檔/lease 佔用（T1 fixture factory 模式延伸），
    不依賴不存在的 fs-injection port。
  - **Fixture roster**：沿用 T1 `Stage10FixtureFactory.ts` 已交付的 roster（`runToken`-scoped
    synthetic participant/run identity、多 participant、tie-break、unregistered-metric、
    incompatible cohort、Practice 排除、corrupt/unsupported bootstrap JSON）；T2 起需擴充
    full/partial/unsupported/invalid replay fixtures（T1 evidence log已註記延後，WP-50 交付後
    現在可以做）。

  **OQ-51.1～3 結論**（依 README recommended default 定案，屬可逆決策——T-exit 前如使用者/產品
  owner有不同意見仍可調整）：

  | OQ | 結論 | Owner／日期 | Rationale |
  |---|---|---|---|
  | OQ-51.1 | **是**——真實硬體 3D fidelity／Pointer Lock／walkthrough 阻擋 M18 | 預設定案 2026-08-31，待使用者/產品owner最終確認，deadline T5 前 | Replay 是本階段核心語意，synthetic DOM/state assertion 無法證明實機 WebGPU 視覺正確性 |
  | OQ-51.2 | system Edge 自動化 + Edge 人工 WebGPU/GPU/a11y walkthrough；Chrome manual 與 WebGL2 fallback automated project 正式豁免為 post-M18 debt | 2026-09-01 使用者/product-tech owner 決策 | M18 prototype 不因 Chrome 未安裝或缺 WebGL2 project 阻塞；若 scope 升級為正式跨瀏覽器發布，此 waiver 失效 |
  | OQ-51.3 | 接受——preview 只驗公開 History→Result→Replay，完成→autosave 由 dev automation 覆蓋 + preview 人工補足 | 預設定案 2026-08-31（已是 T1 實作現狀），待使用者/架構owner確認 | DEV hook 刻意不進 production bundle（FR-48.10），這是唯一不需開後門的驗證路徑 |

  **T1/T2 交接**：T1 target 清單（README §2.1）與已交付檔案一致，無 planned-but-undelivered
  target。T2 entry blocker 全數解除——WP-48／49／50 exit evidence 齊備、fixture roster 可擴充
  full/partial/unsupported/invalid replay case、dev/preview/browser policy 已凍結。**CodeGraph
  impact**：本次 T0 純讀碼稽核與文件更新，未修改任何既有 symbol，故不適用 impact 分析
  （T0-entry-gate.md 步驟 5 僅在「將修改的既有 symbol」時才要求）。

- **2026-08-31**：**T2 進行中**（第一個切片）— `tests/stage10/stage10-restart.integration.test.ts`。

  範圍判斷：`tests/history/historyRepository.test.ts` 已證明單一 run 的 restart 機制（WP-48 exit
  evidence）；`Stage10FixtureFactory.test.ts`（T1）已證明 tie-break 不合併、cohort 分離、
  unregistered-metric 投影、corrupt/unsupported bootstrap 偵測皆在**單一** repository instance 存活期間
  成立。FR-51.4 真正尚未被證明的，只有這些性質是否在 close()→reopen()（同 root、不共享記憶體）**之後**
  仍然整批成立——這正是本切片的唯一範圍，刻意不重做上游已覆蓋的部分。

  做法：用 `buildStage10Fixtures` 建立完整 roster，寫入 corrupt/unsupported bootstrap 檔 → 建
  repository A → initialize → 存入全部 assessment payloads（Practice 確認被拒）→ snapshot（participant
  順序／每個 participant+drill 的 run 列表／每個 run 的 loadRun payload）→ close → 建 repository B（同
  root）→ initialize → 重新 snapshot → 斷言兩次 snapshot deep-equal，並額外針對 tie-break 順序、cohort
  分離（reload 後的 payload 仍被 `DrillMetricRegistry`／`checkCompatibility` 判為不相容）、
  unregistered-metric 投影、Practice 缺席個別具名斷言（deep-equal 本身失敗時只會說「不一樣」，具名斷言
  才能指出壞在哪個性質）。

  一個 surprise：`HistoryIndexReport`（`initialize()` 回傳值）是呼叫當下的快照，不是活的計數器——
  `firstReport`（在 saveRun 之前 initialize）的 `validRunCount` 是 0，不能拿來跟 `secondReport`（restart
  後、已包含全部 run 的 initialize）比較；改為跟 `assessmentPayloads.length` 比較，`invalidFileCount`／
  `unsupportedFileCount`（bootstrap 檔案、兩次 initialize 之間未變動）才是可比的部分。

  驗證：`npx vitest run tests/stage10/stage10-restart.integration.test.ts` 綠燈；`npm run typecheck`
  exit 0。

  **T2 尚未完成**：preview production-bundle smoke（公開 API seed + 公開 UI、無 DEV hook）、dev canonical
  Assessment 與 current/historical parity、replay full/partial/unsupported 的 Stage10-owned automated
  evidence 仍待後續切片。

- **2026-08-31**：**T2 進行中**（第二個切片）— `tests/e2e/stage10-preview.spec.ts`（FR-51.5/51.7/
  51.8/51.11、OQ-51.3）。

  範圍判斷：沒有任何既有 spec 對 preview（4173）跑過完整 UI journey——`history-api-health.spec.ts`／
  `isolation.spec.ts` 只驗 health/headers，`history-library.spec.ts`／`replay.spec.ts` 只在 dev 跑。本
  切片用 Stage10FixtureFactory 的完整 roster，只透過公開 `POST /api/history/runs` API seed（不用
  `__fpsTest`），從公開 History UI 走完 tie-break／exact grouping／unregistered-metric／Practice 排除／
  unsupported Replay，證明這些既有 UI 契約在**真正 production bundle**（`vite build && vite preview`）
  上同樣成立，而不只是在 dev。

  兩個 surprise（皆已用真實瀏覽器驗證，非猜測）：
  1. Stage10 fixture 的 `events: []`（`makeAssessmentPayload` 預設）→ `visibleSampleCount=0` →
     `qualityGateStatusForPayload`（`src/history/DrillMetricRegistry.ts:265`）判定未過 quality gate →
     `listCompatibilityCohorts` 過濾掉兩筆 spider-shot-v2 cohort run → cohort 選擇器完全不 render（不是
     顯示 1 個，是 0 個按鈕）。原本斷言「cohort selector 顯示 2 個按鈕」是錯的——改為斷言兩筆 run 仍各自
     是獨立 run-list row（未被合併）且 trend 顯示明確的 `insufficient-data` 訊息（README
     TREND_EMPTY_REASON_LABELS，「目前沒有足夠的合格資料...quality gate 排除」）。這其實是額外收穫：
     「registered drill 但 0 筆過 quality gate」這個 trend empty-state，WP-49 自己的
     `history-library.spec.ts` 從未測過（它的 fixture 都靠真實 sim tick 通過 quality gate）。
  2. `ReplayScreen.ts` 的 unsupported panel（`data-section="replay-unsupported"`）自己另外 append 了一顆
     文字/action 都是「返回」/`back` 的按鈕，跟 top bar 的返回鈕重複——`getByRole('button',{name:'返回'})`
     在 `unsupported` 狀態下會撞兩個元素（strict-mode violation）。改用
     `[data-section="replay-unsupported"] [data-replay-action="back"]` 精準定位到面板內那顆。

  驗證：`npx playwright test tests/e2e/stage10-preview.spec.ts --project=edge` 2/2 綠燈；
  `npx playwright test --project=edge`（全部 60 個既有 + 新 spec）60/60 綠燈，無 regression；
  `npm run typecheck` exit 0。

  **T2 尚未完成**：dev canonical Assessment 與 current/historical parity、replay full 的
  Stage10-owned automated evidence 仍待後續切片。

- **2026-08-31**：**T2 第三個切片**——`tests/e2e/stage10-assessment.spec.ts`（FR-51.3/51.5）。

  範圍判斷：`history-library.spec.ts`（WP-49）與 `replay.spec.ts`（WP-50）已經把 dev 上
  完成→autosave→History→exact-drill 瀏覽、以及 History／current→Replay→Back 證明得很完整；這個切片
  唯一新增的斷言，是兩邊都沒做過的一件事——**同一筆已存 run**，當下（live）Result 畫面與歷史
  Run Detail 畫面渲染出來的 metric 卡片必須逐一相同（`ResultDetailBody.ts` 檔頭本來就宣稱
  "current/historical presentation parity"／D-49.P4 是靠共用同一個 component 保證的；這個測試是在真實
  DOM 上驗證這個宣稱真的成立，不是只信任程式碼共用這件事本身）。

  做法：用 `__fpsTest` 完成一個真實（非空 ticks）的 `hold_click_v1` run（沿用
  `replay.spec.ts` 的 `SAMPLE_INPUT`）→ `showResultAndSaveToHistory` → 從 live `#result-screen`
  抓取所有 `[data-section="result-detail-body"] article[data-metric-id]` 的
  `data-metric-id`→`data-metric-value` → 順便驗證 live Result 的 3D 重播是 `full` →關閉 Result → 從
  History 導覽到同一個 runId 的 Run Detail → 抓同一組卡片 → 斷言兩邊 deep-equal → 再驗證 History 側的
  3D 重播同樣是 `full` 且 Back 正確返回。這個 capture 方式刻意不特例化 promoted/diagnosis 區塊
  （SAMPLE_INPUT 太短，兩邊有可能都落在 blocked/insufficient-data，不經過 `renderCard`）——兩邊卡片數
  一致就代表兩邊狀態一致，deep-equal 本身已涵蓋這個情況，不需要另外分支斷言。

  驗證：`npx playwright test tests/e2e/stage10-assessment.spec.ts --project=edge` 綠燈；
  `npx playwright test --project=edge`（61 個 spec 全部）61/61 綠燈；`npm run typecheck` exit 0。

- **2026-08-31**：**T2 第四個切片（收尾）**——擴充 `tests/e2e/stage10-preview.spec.ts` 加入
  `partial` Replay case（FR-51.8）。

  做法：沿用 `tests/replay/fixtures.ts`（WP-50 T2 既有的 `makeMeta`/`makeTick`/`makePayload`，Vitest
  `ReplayController.test.ts` 已用同一手法建構 partial fixture）——建 3 個真實、monotonic 的 tick，但不
  設 `scene`、不宣告 `replay` 契約，drillId 用已註冊 profile 的 `hold_click_v1`。這與 EMPTY_TICKS
  （unsupported）不同：`hasTrustworthyCamera` 為真，只是 `requiredForFull` 缺 `scene`／
  `target-lifecycle`，`classifyStatus` 判定 `partial`。透過公開 API seed（precompute runId 用
  `buildRunId`/`buildRunIdentity`，不猜 API 回應格狀）→ 公開 UI 導覽到 Run Detail → 點 3D 重播 →
  斷言 badge 文字「有限重播」、`data-support-status="partial"`、`replay-partial-banner` 可見，且
  transport（play-pause）仍存在（不是像 unsupported 那樣只有文字＋返回鈕）。

  一個 surprise：`makeMeta()` 預設 `vStrafe: 0` 在直接建構（Vitest 純函式測試）沒問題，但透過真實
  `POST /api/history/runs`（會跑 `parseExportPayload` 嚴格 schema）會被拒絕
  （`INVALID_EXPORT`／`meta.vStrafe` `invalid_value`）——這個預設值只在跳過 API 驗證的既有 Vitest 用法
  下成立，加一個 `vStrafe: 250` override 即可（沿用 `makeAssessmentPayload` 的值）。

  驗證：`npx playwright test tests/e2e/stage10-preview.spec.ts --project=edge` 3/3 綠燈；
  `npx playwright test --project=edge`（62 個 spec）一次 61/62（`replay.spec.ts` A-50.5 event-marker
  prev/next 計時性斷言 flake，與本次改動無關）、`--repeat-each=3` 重跑 21/21 全綠，確認是既有 flake非
  regression；`npm run typecheck` exit 0。

  **T2 範圍收斂**：`invalid` replay 狀態經 T0/Explore 確認是目前程式碼中沒有任何路徑會產生的保留分支
  （`ReplayScreenState`/`ReplayController` 都只實作 `idle|loading|error|unsupported|ready`），不在本 WP
  授權範圍內新增這個從未存在的產品語意（§2.6「未核准的新產品語意」）——`invalid`（schema 層解析失敗）
  的既有覆蓋在 `parseExportPayload`／corrupt-unsupported bootstrap 層（T1 已交付），run 從未進入
  History 列表，因此永遠不會走到 Replay UI；這不是缺口，是現行設計下該狀態本就不可達。至此 T2 的 8 個
  scenario 全數有 automated evidence（dev canonical＋restart integration test＋preview smoke 三個
  spec/test 檔案）；下一步是把 T2 checklist 翻 ✅ 並同步 README 狀態。

- **2026-08-31**：完成 **T3 — Failure, Recovery, Data Safety, and Races**（FR-51.9/51.10）。

  **範圍判斷**：`T3-failure-recovery-safety.md` 的 9 列 failure matrix 中，四列已有真實、無法靠重寫增加
  信心的既有證據，本次刻意不重做（README §2.6「未核准的新產品語意」/ T2 對 `invalid` Replay 狀態的同一
  紀律）：

  | Failure matrix 列 | 既有證據 | 判斷 |
  |---|---|---|
  | traversal/symlink/root escape | `tests/history/historyRepository.test.ts`「a symlink/junction planted at the participant segment is rejected before any write」；`server/history/historyPaths.ts` `sanitizeSegmentPrefix`/`buildIdentitySegment` 對任何字元一律 hash，無法繞過 | Node/repository 層已證明；重寫等於重新驗證同一段 domain 邏輯 |
  | scene asset failure/mismatch | `src/ui/replay/ReplayScreen.test.ts`「error shows the message, a retry action ..., and always a back action」 | component-level DOM 已覆蓋 loading/error/retry/back 四態 |
  | rapid navigation（A→B→Back/close） | `tests/e2e/replay.spec.ts`「Back then re-entering Replay on a different run never shows the previous run's stale content」（A-50.11）、`tests/e2e/history-navigation.spec.ts` | 真實瀏覽器等級已證明 stale-content/generation 防護 |
  | replay ownership race | `tests/e2e/replay.spec.ts`「Replay never lets a viewport click reach Pointer Lock ...」（A-50.10/NFR-50.5/50.11） | 真實瀏覽器等級已證明單一 owner／Pointer Lock 隔離 |

  這四列的 T3 貢獻是「重跑既有 spec 並取得 repeat×5 evidence」（見下方 repeat-run 結果），不是新增測試碼。

  **新增**（`tests/e2e/stage10-failure-recovery.spec.ts`，5 個 test，兩個 describe block）——涵蓋
  failure matrix 剩餘、真正沒有既有全端證據的列：

  1. **duplicate same/different content**（public API）：同一 payload 兩次 POST 為 idempotent
     （`existing` disposition、同 runId）；相同 identity 不同內容（`suspect` 翻轉）第二次 POST 得
     `409 RUN_CONFLICT`，且用 `GET /api/history/runs/:runId` 驗證原檔內容（`suspect:false`）未被覆寫。
  2. **not found**：用一個真實已存的 participant/drill（保證 `drills`/`participants` route 可達）搭配一個
     格式正確但從未存在的 64-hex runId，直接 hash 導覽到 `#/history/participants/.../runs/<fake>`——這是
     `HistoricalRunDetail.test.ts` 只在元件層用手動注入的 `RUN_NOT_FOUND` state 驗證過的分支，第一次在真實
     API 404→真實 DOM 路徑上驗證：`[data-section="historical-run-status"]` 顯示 `data-history-status="error"`
     + 「讀取失敗」文字、無重試按鈕（`RUN_NOT_FOUND` 非 retryable）、點擊「返回 Run 列表」正確回到
     `drill-overview`。
  3. **path-traversal participantId（NFR-51.3 outside-sentinel 佐證）**：`participantId` 帶
     `../../../../etc/passwd-<uuid>`，經真實公開 `POST /api/history/runs` 送出——確認存進去的
     run 仍可用同一（hash 過的）識別讀回、且用 `Stage10AcceptanceEnvironment.ts` 既有的
     `writeOutsideSentinel`/`verifyOutsideSentinelUnchanged`（**新 export**，供本檔重用同一份 sentinel
     機制，不重寫第二套）快照真實 `data/session-history/`，證明整條公開 API 路徑不會讓惡意字元逃出
     server 自己的隔離 root。這不是重新證明 WP-48 的 containment defense（那是 Node 層已完成的事），
     是補「全端 + outside sentinel」這個 Stage10 專屬角度。
  4. **API unavailable**：`page.route('**/api/history/**')` 攔截並 `abort()`（純瀏覽器層網路故障注入，不碰
     OS ACL／專案資料，符合 T3.md work item 1 的「domain-approved injectable seam」）；History 畫面顯示
     `[data-section="participant-status"]` 的「讀取失敗」+ 可重試按鈕（`NETWORK_ERROR` retryable:true），
     解除攔截後點「重試」即恢復並看得到剛才用公開 API 種下的 Participant。這補的是 DOM/UI 恢復流程的真實
     瀏覽器證據——WP-48 T4 的 `HistoryClient.test.ts`/`HistoryPersistence.test.ts` 已用 fake-fetch 在
     unit 層驗證同一組 retryable 語意，但從未驗證過真實 `ParticipantBrowser` DOM 真的會依此渲染出重試路徑。
  5. **save failure + 一次成功 retry 只建立一筆 run**：同一種 `page.route` 技巧只擋 `POST
     /api/history/runs`，搭配 `__fpsTest.showResultAndSaveToHistory` 產生一次真實（有 ticks/events）的
     Assessment 完成→保存失敗（`NETWORK_ERROR`, retryable:true）。斷言：（a）當次 Result 畫面
     （`#result-screen`）仍可見、「匯出 JSON」按鈕仍可用（不受保存失敗影響，FR-51.9「current
     Result/manual download仍可用」）；（b）`[data-section="history-save-status"]` 顯示
     「Save to history failed」；（c）解除攔截後呼叫 `__fpsTest.retryHistorySave()` 成功
     （`disposition:'created'`），且用 `GET .../runs` 確認該 participant/drill 下只有**一筆** run——證明
     失敗重試不會產生半筆或重複紀錄。

  一個 surprise（已修正，非遺留）：path-traversal 測試最初用固定字串
  `'../../../../etc/passwd'`（無 uuid 尾碼），第一次獨立跑通過，但接到全部 67 個 spec 一起跑時失敗
  （`expect(201) received 200`）——因為 `.playwright-tmp/history-dev` 是所有 `tests/e2e/*.spec.ts` 共用、
  跨次 `npx playwright test` invocation 不會清空的真實 root，固定 identity 在第二次執行時撞到自己上次
  存的 run（變成 `existing` disposition 而非 `created`）。改成 `${...}-${crypto.randomUUID()}` 後穩定
  重現 201。其餘 Stage10 fixture 慣例本來就已對 identity 做 `runToken`/uuid 化，這次是漏了一個手寫的
  ad hoc payload，不是新發現的產品缺陷。

  **驗證**：
  - `npx playwright test tests/e2e/stage10-failure-recovery.spec.ts --project=edge` 5/5 綠燈（獨立跑）。
  - `npx playwright test --project=edge`（全部 67 個既有 + 新 spec）67/67 綠燈，無 regression。
  - `npx playwright test tests/e2e/stage10-failure-recovery.spec.ts tests/e2e/replay.spec.ts --project=edge
    --repeat-each=5 --retries=0`（NFR-51.2 repeat×5 zero-failure gate）：新 spec 的 5 個 test × 5 repeat
    = **25/25 綠燈**，零失敗。同批次 `replay.spec.ts` 出現 1 次既有 flake
    （`event markers ... prev/next` 的 seek 計時性斷言，`afterPrev <= afterNext` 差 85ms）——與 T2 第四個
    切片（2026-08-31）已記錄的「A-50.5 event-marker prev/next 計時性斷言 flake」是同一個既有問題，非本次
    改動造成的 regression，不重跑掩蓋，如實記錄。
  - `npm run typecheck` exit 0；`npm run test`（Vitest）186 files／1654 tests 全綠，無 regression（含
    `Stage10AcceptanceEnvironment.ts` 新增 `export` 後）。

  **交付檔案**：`tests/e2e/stage10-failure-recovery.spec.ts`（新檔，5 test）；
  `tests/stage10/Stage10AcceptanceEnvironment.ts`（把既有內部 `writeOutsideSentinel` 改為 `export`，供
  E2E spec 重用同一份 sentinel 機制，未新增第二套邏輯）。

  **T3 DoD 自評**：failure matrix 9 列皆有 automated evidence（5 列新測試 + 4 列既有測試引用 +
  repeat×5 重跑）；atomic/idempotent/conflict/path/symlink/sentinel 斷言通過，無半檔與 root escape；
  API/save failure 不影響 current Result/manual download，retry 只建立一筆 Assessment；
  corrupt/unsupported/not-found/scene failure 不 crash、不 stale commit（沿用 T1/T2 + 本次 not-found
  證據）；navigation/payload/scene/presentation races repeat×5 zero failure（既有 flake 除外，如實記錄非
  掩蓋）；真實 root／outside sentinel 前後 hash/mtime 一致，錯誤訊息無絕對路徑洩漏（`STORAGE_IO`/
  `RUN_NOT_FOUND` 等錯誤訊息皆為固定文字，不含 root path，見 `historyApi.ts` `err()` 呼叫處）。

- **2026-08-31**：**T4 進行中**（第一、二個切片）— `tests/e2e/stage10-accessibility.spec.ts`（FR-51.13/
  NFR-51.6）與 `tests/e2e/stage10-lifecycle-scale.spec.ts`（FR-51.12/NFR-51.4）。

  **範圍判斷**：既有 spec 全部用 `.click()` 驅動 History/Replay，從未有一支真正只用鍵盤事件
  （`page.keyboard.press()`）走完整條 launch→History→Participant→drill→run→Replay controls/events→
  Back 路徑；`tests/replay/presentation-lifecycle.test.ts`（WP-50 T3）已在 Vitest 層對 mocked
  renderer 證明 50 次 enter/leave 零殘留 scene children，但從未在真實瀏覽器、真實
  `ReplayScreen`/`ReplayController`/`PresentationCoordinator` 接線下驗證過同一件事，也從未量過真實
  abort commit 時間。這兩個切片就是補這兩塊。

  **意外發現並診斷兩個真實既有缺陷**（詳見 [KI-017](../../../../known_issue/KI-017-history-replay-tdz-referenceerror-on-early-replay-click.md)／
  [KI-018](../../../../known_issue/KI-018-history-search-keystroke-focus-steal.md)，已於前一個獨立
  commit 記錄，本次不重複貼細節）：

  1. **KI-017（WP-50 owner）**：Run Detail「3D 重播」在 `main.ts` 頂層 `const replayController`
     初始化完成前被點擊／鍵盤觸發會拋出未捕捉的 TDZ `ReferenceError`，靜默無反應——與已修的 KI-013
     同一類根因，只是換一個變數。第一次撰寫鍵盤流程測試時，因為沒有像其他既有 dev-mode spec 一樣先
     `await` `window.__fpsTest` 掛上，比一般測試更快走到這一步，意外重現（`page.on('pageerror', ...)`
     捕捉到完整 stack）。**回應**：不修 `main.ts`（超出 WP-51 授權），測試側比照既有慣例先等
     `__fpsTest`，繞開這個競態但不掩蓋——已寫入 KI-017 供 WP-50 承接。
  2. **KI-018（WP-49 owner）**：History「搜尋 Participant」用真實 `page.keyboard.type()` 逐字輸入時，
     只有第一個字元留在欄位——`navigator.replace()`（search-as-you-type）每次都給
     `HistoryScreen.render()` 的 focus-on-navigation guard（`route !== lastRoute`，參考相等）一個
     全新物件，被誤判為真正導覽而把焦點搶回 `<main>`。既有 spec 全部用 `.fill()`（單次設值）填搜尋欄，
     從未用真實逐字輸入測過這條路徑。**回應**：不修 `HistoryScreen.ts`/`ParticipantBrowser.ts`，測試
     側改用「fixture `startedAt` 設在極遠的未來，讓它永遠排在未搜尋清單的第一列，直接 Tab 選取」繞開，
     不執行會觸發此 bug 的逐字搜尋——已寫入 KI-018 供 WP-49 承接。

  **兩個額外的、只在真實迭代中才會發現的測試方法論陷阱**（非產品 bug，記錄避免下次重踩）：

  3. `tabUntilButton` 的第一版斷言用 `document.activeElement?.textContent.includes(needle)` 判斷是否
     已 Tab 到目標列——但 `<main>`（`HistoryScreen`/`ReplayScreen` 導覽後聚焦的 tabindex=-1 容器）的
     `textContent` 會遞迴串接所有子孫節點的文字，導致還沒按任何一次 Tab、焦點仍在 `<main>` 本身時
     斷言就假性成立。改成同時檢查 `tagName === 'BUTTON'`。
   4. 固定字面值 `FIXTURE_STARTED_AT`（一個寫死的未來日期）在單獨執行時可行，但在
      `--repeat-each`／全 suite 平行執行下，多個並行 worker 或多次本機重跑會產生多筆
      **完全相同**的 `startedAt`——`listParticipants` 對相同 `latestStartedAt` 用 `participantId`
      字面排序 tie-break，導致目標列被擠到 Tab 按壓預算之外。改成
      `fixtureStartedAt()`（未來錨點 + `Date.now()`），讓每次呼叫都嚴格大於所有過去呼叫，即使在共用、
      從不清空的 `.playwright-tmp/history-dev` root 上累積再多次歷史紀錄也不會相撞。
   5. `stage10-lifecycle-scale.spec.ts` 的 50-cycle 測試第一版直接對「每個 `EventTarget`」計數
      `addEventListener`／`removeEventListener` 淨值，50 次循環後從 228 漲到 678——但這不是真的洩漏：
      `ReplayTransport` 的按鈕/輸入框本來就設計成「每次 `render()` 整組重建」（`ReplayScreen.ts`
      自己的註解），而對一個已從 DOM 移除的子樹呼叫 `.remove()`**不會**觸發其子孫節點的
      `removeEventListener`（瀏覽器改用垃圾回收處理，不是顯式解除註冊）——這是正確實作下的預期行為，
      不是成長。改成只計 `window`/`document`（唯二真正跨越每個循環存活的對象），並額外加一個
      `document.querySelectorAll('*').length` 的總 DOM 節點數斷言（作為「有沒有 subtree 真的沒被清
      乾淨」的獨立訊號），兩者在真實 50 次循環後都精確回到 baseline。
   6. abort-timing 測試第一版用 `Date.now()`包住一次 Playwright `.click()` +
      `expect().toBeHidden()`，量到 132ms（略超 100ms 預算）——但讀
      `ReplayController.close()`/`ReplayScreen.hide()` 原始碼確認整條 abort 路徑是完全同步的單一
      call stack（無 `await`），132ms 幾乎全部是 Playwright 自己的 IPC／assertion polling
      overhead，與 app 實際 commit 速度無關。改成整個量測搬進
      `page.evaluate()`（`performance.now()`包住一次合成 `.click()`，同一 call 內立即讀
      `root.style.display`），準確反映 NFR-51.4 真正在意的「同步 commit 有多快」，不是「test harness
      的往返成本」。

  **驗證**：
  - `npx playwright test tests/e2e/stage10-accessibility.spec.ts --project=edge --repeat-each=5
    --retries=0`：5/5 綠燈（含平行 worker 下亦綠，證明 surprise #4 的修正確實有效）。
  - `npx playwright test tests/e2e/stage10-lifecycle-scale.spec.ts --project=edge --repeat-each=3
    --retries=0`：6/6 綠燈。
  - `npx playwright test --project=edge`（全部 70 個既有 + 2 新 spec）：70/70 綠燈。同一批次曾出現
    `full-drill.spec.ts` 兩個 harness-readiness timeout（全 70 個 spec 一次全平行跑的資源競爭），
    獨立重跑（只跑那兩個 test）100%綠燈，確認是全 suite 平行負載下的既有資源競爭 flake、非本次改動
    造成的 regression，如實記錄非掩蓋（沿用 T2/T3 已建立的「既有 flake 不重跑掩蓋」紀律）。
  - `npm run typecheck`：exit 0。
  - `npm run test`（Vitest）：186 files／1654 tests 全綠，與 T3 baseline 一致，無 regression。

  **T4 尚未完成**：5,000-run History 首 100 rows P95、100-run analysis cold/warm、42,000-tick Replay
  cached-first-frame/seek 的真實瀏覽器量測（matrix rows 1-3）；acceptance command wall time 記錄。
  （下一個切片已補上 network/response-shape 直接驗證，見下條。）

- **2026-08-31**：**T4 進行中**（第三個切片）— `tests/e2e/stage10-projection-shape.spec.ts`
  （FR-51.12，DoD「scale UI只讀summary/analysis projection，未批次下載full payload」）。

  **範圍判斷**：既有全部 spec 都是斷言 DOM 內容，從未有一支直接檢查瀏覽器實際收到的 HTTP response
  body 形狀——「List/detail 不下載 full payload」目前完全只靠信任 client 程式碼寫得對，沒有真正的
  network-level 證據。本切片用 `page.on('response', ...)` 攔截整條 History 導覽期間所有
  `/api/history/*` 回應，對每個 list 端點（`participants`／`.../drills`／`.../drills/:id/runs`）的
  JSON body 遞迴掃描是否含有 `ticks`/`events` 陣列欄位；同時對 run-detail 端點
  （`GET /api/history/runs/:runId`）反向斷言**必須**含有兩者，作為「這個掃描方法真的抓得到东西」的
  sanity check（避免斷言在一個永遠找不到任何東西的壞掃描器上假性通過）。

  一個小 bug（撰寫時發現，非產品缺陷）：檔案頂層原本沿用既有慣例宣告了
  `const URL = 'http://localhost:5173/'`，這個名稱**遮蔽了 Node 全域的 `URL` 建構子**——測試內用
  `new URL(url).pathname` 判斷是否為 run-detail 端點時直接拋 `TypeError: URL is not a constructor`。
  改名為 `BASE_URL`（其餘既有 spec 之所以沒踩到，是因為它們從未在同一個檔案裡同時用到字串常數
  `URL` 與全域 `URL` 建構子）。

  **驗證**：`npx playwright test tests/e2e/stage10-projection-shape.spec.ts --project=edge
  --repeat-each=5 --retries=0` 5/5 綠燈；`npx playwright test --project=edge`（全部 71 個既有 + 新
  spec）71/71 綠燈，無 regression；`npm run typecheck` exit 0；`npm run test`（Vitest）186 files／
  1654 tests，與 baseline 一致。

  **T4 尚未完成**：5,000-run History 首 100 rows P95、100-run analysis cold/warm、42,000-tick Replay
  cached-first-frame/seek 的真實瀏覽器量測（matrix rows 1-3）；acceptance command wall time 記錄。

- **2026-08-31**：**T4 進行中**（第四個切片，opt-in benchmark）— `tests/stage10/stage10-scale.perf.ts` +
  `scripts/run-stage10-scale-benchmark.mjs` + `package.json` `test:stage10:scale`（README §2.5
  「measurement」grade，matrix rows 1-3：History 首 100 rows P95、100-run analysis cold/warm、
  42,000-tick Replay cached-first-frame）。

  **範圍判斷**：`historyRepository.perf.test.ts`（WP-48，opt-in）已覆蓋 5,000-run cold rebuild／warm
  list 的 Node-level一半；`replay-perf.test.ts`（WP-50）已覆蓋 `normalizeReplayRecording`／
  `sampleReplay` 在 42,000-tick 規模下的 pure-function P95。這支腳本補跨層那一半：在**真實 dev
  bundle**上用**真實瀏覽器**（msedge channel）跑這些 gate，而不是再猜一次 pure function 效能。刻意
  用 `Stage10Runner`（T1 既有的 fresh dev server lifecycle）配一個**專屬、剛配置的隔離 root**，不是
  全部其他 Playwright spec 共用、從不清空的 `.playwright-tmp/history-dev`——那個共用 root 已在本次
  session 的 T4 前幾個切片撞過兩次「因為歷史累積筆數太多，P95 樣本失真」的坑（見下方 Surprises），
  對一支效能量測腳本而言，用被污染的資料集本身就會讓 P95 失去意義。

  Fixture 直接寫檔（bypass 公開 API，比照 WP-48 `historyRepository.perf.test.ts` 既有的
  `seedFixtures` 手法）：150 個單一 participant（每人 1 drill／1 run，> `ParticipantBrowser` 的
  `CHUNK_SIZE=100`，讓「首 100 rows」真的有意義）、1 個 participant 在已註冊指標的
  `spider-shot-v2` 下有 100 筆 run（100-run analysis gate）、1 筆真實 42,000-tick（對齊
  `replay-perf.test.ts` 自己的 `capacityForDrill(128,300)` 數字）、`scene.assetPackVersion` 對齊真實
  `peek-corridor-v1`（比照本次 T4 前面切片已修過的同一個坑）的 `full`-classified run。

  **開發過程中的三個 surprise**（皆已修正並記錄，避免下次重踩）：

  1. 檔案開頭的 JSDoc 註解裡寫了 `5,000-run *cold rebuild*/warm-list`——markdown 斜體語法的
     `*.../*` 剛好組出一個 `*/`，esbuild 把它當成註解提早結束，後面的英文字被當成程式碼解析，直接
     `Transform failed`。改寫成不含 `*/` 序列的措辭。
  2. 「100-run analysis cold/warm」第一版兩次都走「關閉 History→重新打開→搜尋→點 participant→點
     drill」整條鏈——warm（271ms 附近）量到比 cold 還慢，因為兩次量的其實都是同一條「關閉/重開 +
     150+100 筆 participant 清單重新渲染」鏈路，根本沒有隔離出「同一個 drill overview 被重新造訪」
     這件事本身的成本。改成 warm 只用麵包屑 `[data-history-crumb="drills"]` 回到 drill 清單、再點同一
     個 drillId——不離開 History、不重新搜尋——之後 cold=336~401ms／warm=234~287ms，warm 穩定小於
     cold，符合直覺。
  3. 「42k-tick Replay cached-reopen」第一版只採**單一樣本**（`Date.now()` 包一次 close→reopen），
     量到 1502ms／1506ms（budget 1500ms 邊緣）、也有一次 884ms——同一支腳本、同一台機器，數字大幅
     跳動。改採多樣本 P95（比照本檔自己「History 首 100 rows」已經在用的 10-sample P95 紀律）後，
     15 個樣本裡混著多數 650-950ms 與少數 1300-1900ms 的離群值，P95 本身仍隨著離群值恰好落在哪個
     百分位而在 1469ms（過關）與 1927ms（不過關）之間跳動——見下方「尚待釐清」。

  **驗證**：`npm run typecheck` exit 0；`RUN_STAGE10_SCALE_BENCHMARK=1 npm run test:stage10:scale`
  本機實測 5 次（含改進 sample count 前後），History 首 100 rows P95 穩定 205-213ms（< 500ms
  budget，穩定通過）；100-run analysis cold 336-401ms（< 2000ms，穩定通過）／warm 234-287ms
  （< 300ms，穩定通過）；42k-tick cached-reopen P95（15 samples）兩次分別為 1469ms（過關）與
  1927ms（不過關）——**尚待釐清，未強行判定通過**（見下）。跑完後 `netstat` 確認 5173 port
  無殘留 LISTENING；`npm run test`（Vitest，確認 `.perf.ts` 副檔名不被既有 `vite.config.ts`
  `test.include` 收）186 files／1654 tests 不變；`npx playwright test --project=edge`
  （既有 71 個 spec）本次出現兩個失敗——`history-library.spec.ts`「search filtering is
  client-side」與`replay.spec.ts`「event markers...prev/next」——獨立重跑（只跑這兩個 test）確認
  前者為本機此時背景負載（連續跑 5 次 scale benchmark，`Get-Process`確認同時有 20+ 個 msedge／
  msedgewebview2 process 佔用中）造成的資源競爭 flake（獨立跑綠燈）、後者是已記錄多次的既有
  `replay.spec.ts` A-50.5 計時性斷言 flake（同一種 off-by-small-margin 訊號：`afterPrev<=afterNext`
  差 85-95ms 量級），皆非本次改動造成的 regression，如實記錄非掩蓋。

  **尚待釐清（誠實記錄，不強行判定綠燈）**：42,000-tick Replay 的 cached-reopen P95
  在本機（Windows 11、RTX 4070 Laptop、Edge msedge channel，同一份 T0 記錄的 reference hardware）
  多次量測落在 884ms～1927ms 之間，對 1500ms budget 而言時而通過時而略微超標——樣本本身（多數落在
  650-950ms，偶爾出現 1300-1900ms 的離群值）較像是這台開發機當下背景負載造成的 jitter（同一時段
  `Get-Process` 顯示大量 msedge/msedgewebview2 佔用），而非可重現的效能回歸；但這是主觀判斷，未經
  乾淨環境（無背景負載）對照驗證，**不排除是真實需要 WP-50 關注的問題**。依 README T4 failure
  modes 表「benchmark噪音／冷暖混淆 → 固定dataset、warmup與sample count；報告P95/environment，不調寬
  threshold掩蓋」的紀律：本切片**不**放寬 1500ms budget、**不**捨棄離群樣本、如實記錄全部原始樣本
  （見 evidence JSON 與上方 log）。此列**留給 T5 或 WP-50 在較安靜的環境下重跑確認**，T4 DoD 的
  「所有matrix gates達標」暫不能整列打勾。

- **2026-08-31**：**T4 進行中**（第五個切片）— `tests/stage10/cli.ts` 補
  acceptance command wall time 記錄（NFR-51.5、DoD「acceptance command wall time有記錄；任何豁免有
  owner/deadline而非靜默跳過」）。

  **範圍判斷**：T1 交付的 `npm run test:stage10` 從未記錄過自己的總執行時間，NFR-51.5 的
  10 分鐘 budget 只停留在文件層級、從未有一次真實量測對過帳。這是 WP-51 自己的 acceptance
  harness（`tests/stage10/cli.ts`），不是 domain code，修改在授權範圍內。

  **做法**：在 `main()` 包住 `runStage10Acceptance(...)` 呼叫的前後量 `Date.now()`，寫進既有的
  `M18EvidenceRecord`（`kind:'measurement'`，budget <10 分鐘，`notes` 明確排除
  `RUN_HISTORY_PERF_BENCHMARK`／`RUN_STAGE10_SCALE_BENCHMARK` 兩個 opt-in benchmark，對應
  NFR-51.5 原文「不含manual與opt-in 5k benchmark」），console 也印一行人類可讀摘要。

  **驗證**：`npm run test:stage10` 本機實測兩次，wall time 38.5s／41.6s（遠低於 600s budget），
  `.playwright-tmp/stage10-evidence/stage10-t1-evidence.json` 新增
  `NFR-51.5-acceptance-command-wall-time` 記錄且 `status:"pass"`；兩次執行 exit code 皆為 0。
  `npm run typecheck` exit 0；`npm run test`（Vitest）186 files／1654 tests 不變；
  `npx playwright test --project=edge`（全部 71 個既有 spec）71/71 綠燈（此時背景負載已降，無
  前一切片記錄的資源競爭 flake 重現）。

  **T4 DoD 現況總結**：matrix gates 除「42k-tick cached-reopen P95」一列尚待較安靜環境重跑確認外，
  其餘（5,000-run 首 100 rows／100-run analysis cold/warm／normalize/seek 沿用 Node-level 既有
  evidence）皆有可比較 environment/timing report；scale UI 不下載 full payload、50-cycle／abort
  resource-lifecycle、keyboard-only History→Replay journey 三項皆有 automated evidence 且全綠；
  acceptance command wall time 已記錄且遠低於 budget。唯一不能打勾的是上述 cached-reopen P95
  一列，加上 KI-017／KI-018 兩個真實 upstream defect 仍待 WP-49／WP-50 承接修復——task-checklist.md
  的 T4 因此暫留 ⬜，於下方寫明原因，不假裝全綠。

- **2026-08-31**：**T5 進行中**（第一個切片）— operator runbook 與 M18 dossier 草案（FR-51.15、部分
  FR-51.16／FR-51.14 traceability）。

  **範圍判斷**：T5.md 把工作分成三塊——operational documentation、manual walkthrough、release
  dossier。本切片先做前者與後者兩塊**文件/映射性質**的工作（可由讀原始碼+對照既有 T0～T4 evidence
  完成，不需要真人操作實機）；manual walkthrough 需要真人在真實硬體上操作 Pointer Lock／滑鼠／
  用肉眼判斷 WebGPU 視覺正確性與螢幕報讀軟體——這是 AI agent 無法誠實代為執行或宣告 pass 的部分
  （比照本 repo 既有先例，見 acceptance-stage-g.md §1.1 G-2 對「真人真硬體全場走查」的處理方式：
  留給人工，不假裝機械證據等同於它），因此本切片只交付**尚未執行、可供人工簽核的版本化 checklist
  模板**，不在 checklist 的任何一格填 pass。

  **交付**：
  1. [`docs/operational/history-center-replay.md`](../../../../operational/history-center-replay.md)
     ——啟動指令／History API health 確認／resolved root 固定性／磁碟階層＋atomic write＋restart
     重建／備份還原（app 停止後複製整個 root，無 delete/import/migration）／manual download vs
     自動歷史的區別／8 類 troubleshooting（API unavailable／保存失敗重試／corrupt-unsupported／
     duplicate conflict／空 History／replay partial-unsupported／WebGPU→WebGL2 fallback／scene
     load failure）／隱私安全邊界（loopback-only、無登入角色、不進 git）。**每一段落先用
     `codegraph_explore` 對照實際原始碼**（`server/history/historyPlugin.ts` `resolveRoot()`、
     `historyApi.ts` 的 6 個 route／錯誤碼、`replayCompatibility.ts` 的 `classifyReplaySupport()`／
     `REASON_ORDER`、`createRenderer.ts` 的 `resolveBackend()`、`HistoryPersistence.ts` 的 Practice
     短路邏輯），不是憑空寫規格書摘要;§1.2 的 health response 範例額外用本機真實
     `npm run dev` + `curl http://localhost:5173/api/history/health` 驗證過欄位名稱與格狀
     （`validRunCount`／`invalidFileCount`／`unsupportedFileCount`／`excludedPracticeFileCount`／
     `rebuiltAt`——原本猜測的欄位名稱如 `participantCount` 並不存在，驗證後已修正），驗證後用
     `taskkill /T /F` 收尾避免留下佔用 5173 的孤兒 process（沿用 T1 已記錄的 Windows tree-kill
     surprise）。
  2. [`docs/operational/acceptance-stage-j.md`](../../../../operational/acceptance-stage-j.md)——把
     stage10 README §10 全部 11 項 M18 條件、WP-51 README §1 的 FR-51.1～17／NFR-51.1～9，逐項連到
     T0～T4 已交付的 automated／measurement／inspection artifact（無 orphan 條件）;額外設
     Known-limitations 表（KI-017／KI-018／42k P95 jitter／Chrome 未安裝／缺 Chrome+WebGL2
     fallback project）與一份**尚未執行**的版本化 manual walkthrough checklist（Participant／
     Researcher／Practice／真實視覺輸入／failure spot-check／keyboard-screen-reader 六組，每格皆
     空白 checkbox，簽核欄留空）。§5 明確寫「尚未判定通過」與收尾所需的 4 個後續動作，不在草案
     階段假裝 M18 已達成。

  一個小修正（撰寫時發現，非產品缺陷）：`docs/operational/*.md` 既有慣例用全形括號而非半形
  `()`，第一次對 §1.2 的欄位清單做 `Edit` 時因為用了半形括號而字串不匹配，重讀檔案確認實際
  字元後改用全形括號才成功替換。

  **驗證**：`Bash` 確認本切片引用的 13 個既有測試檔案路徑（`historyRepository.test.ts`、
  `stage10-assessment.spec.ts`、`stage10-restart.integration.test.ts`、
  `Stage10FixtureFactory.test.ts`、`stage10-preview.spec.ts`、`stage10-failure-recovery.spec.ts`、
  `stage10-accessibility.spec.ts`、`Stage10AcceptanceEnvironment.ts`、`HistoryPersistence.test.ts`、
  `stage10-scale.perf.ts`、兩份 KI 文件）全部存在;唯一一個猜錯的路徑
  （`src/replay/ReplayPlayer.test.ts`，實際在 `tests/replay/ReplayPlayer.test.ts`）已用 `Glob` 找到
  正確路徑並修正引用，避免 dossier 內出現死連結。純文件交付，不影響 `npm run typecheck`／
  `npm run test`／`npm run test:e2e`，未重跑（無 production/test code 變更）。

  **T5 尚未完成**（本切片刻意不做，留給人工）：manual browser／GPU／a11y walkthrough 的實際執行與
  簽核（dossier §4 checklist 全部空白）;由未撰寫本 WP 主要程式碼者依 runbook 重新走一次啟動→定位
  synthetic record→Replay→處理至少一個 failure state 的獨立驗證。task-checklist.md 的 T5 因此暫留
  未打勾，5 項 DoD 中 3 項（runbook、dossier traceability 無 orphan、無真實資料/敏感路徑）已完成，
  2 項（manual checklist 執行+簽核、獨立 operator 重跑）待人工接手。

- **2026-08-31**：**T-exit automated gate run**（working tree based on HEAD `d142baf`，Windows 11/Edge msedge，Node v25.9.0）。

  **結論**：自動化 gate 已補齊並全綠；**不宣告 M18**。阻塞項剩下人工/owner gate：KI-017/KI-018
  仍待 WP-50/WP-49 owner 收斂，manual Chrome/Edge/GPU/a11y walkthrough 尚未由真人執行簽核，且 T5 要求的
  independent operator runbook walkthrough 尚未執行。依 T-exit-gate.md，這些不能由 AI agent 代簽，也不能
  用 automated happy path 豁免。

  **本次修正（test/harness only，無 production behavior change）**：
  - `tests/e2e/stage10-accessibility.spec.ts`：fixture `startedAt` 從 `2099-01-01 + Date.now()` 改為
    `2100-01-01 + Date.now()`，晚於同一 shared dev root 內既有 Stage10 future fixtures（例如
    `stage10-lifecycle-scale` 的固定 `2099-06`），避免本機累積 synthetic rows 把本 spec 目標 participant
    推出 Tab budget；同時將 drill/run/replay keyboard activation 改為 `locator.press('Enter')`，run-detail
    wait 提到 10s，`aria-valuetext` 改成 frame-aware poll。這保持 keyboard-only intent，但去除高負載下
    Playwright dispatch/paint frame 的假陰性。
  - `tests/e2e/replay.spec.ts`：A-50.5 event next/previous assertion 改為 click 後以 `expect.poll` 等待
    seek value commit。根因是 transport UI 由下一個 presentation frame 更新，立即讀 range value 會在
    全 suite/critical repeat 高負載時偶發讀到舊值；修正不改 `ReplayPlayer`/`ReplayTransport` 語意。
  - `tests/e2e/history-library.spec.ts`：client-side search 清空後不再假設新 seed 的 2026 participant
    一定位於 restored full list 的前 100 rows。shared dev root 內 Stage10 future fixtures 會依
    `latestStartedAt` 排在前方；測試現在沿用 UI 的「顯示更多」chunked-list 行為 reveal participant
    後再斷言，保留原本「清空 query 可回到完整列表」的測試語意。

  **驗證與量測**：
  - `npm run typecheck`：exit 0。
  - `npm run build`：exit 0，Vite build 2.06s；既有 chunk >500kB warning，非本次引入。
  - `npm run test`：exit 0；186 passed + 1 skipped files（187 total），1654 passed + 2 skipped tests（1656 total）。
  - `npm run test:e2e`：exit 0；71/71 passed（修正後全套重跑）。
  - `npm run test:ci`：exit 0；typecheck + Vitest + Playwright 71/71 passed（最終 rerun 已涵蓋
    `history-library.spec.ts` chunked-list harness fix）。
  - `npm run test:stage10`：exit 0；Stage 10 acceptance command wall time 39.0s，evidence report written to
    `.playwright-tmp/stage10-evidence/stage10-t1-evidence.json`。
  - `RUN_STAGE10_SCALE_BENCHMARK=1 npm run test:stage10:scale`：exit 0；History first-100 rows P95 244ms，
    100-run analysis cold/warm 269/267ms，42k-tick Replay cold open 272ms，cached-reopen P95 480ms over
    15 samples（480, 364, 300, 369, 301, 328, 313, 363, 326, 330, 300, 346, 314, 303, 357ms），解除 T4
    先前的 P95 jitter blocker。
  - Critical repeat bundle：
    `npx playwright test tests/e2e/stage10-assessment.spec.ts tests/e2e/stage10-preview.spec.ts
    tests/e2e/stage10-failure-recovery.spec.ts tests/e2e/stage10-accessibility.spec.ts
    tests/e2e/stage10-lifecycle-scale.spec.ts tests/e2e/stage10-projection-shape.spec.ts
    tests/e2e/replay.spec.ts --project=edge --repeat-each=5 --retries=0`：exit 0；100/100 passed。
  - `graphify update .`：exit 0；AST graph rebuilt after test code changes（3819 nodes／8946 edges／236 communities）。

  **狀態同步**：`T4-scale-lifecycle-a11y.md` 第一個 DoD 已改為完成；`task-checklist.md` 將 T4 標為 ✅，
  T5/T-exit 仍保留 ⬜；`docs/operational/acceptance-stage-j.md` 更新到本次 T-exit automated evidence，
  並保留 remaining manual/owner blockers。

- **2026-09-01**：KI-017 已依 WP-51 README §2.6 回流到 WP-50 owner 並修復。修復內容：`main.ts`
  的 `replayController` 從尾端 TDZ `const` 改為早期 `let ReplayController | undefined`，History
  Run Detail early click 在 controller 尚未就緒時顯示「Replay 尚未就緒，請稍後再試。」；WP-50
  `tests/e2e/replay.spec.ts` 新增不等待 `window.__fpsTest` 的真瀏覽器 regression。受影響 gates 已重跑：
  `npm.cmd run typecheck` exit 0；`npx.cmd playwright test tests/e2e/replay.spec.ts --project=edge -g "KI-017"`
  1 passed；`npx.cmd playwright test tests/e2e/replay.spec.ts tests/e2e/stage10-assessment.spec.ts
  tests/e2e/stage10-preview.spec.ts --project=edge` 12 passed；`npm.cmd run test:e2e` 73/73 passed。WP-51
  仍不宣告 M18：KI-018、manual browser/GPU/a11y walkthrough 與 independent operator runbook walkthrough
  未完成。

- **2026-09-01**：**OQ-51.2 waiver 落地**——依使用者/product-tech owner 決策，Chrome manual walkthrough
  與 WebGL2 fallback automated project 不阻塞 M18，改列 post-M18 coverage debt。已更新
  [docs/operational/acceptance-stage-j.md](../../../../operational/acceptance-stage-j.md) §3.1、manual checklist
  與本 WP README/task-checklist/T-exit 文案；仍明確記錄「此 waiver 不是 pass evidence」，若 M18 scope
  從 prototype 升級為正式跨瀏覽器發布，Chrome/WebGL2 必須重新納入 release gate。M18 剩餘 blocker：
  KI-018、manual Edge/GPU/a11y walkthrough、independent operator runbook walkthrough。

## Surprises & Discoveries

- **`127.0.0.1` 對這台機器的 Vite dev/preview 是假陰性**：手動起`npm run dev`後
  `curl 127.0.0.1:5173`收到`ECONNREFUSED`，但`curl localhost:5173`成功；`netstat`證實
  socket是`[::1]:5173`（IPv6-only loopback），非`0.0.0.0`/`127.0.0.1`。若port
  preflight／readiness改用`127.0.0.1`，會誤判「port閒置」而重複啟動衝突的server，或誤判
  「server從未就緒」而在真正跑起來後仍判定startup failure。已改用`localhost`（與現有
  `playwright.config.ts`/`tests/e2e/history-api-health.spec.ts`一致）。Evidence：本次即時
  重現於`npm run test:stage10`第一次執行——log顯示Vite印出`ready in 386ms`，同一時間我方
  readiness check仍對`127.0.0.1`回`ECONNREFUSED`直到丟出`Stage10ServerStartupError`。
- **`shell:true` spawn 的 `child.pid` 不是真正佔用port的process**：Windows上
  `spawn('npm run dev', {shell:true})`的`child.pid`是`cmd.exe`；單純`child.kill()`不保證
  waterfall殺到`npm`再往下的`node`/`vite`子行程，會留下佔用5173/4173的孤兒行程。已改用
  `taskkill /pid <pid> /T /F`做tree kill（POSIX維持`SIGTERM`）。修正後兩次真實
  `npm run test:stage10`執行後`netstat`皆確認無`LISTENING`留在5173/4173。
