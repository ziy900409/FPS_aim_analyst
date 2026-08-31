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
- **OQ-51.2**：Chrome與Edge是否都需自動化？建議Edge自動，Chrome+Edge人工，WebGL2 fallback自動。
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
  | OQ-51.2 | CI/system Edge 自動化（已是現狀）；Chrome+Edge 人工 WebGPU walkthrough；WebGL2 fallback 自動化（待建） | 預設定案 2026-08-31，待使用者/QA owner確認 | 平衡自動化涵蓋率與人工實機成本；WebGL2 fallback 自動化可用既有 Playwright headless，不需額外硬體 |
  | OQ-51.3 | 接受——preview 只驗公開 History→Result→Replay，完成→autosave 由 dev automation 覆蓋 + preview 人工補足 | 預設定案 2026-08-31（已是 T1 實作現狀），待使用者/架構owner確認 | DEV hook 刻意不進 production bundle（FR-48.10），這是唯一不需開後門的驗證路徑 |

  **T1/T2 交接**：T1 target 清單（README §2.1）與已交付檔案一致，無 planned-but-undelivered
  target。T2 entry blocker 全數解除——WP-48／49／50 exit evidence 齊備、fixture roster 可擴充
  full/partial/unsupported/invalid replay case、dev/preview/browser policy 已凍結。**CodeGraph
  impact**：本次 T0 純讀碼稽核與文件更新，未修改任何既有 symbol，故不適用 impact 分析
  （T0-entry-gate.md 步驟 5 僅在「將修改的既有 symbol」時才要求）。

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
