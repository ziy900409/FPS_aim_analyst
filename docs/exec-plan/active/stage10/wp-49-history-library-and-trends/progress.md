# WP-49 — progress.md

> Running log。Spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27 / planning**：依使用者指定的 `.claude/skills/engineering-planning/SKILL.md` 完成repository-grounded WP-49 tech spec。已讀skill及bundled standards/template、AGENTS、Stage 10／WP-48、graphify report；以CodeGraph對帳HistoryView、ResultScreen、main completion、sessionHistory、CompatibilityKey、ResearcherMenu與SessionRunner。尚未寫production code、尚未開始T0。
- **2026-08-27 / scope baseline**：沿用最新Assessment-only policy。Practice不持久化、不進Participant瀏覽、run detail或trend；只保留WP-48定義的當次Result／manual export。
- **2026-08-27 / T0 entry gate — 完成**：baseline `git status --short` clean、HEAD `8a9bde9`；CodeGraph impact 對帳 `createHistoryView`/`createResultScreen`/`buildSessionHistory`/`CompatibilityKey`/WP-48 client-server 符號，與 README §0/§0.1 claim 一致，另發現 `historyMetricsFor`／`resultShown`／`currentHistorySession`／`buildCurrentExportPayload` 均無 direct covering test（T3/T5 風險證據，見下）。WP-48 handoff 逐 interface 對帳：全部 available、零 mismatch（見下表）。三個 PoC（route round-trip/race、Result extraction、100-run projection benchmark）皆有可重現 evidence。baseline `npm run test:ci` exit 0（147 test files / 1220 tests passed，2 skipped；36 Playwright E2E passed，8.55s unit + ~1.1min e2e）。Production code diff = 0；PoC 腳本執行於 session scratchpad（非 repo 內），已於評估後刪除，未落地任何 repo 檔案。OQ-49.1～5 已與使用者收斂（見下）。

  **WP-48 handoff 逐 interface 對帳**

  | Interface | 狀態 | 備註 |
  |---|---|---|
  | `HistoryClient`（health/saveRun/listParticipants/listDrills/listRuns/loadRun） | ✅ available | `src/history/HistoryClient.ts`；全 method 皆帶 `signal?: AbortSignal`，滿足 FM-49.1 cancellation 需求 |
  | `HistoryRunSummary`/`HistoryParticipantSummary`/`HistoryDrillSummary`/`SaveHistoryRunResult`/`HistoryIndexReport` | ✅ available | `src/history/contracts.ts`，欄位與 README §2.4/T0 假設逐位相符 |
  | Assessment-only witness（`meta.assessment !== undefined`） | ✅ available | repository 於 `saveRun` 前拒絕 Practice（`PracticeNotArchivableError`），API 回 `422 PRACTICE_NOT_ARCHIVABLE` |
  | 排序（`startedAt desc` for list, index 內部） | ✅ available | `HistoryRepository`/API 現況回傳未分頁陣列；WP-49 排序/分頁為新增行為，非既有契約，需在 T1/T4 自行實作 |
  | URL encoding（route segment） | ✅ available | `HistoryClient` 對每個 path segment 各自 `encodeURIComponent`；server `matchHistoryRoute` 對每 segment 各自 `decodeURIComponent`，failure → `undefined`（不 throw） |
  | `loadRun(runId)` | ✅ available | 回傳完整 `ExportPayload`；404 → `RUN_NOT_FOUND` |
  | health/error 契約（`HistoryApiErrorCode`/`HistoryApiErrorBody`） | ✅ available | 11 個 error code 已定義；path-free error message（server 端已避免洩漏 absolute path） |
  | abort（client timeout + external signal） | ✅ available | `HistoryClient` 內建 5s timeout + `AbortSignal` 合流；timeout/network → `retryable=true` |
  | test root（temp-root fixtures） | ✅ available | `tests/history/testHelpers.ts`：`makeTempRoot()`/`removeTempRoot()`/`makeAssessmentPayload()` 可直接被 WP-49 filesystem/API tests 重用，零 mismatch |
  | pagination（cursor-based list） | ⚠️ 不存在（如預期） | WP-48 endpoints 回傳未分頁完整陣列；WP-49 T4 的 `/observations` 為全新 additive endpoint，不可假設既有 route 支援 query string（現況 middleware 只 strip query，不 parse） |

  **Route PoC**（`node route-poc.mjs`，throwaway，已刪除；可用本節邏輯於 T1 重建重跑）：round-trip 419 assertions passed / 1 failed（200 次 back/forward/reload race trial 全部通過，含 200 個隨機 setTimeout ordering；malformed `%zz`/孤立 `%`/截斷 UTF-8 escape 全部不 throw、安全落回 `not-found`）。**唯一失敗**：空字串 id（`participantId=''`）在 `split('/').filter(s=>s.length>0)` 式的 naive segment parser 下無法 round-trip（空 segment 被過濾掉，segment count 位移）。**結論**：T1 的 route parser 不需要特別處理空字串 id——`participantId`/`drillId`/`runId` 在其真正來源（`meta.session.participantId` 經 WP-48 `requireTrimmedNonEmptyString` 驗證、與 WP-48 `HistoryRunSummary.runId`）本來就保證 non-empty；但 T1 仍應在 `parseHistoryHash` 對空字串 segment 明確拒絕（typed not-found），而非依賴上游保證默默吞掉，並在 T1 test matrix 記錄此 case。

  **Result presentation extraction spike**（既有原始碼追蹤 + 既有可重現 test 指令，未新增 throwaway script——`main.ts` 無可獨立 import 的匯出點，執行需完整 WebGPU/DOM bootstrap，故以 codegraph 追蹤 call graph 取代）：`resultScreen.show()`（[ResultScreen.ts:99-107](../../../../../src/ui/ResultScreen.ts#L99)）的四個參數在 `main.ts:1445-1450` 呼叫處，全部是 `payload: ExportPayload` 的純函式：`metricsDashboard.compute(snapshotFromExportPayload(payload))`（`computeMetrics`，`tests/golden/research/timeline-parity.test.ts` 覆蓋）、`metricsDashboard.computePromoted(payload)`（`computePromotedMetrics`，`src/metrics/researchMetrics.test.ts` + 3 個 golden test 覆蓋）、`diagnosisForPayload(payload)`（main.ts:621-627，純函式呼叫鏈）、`qualityFlagsForPayload(payload)`（main.ts:629-644，逐欄位讀 `payload.meta`，零外部狀態）。`npx vitest run tests/golden/research/timeline-parity.test.ts src/metrics/researchMetrics.test.ts` 為既有可重現 command，證明這兩個核心計算已獨立於 DOM/main.ts 被測試。

  必須從 `main.ts` 移出（成為 `ResultPresentation.ts` 的 `buildResultPresentation(payload)`）：`diagnosisForPayload`、`qualityFlagsForPayload`、`snapshotFromExportPayload`，加上把 `metricsDashboard.compute/computePromoted` 的呼叫組裝進同一個函式。

  不能移動、必須留在 current-run wrapper（`main.ts`/T3 current 分支）：`resultShown` 一次性 latch、`currentHistorySession`/`historyView.render()`（舊 baseline UI，OQ-49.3 已決議 T3 移除）、`historyPersistence.save(payload)`（WP-48 auto-save fire-and-forget，historical viewing 絕不可重觸發）、`sessionPlanRunner.advance()`/`completeActiveProtocolCondition()`（session 進程）、`restartActiveDrill` + `window.confirm` restart 對話、`onExportJSON`/`onExportCSV` 目前綁 `buildCurrentExportPayload()`（current in-flight recorder snapshot——historical wrapper 必須改綁已載入的 historical payload，不可重用同一 callback）、`downloadJSON(payload,...)` 在 family phase 完成時的 side effect（屬 session 進程，非 result presentation）。

  **100-run projection benchmark**（`node --expose-gc projection-benchmark.mjs`，throwaway，已刪除；語料取自 `research/fixtures/exports/` 5 份真實 counterstrafe_ad_v1 fixture 循環複製為 100 份，總 53.91 MiB，平均 0.54 MiB/檔，符合 WP-48 README 記錄的 0.6–1.2 MiB 量級）：(A) browser-batch（無界、每個 run 都拉完整 JSON）— parse+project 100 檔 385.3ms，但**瀏覽器需接收全部 53.91 MiB**；(B) Node paged projection（bounded concurrency=4，D-49.P6 設計）— cold parse+project 100 檔 360.9ms、warm cache read ~0ms，**瀏覽器只收 9.6 KiB 的 compact page**（100 個 observations）。NFR-49.2 gate（≤100 observations、cold P95<2000ms、warm P95<300ms）：cold 360.9ms、warm ~0ms，均達標，且有 ~5,600× 的 wire-transfer 縮減（53.91MiB → 9.6KiB）。**結論**：確認 D-49.P6（Node-side bounded paged projection，browser 只收 compact observations）為正確設計方向，不可讓 browser 直接批次拉完整 payload。

- **2026-08-27 / T0 — OQ-49.1～5 收斂結果**（使用者拍板，詳見下方 Decision Log D-49.P9～P13）：OQ-49.1 只註冊 `spider-shot-v2`（不含 hold-click/hold-track，也不含 peek-click-transfer）；OQ-49.2 最新 eligible cohort 預設 + selector；OQ-49.3 T3 移除人工 HistoryView picker，只留 Download JSON/CSV；OQ-49.4 分頁 + 漸進補齊，顯示 loaded/total；OQ-49.5 Participant 頁頂端只顯示分類 count，不列檔名/路徑、不做 quarantine UI。全部 OQ 均已收斂，無 blocked task。

- **2026-08-27 / T1 — Navigation/controller shell — 完成**：新增 4 個 production 模組 + 對應 test（共 77 個新 unit test，全綠）：
  - `src/history/navigation/HistoryRoute.ts`（+30 tests）— 純 `parseHistoryHash`/`formatHistoryHash`/`isHistoryHash`/`historyRouteAncestors`，README §2.3 四種 `HistoryRoute` kind 逐位實作。
  - `src/history/navigation/HistoryNavigator.ts`（+13 tests）— hash-based Back/Forward adapter，注入式 `HistoryNavigatorWindow` 讓測試用同步 in-memory stack 而非真瀏覽器。
  - `src/history/HistoryLibraryController.ts`（+14 tests）— README §2.4 `AsyncState`/`HistoryLibraryState`/`HistoryLibraryController` 逐位實作，per-scope generation counter + `AbortController` 防 stale response 覆蓋新 route（FM-49.1，含 race 測試）。
  - `src/ui/history/HistoryScreen.ts`（+20 tests）— full-screen shell：breadcrumb、`role="dialog"`、`<main tabindex="-1">` landmark、loading/empty/error/not-found typed rendering、route 改變時 focus 進 main landmark（純資料更新不搶 focus）。
  - `src/main.ts`：新增「歷史紀錄」主入口按鈕（`#session-launch-controls` 第 3 個 primary-tier 按鈕）、`historyScreenHandle`（早期宣告避免 TDZ，同 KI-013 pattern）、canvas click handler 顯式擋 `historyScreenHandle?.visible === true`（FM-49.10 defense-in-depth，z-index 疊層已天然擋掉但額外加一層防未來 regression）。
  - `tests/e2e/history-navigation.spec.ts`（新增 5 個 test）：launch→shell、Back/Forward、reload、Close、FM-49.10 pointer-lock 負向斷言（`HTMLCanvasElement.prototype.requestPointerLock` monkey-patch spy，非真實取鎖——見下方 Surprises）。
  - 因新增第 3 個 launch 按鈕，同步更新 2 個既有 Playwright 斷言的硬編按鈕數：`tests/e2e/overlay-layering.spec.ts`（3→4、6→7）、`tests/e2e/session-orchestrator.spec.ts`（2→3）。

  Baseline 對帳：`npm run test:ci`（`tsc --noEmit` × 2 + `vitest run` + `playwright test`）全綠——151 test files / 1297 tests passed + 2 skipped（vitest）、41 Playwright e2e passed、`npm run build` 乾淨。current Result／sim／WP-48 persistence 無行為 diff（僅新增，未改動既有 render/sim/persistence 路徑）。

## Decision Log

- **D-49.P1 / navigation**：推薦使用namespaced hash route `#/history/...`，支援Back/Forward/reload，又不要求Vite新增history fallback；保留dev-only `#pattern` namespace。
- **D-49.P2 / state ownership**：單一`HistoryLibraryController`擁有route async state與cancellation；DOM views只送intent，不自行fetch。
- **D-49.P3 / exact grouping**：API、route、registry與trend皆以完整exact `drillId`為key；不得family/prefix fallback。
- **D-49.P4 / result reuse**：current Result與historical Result共用payload→presentation與read-only body；restart/save status只屬current wrapper。
- **D-49.P5 / trend semantics**：正式trend只含Assessment + quality-ok + selected compatibility cohort + matching metric id/unit + finite value；不做composite、smoothing或forecast。
- **D-49.P6 / analysis boundary**：列表先使用WP-48 compact summaries；完整payload projection在Node analysis service以cursor page + bounded concurrency執行，browser只收compact observations。
- **D-49.P7 / unknown metrics**：未註冊drill仍可用Participant/drill/run/result flow；trend顯示empty state，不throw、不發明metric。
- **D-49.P8 / replay handoff**：WP-49只保留typed optional action port；WP-50未接入前不顯示replay button。
- **D-49.P9 / OQ-49.1 metric roster（使用者拍板，2026-08-27）**：WP-49 T4 metric registry**只註冊 `spider-shot-v2`**（exact drillId `'spider-shot-v2'`，`mode: 'assessment'`）。使用者最初提出「spider shot v2 & peek and click transfer」，但稽核發現 `peek_click_transfer_pilot_v1`（`src/drill/peek_click_transfer_pilot_v1.ts:93`）是 `mode: 'practice'`——`main.ts:606` 只在 `activeDrillConfig.mode === 'assessment'` 時填 `meta.assessment`，故該 drill 的 run **結構上不可能**通過 WP-48 `PracticeNotArchivableError` 檢查、永遠不會被保存進歷史。此非新衝突，[DECISIONS.md GD-25](../../../DECISIONS.md#gd-25-✅-wp-45-pilot-ready--peek-click-transfer-與元件量測邊界共用遮擋-kernel2026-08-26) 已明文「不進 stage6 Assessment history/compatibility/diagnosis」「正式 Assessment 必須由真人 pilot 後另立 WP」。與使用者對齊後決議：peek-click-transfer 需先有 assessment-mode 變體才能討論納入 history registry，屬**另開的跨 WP 決定**（不在 WP-49 範圍內，亦非 WP-49 T4 要解的問題）；hold-click/hold-track 維持不加入（使用者未選）。**殘留待辦**：`spider-shot-v2` 目前**沒有**任何既有 metric mapping（`historyMetricsFor()` 只覆蓋 hold-click/hold-track），T4 開工前需要研究設計 owner 定義具體 metric id/label/unit/direction/format（不得由實作者發明，C-D3/GD-20 紅線）。
- **D-49.P10 / OQ-49.2 cohort UX（使用者拍板，2026-08-27）**：採用推薦預設——最新 eligible cohort 為預設 trend 線，並提供 selector 切換其他 cohort；每個 cohort 顯示條件摘要與 n。
- **D-49.P11 / OQ-49.3 manual picker（使用者拍板，2026-08-27）**：採用推薦預設——T3 移除 `HistoryView.ts` 人工 File picker，只保留既有 Download JSON/CSV 手動匯出。
- **D-49.P12 / OQ-49.4 trend loading（使用者拍板，2026-08-27）**：採用推薦預設——cursor 分頁（每頁 ≤100 observations）+ 漸進補齊，UI 顯示 `loaded/total`。已有 T0 100-run benchmark 實測佐證（見上）。
- **D-49.P13 / OQ-49.5 corrupt-file diagnostics（使用者拍板，2026-08-27）**：採用推薦預設——Participant 頁頂端只顯示 `HistoryIndexReport` 的分類 count（invalid/unsupported/excluded-Practice），不列檔名/路徑、不做 quarantine UI。同步關閉 WP-48 OQ-48.3。
- **D-49.P14 / T1 route fallback semantics**：`HistoryRoute` 不新增第 5 種「not-found」union member；namespace 內的 malformed/空 logical id（decode 失敗或空字串）一律 degrade 到最深的仍合法 ancestor route（例：malformed drillId → 退回 `{kind:'drills',participantId}`），而非回傳 `undefined`。理由：README §2.3 只列 4 種 kind，新增第 5 種會讓 T2～T5 每處 exhaustive switch 多一個分支；「degrade 到可用上層」已滿足 FM-49.2「不 throw、typed not-found、返回可用上層」的字面要求（degrade 後的 route 仍是 typed、可渲染、可再往下 navigate）。副作用：新增 `isHistoryHash()` helper 與 `parseHistoryHash` 兩者現在等價於「hash 是否落在 `#/history` namespace」，`HistoryNavigator.current !== undefined` 因此可直接當作 History shell 的 visible/active 訊號，不需要另外追蹤一個 active flag。
- **D-49.P15 / T1 scroll restoration API 不在 README §2.3 字面 interface 內**：`HistoryNavigator` 新增 `saveScroll(scrollY)`/`consumeScroll()` 兩個方法，而非把 scroll 塞進 `HistoryRoute`。理由：T1 Steps §3 明文要求「route-local scroll state」，但 README §2.3 逐位列出的 interface 沒有對應欄位；用 `history.state`（`replaceState` 原地更新、不新增 entry）比擴充 `HistoryRoute` union 更貼近瀏覽器原生語意，也不會讓每個 route kind 都背一個 UI-only 欄位。
- **D-49.P16 / T1 直接接上真實 `HistoryClient`，非留待 T2**：README task table 寫「T1 controller以fake client完成；真實list接線留T2」，解讀為「T1 的**測試**用 fake client」（`HistoryLibraryController.test.ts` 確實全程用 fake），而非「production 佈線留到 T2 才接真 client」。`main.ts` 既有的 `historyClient`（WP-48）已可直接注入 `createHistoryLibraryController`，沒有理由讓 T1 production code 空轉、T2 再補一次佈線；T2 的實際範圍是新增 `ParticipantBrowser`/`DrillBrowser` 這些專用列表元件去消費 `historyLibraryController.state`，controller 本身的 fetch/generation/abort 邏輯 T1 已完整可用。
- **D-49.P17 / `HistoryObservationCollection`/`HistoricalRunPresentation` 為 T1 佔位別名**：`HistoryObservationCollection = never`（`observations` AsyncState 在 T1 生命週期內恆為 `idle`——分析 endpoint 要 T4 才存在）；`HistoricalRunPresentation = ExportPayload`（`runDetail` 目前就是 `HistoryClient.loadRun()` 的原始回傳，`ResultPresentation.ts`／`buildResultPresentation()` 要 T3 才存在）。兩者都只是型別別名、不影響 `HistoryLibraryState` 欄位形狀，T3/T4 落地時原地替換即可，不需要改 controller 的 dispatch 邏輯。
- **D-49.P18 / T1 HistoryScreen 只渲染通用 item-count 摘要**：README In-scope 檔案表把 `ParticipantBrowser.ts`／`DrillBrowser.ts`／`DrillOverview.ts`／`HistoricalRunDetail.ts` 明列為 T2/T3/T5 的 NEW 檔案，不屬於 T1 的 `HistoryScreen.ts`。T1 shell 因此只依 route kind 顯示「共 N 筆／載入中／沒有資料／讀取失敗＋重試」這類與 domain 無關的通用狀態，證明 navigation+controller 端到端可用（含真實 API、真實 E2E），不預先設計 T2 尚未拍板的列表 UI。
- **D-49.P19 / 新增第 3 個 launch 主入口按鈕，連動更新既有 Playwright 硬編按鈕數斷言**：FR-49.1 要求「所有使用者都能進入的歷史紀錄入口」，在 `#session-launch-controls` 新增「歷史紀錄」按鈕（`data-launch-tier="primary"`）。這改變了 `tests/e2e/overlay-layering.spec.ts`（3→4、6→7）與 `tests/e2e/session-orchestrator.spec.ts`（2→3）兩處既有硬編數字斷言，於本 slice 內一併更新並重跑確認全綠——屬新增可見 UI 元素的直接、預期後果，非既有行為 regression。

## Blast Radius Notes

- `createHistoryView`：2個`main.ts` caller並有component tests；由人工file picker轉正式screen是cross-module change。
- `createResultScreen`：2個`main.ts` caller並有component tests；抽shared body影響current與historical presentation，T3=High。
- `buildSessionHistory`：2個caller且有domain tests；WP-49另建general trend，不直接改舊baseline函式。
- `CompatibilityKey`：9個consumers並有tests；WP-49以adapter重用，不改既有欄位/equality語意。
- `main.ts` history/result wiring無direct covering test；T5需要Playwright。

## Surprises

- 現有應用沒有general router或HomeScreen；只有launch controls／researcher menu與overlay。History入口需在composition層建立，不能假設已有SPA shell。
- 現有`historyMetricsFor()`只處理hold-click／hold-track，其他drill會throw；這正是registry與unknown-empty policy的必要性。
- WP-48 summary刻意不含metric/compatibility資料；若browser逐run載完整JSON，數百run即可產生數百MiB傳輸，因此新增compact paged analysis projection較安全。
- package目前沒有chart library；專用SVG + accessible table是最小可驗證方案。
- graphify由commit `b0fba569`建立，而目前HEAD為`3ac2f363...`；規劃以current CodeGraph/on-disk source為準，production修改後需`graphify update .`。
- **T0 CodeGraph 追加發現**：`historyMetricsFor`、`resultShown`、`currentHistorySession`、`buildCurrentExportPayload`、`resultScreen`（`main.ts` 內的 completion-seam 相關符號）全部**無 direct covering test**——與 WP-48 README §0 point 9 對「`main.ts` completion wiring 無直接單元測試」的既有結論一致，但範圍更廣；T3/T5 的 Playwright E2E 覆蓋比重因此更重，不可只靠 unit test 斷言 wiring 正確。
- **T0 route PoC 發現**：naive `split('/').filter(s=>s.length>0)` 式 segment parser 無法安全 round-trip 空字串 logical id（segment 被過濾、位移後續 segment index）。雖然 `participantId`/`drillId`/`runId` 的真正來源本來就保證 non-empty（WP-48 `requireTrimmedNonEmptyString` 與 runId 推導），T1 仍應對空字串 segment 明確拒絕為 typed not-found，不依賴上游保證。
- **T0 projection benchmark 發現**：100-run 真實尺寸語料下，browser 直接批次拉取完整 payload 需傳輸 53.91 MiB；Node bounded-concurrency（4）paged projection 只需傳輸 9.6 KiB compact page，cold parse+project 360.9ms（遠低於 NFR-49.2 的 2000ms gate）。實測數字強化 D-49.P6，也驗證 OQ-49.4 推薦預設可行。
- **T1 發現**：README §2.3 的 URL pattern 列表在 4 層 route 的字面範例裡漏寫了 `participants` literal path segment（`#/history/participants/{participantId}/drills/{drillId}` 才是完整形式，不是 `#/history/{participantId}/drills/{drillId}`）——第一版 `parseHistoryHash`/`formatHistoryHash` 實作照著漏字的範例寫，被 `HistoryRoute.test.ts` 的 round-trip test 當場抓到（`drills`/`drill`/`run` 三種 kind 全部 fail），修正後 30 個 test 全綠。留給後續 task 的提醒：README 的 URL pattern block 本身不是逐位可信的 source，interface 型別定義（`HistoryRoute` union）與其中一個完整範例（two-segment `drills` kind）才是。
- **T1 發現**：`full-drill.spec.ts` header 已明文「真原生滑鼠無加速／Pointer Lock 正向路徑 → 手動驗收」——本專案的 Playwright E2E 慣例是不對真實 Pointer Lock **取得**做自動化正向斷言（headless Chromium 的使用者手勢信任度不穩定）。FM-49.10 的負向斷言（「History 開著時 canvas click 不觸發 Pointer Lock」）改用 `addInitScript` monkey-patch `HTMLCanvasElement.prototype.requestPointerLock` 計數器，不依賴真實取鎖是否成功，測起來穩定且不違反既有慣例。
- **T1 發現**：專案完全沒有 jsdom／happy-dom 依賴；`src/ui/**.test.ts` 一律手刻 per-file 的最小 `FakeElement`/`FakeDocument`（不共用 helper），用 `vi.stubGlobal('document', ...)` 替換全域。`HistoryScreen.test.ts` 沿用同一慣例（新增 `focus()`/`disabled`/`tabIndex`/`replaceChildren` 等該測試需要的欄位），沒有引入新的 DOM 測試依賴。

## Open Questions（status）

- **OQ-49.1 / initial metric roster**：✅ 已收斂（2026-08-27，見 D-49.P9）。只註冊 `spider-shot-v2`；peek-click-transfer 需另開跨 WP 決定（assessment-mode 變體）。**殘留子項（新）**：`spider-shot-v2` 具體 metric descriptor 需研究設計 owner 於 T4 開工前定義（未收斂，deadline：T4 開工前）。
- **OQ-49.2 / compatibility cohort UX**：✅ 已收斂（2026-08-27，見 D-49.P10）。latest eligible cohort default + selector。
- **OQ-49.3 / manual HistoryView**：✅ 已收斂（2026-08-27，見 D-49.P11）。T3 移除人工 picker，保留 JSON/CSV download。
- **OQ-49.4 / full trend loading**：✅ 已收斂（2026-08-27，見 D-49.P12）。page≤100、漸進載入並顯示 loaded/total；已有 T0 benchmark 佐證。
- **OQ-49.5 / corrupt-file diagnostics**：✅ 已收斂（2026-08-27，見 D-49.P13；同步關閉 WP-48 OQ-48.3）。只顯示分類 count，不列檔名/path、不做 quarantine UI。
