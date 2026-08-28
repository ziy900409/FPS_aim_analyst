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
