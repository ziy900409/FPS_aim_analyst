# WP-48 — progress.md

> Running log。Spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27 / planning**：依使用者指定的 `.claude/skills/engineering-planning/SKILL.md` 完成 repository-grounded tech spec。已讀 `AGENTS.md`、Stage 10 spec、skill design standards/template；以 CodeGraph／graphify 對帳 export completion、Result Screen、metadata/session 與 validator 邊界。尚未寫 production code、尚未開始 T0。
- **2026-08-27 / scope revision**：使用者將 WP-48 改為 Assessment-only history。Practice 不自動保存、不能依 Participant 瀏覽；保留當次 Result Screen 與手動匯出。已移除 Participant context 工作，新增 client short-circuit 與 repository/API rejection 的雙層驗收。
- **2026-08-27 / T0 完成**：baseline `npm run test:ci` 綠燈（137 test files／1081 Vitest tests + 31 Playwright E2E，全 pass，見下方 baseline 記錄）。四個 filesystem/lifecycle PoC 全部在 workspace temp root（session scratchpad，repo 外）與一次性 `.t0-poc-tmp/`（repo 內、跑完立即刪除、`git status --short` 確認零殘留）跑通並留下可重現指令與輸出。OQ-48.1／OQ-48.2 已由使用者確認採用推薦預設。production code diff 為零。

  **PoC 1 — path containment**（`node containment.mjs <root> <outside>`，Windows）：候選 T2 primitive 只接受個別 path segment（不接受組合後的相對路徑字串），逐一檢查後再 `path.resolve` + `path.relative` 做 lexical containment，另用 `fs.realpath` 對已存在目錄做 post-resolve containment 防 symlink/junction escape。五個拒絕案例（`..` segment、Windows 絕對路徑 segment、segment 內嵌 `/`／`\`、segment 內嵌 `\0`、指向 root 外的 junction）全部被拒絕；root 外 sentinel 檔案在所有嘗試後仍 byte-identical。junction escape 測試用 `fs.symlink(outside, linkDir, 'junction')`（Windows 建立目錄 junction 不需要系統管理員權限，與正式 symlink 不同）。

  **PoC 2 — atomic publication**（`node atomic-write.mjs <dir>`）：同目錄 `*.json.tmp` 寫入 → `fileHandle.sync()`（fsync）→ `close()` → `fs.rename()` 發布。輸出證明：寫入前後 scanner（只認 `.json` 尾碼、排除 `.json.tmp`）在 rename 之前完全看不到最終檔名，rename 之後立即可見且 tmp 檔案已消失。

  **PoC 3 — root lease**（`node lease.mjs <dir>`）：`fs.open(leasePath, 'wx')` 做 exclusive create；第二次以相同 path 呼叫得到 `EEXIST` 並被拒絕；release（`unlink`）後第三次 acquire 成功。Stale-lease 判定方案驗證：lease 檔內容為 `{pid, startedAt}`，用 `process.kill(pid, 0)`（signal 0 = liveness probe，不會真的送出訊號終止程序）探活；對自身 pid 回傳存活、對不存在的 pid（999999）回傳不存活，證明此策略可行。

  **PoC 4 — Vite dev-server close hook**（`node .t0-poc-tmp/vite-lifecycle.mjs <dir>`，於 repo 內暫時目錄執行以解析 repo 的 `node_modules/vite`，跑完立即 `rm -rf .t0-poc-tmp` 並以 `git status --short` 確認乾淨）：plugin 於 `configureServer(server)` 內 acquire lease，並在 `server.httpServer.on('close', ...)` 釋放。Server A 存活期間第二次 acquire 得到 `EEXIST`；呼叫 `serverA.close()` 後 lease 檔案被釋放，新的 Server B 立即可 acquire 成功。額外閱讀 `node_modules/vite/dist/node/chunks/dep-Dm0c1Wj2.js` 的 `createServerCloseFn()` 實作，確認 dev（`configureServer`）與 preview（`configurePreviewServer`）兩者的 `server.close()` 都走同一個 close-then-emit-`'close'`-event 路徑，故此 PoC 結論可類推到 preview。

  **Node typecheck／test glob／root 注入落點計畫**（T3 據此實作，T0 只凍結計畫）：
  - 新增 `tsconfig.node.json`（獨立 standalone program，不用 project references）：`target: ES2022`、`module`/`moduleResolution` 沿用現有 `bundler`（與 `vite.config.ts` 目前透過 Vite 自身 esbuild loader 執行一致，避免 `NodeNext` 強制副檔名的額外摩擦）、`lib: ["ES2022"]`（無 DOM）、`types: ["node"]`、`strict: true`、`include: ["server", "vite.config.ts"]`。
  - 新增 devDependency `@types/node@^20`（對齊 CI 的 Node 20 下限；本機 `node --version` 目前是 v25.9.0，僅用於跑 PoC／開發，不作為型別契約基準）。
  - `package.json` scripts 加一個 Node typecheck 呼叫：`"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.node.json"`；`build`／`test:ci` 同步追加 `tsc --noEmit -p tsconfig.node.json`，維持「build 同時 typecheck browser 與 Node boundary」（NFR-48.7）。
  - Vitest test glob **不需要修改**：`vite.config.ts` 現有 `test.include: ['src/**/*.test.ts', 'tests/**/*.test.ts']` 已涵蓋計畫中的 `tests/history/*.test.ts`（repository/API integration tests）。Playwright `testDir: './tests/e2e'` 已涵蓋 `tests/e2e/history-persistence.spec.ts`。
  - dev/preview/E2E root 注入：`historyPlugin(options?)` 預設 root 解析為 `path.resolve(process.cwd(), process.env.FPS_HISTORY_ROOT ?? 'data/session-history')`——正常 `npm run dev`/`preview` 沒有此環境變數時就是 OQ-48.2 凍結的正式路徑。`playwright.config.ts` 的兩個 `webServer` entry（dev :5173、preview :4173，見現有設定）**必須**各自加上不同的 `env: { FPS_HISTORY_ROOT: <各自獨立的 temp 目錄> }`（例如 `.playwright-tmp/history-dev`／`.playwright-tmp/history-preview`），否則兩個 server 同時搶同一個 root 的 lease 會讓其中一個在啟動時就 423/503（對應 FM-48.4，此設計必須現在就定案，T3/T5 才不會讓全部 E2E 一起紅燈）。Vitest repository/API integration tests 不經過 Vite plugin，直接在測試內用 `fs.mkdtemp()` 產生獨立 root 傳給 `createHistoryRepository({ root })`，不依賴任何環境變數。

  **Hosting 選項比較（OQ-48.1）**：
  | 面向 | A：Vite middleware | B：standalone process |
  |---|---|---|
  | 新增依賴/流程 | 無（沿用現有 `coopCoep()` plugin 先例） | 需要第二個 build target + process orchestrator |
  | dev/preview 生命週期 | PoC 4 證實 close hook 可靠釋放 lease | 需要自行設計啟動/關閉序列 |
  | Playwright | 沿用現有兩個 `webServer` entry，加 `env` 注入 root 即可 | 需要額外啟動第三個 server 並等待 ready |
  | typecheck | `tsconfig.node.json` 涵蓋 `server/` + `vite.config.ts` | 相同，但需額外涵蓋 process entrypoint |
  | root ownership | 單一 lease 綁定 Vite process 生命週期，簡單 | 需要獨立的 process 存活判斷 |
  | 未來抽離成本 | 標記為 conscious technical debt（README §3.2 #1），`historyApi.ts` handler 已與 hosting 解耦，未來要換 standalone process 時可直接重用 | 現在就付出這筆成本，但 WP-48 prototype 範圍不需要 |

  結論：選 A（Vite middleware）。已與使用者確認（AskUserQuestion，2026-08-27）。

- **2026-08-27 / baseline test:ci**：`npm run test:ci` exit 0。`tsc --noEmit` 無錯誤；Vitest 137 test files／1081 tests all pass；Playwright 31 tests all pass（`edge` project，COOP/COEP isolation、WP-3/9/17/21～26/42～47 既有 E2E 全綠）。`git status --short` 於 T0 開工前後皆為空，無 unrelated dirty change（README §0.2 提到的 WP-47 `main.ts` 未提交變更已在 commit `de29cb4`／`4c12f76` 落地，T0 開工時工作樹已乾淨）。
- **2026-08-27 / T1 完成**：新增 `src/data/exportPayloadSchema.ts`（`parseExportPayload`／`canonicalExportJSON`）與 `src/history/contracts.ts`（pure DTO，無 import）。`sessionHistoryLoader.ts` 移除 shallow `isExportPayload()`，改用共用 parser（本地函式重新命名為 `readExportPayload` 以避免與匯入的 `parseExportPayload` 撞名）。8/8 現有 research export fixtures（含 0 份帶 `meta.assessment` 的 Practice-shape 匯出）與 8 種 `DrillEvent` variant 均有正向測試；negative matrix 涵蓋 16 類 invalid input（root 型別、缺 meta、ticks/events 非陣列、schema 不支援、必填欄位缺失、非法 enum、NaN/Infinity、非法 key/discriminant 等）。canonical 測試證明 top-level／nested 物件 key 順序不影響輸出、tick/event 陣列順序保持不變。`npx tsc --noEmit` 與 `npm run test:ci`（Vitest 138 files／1115 tests + Playwright 31 tests）全綠；`rg "function isExportPayload" src` 已無結果。

## Decision Log

- **D-48.P1 / payload seam**：自動保存必須使用 render-loop completion 已建立、同時供 metrics/diagnosis/Result Screen 使用的**同一個 `ExportPayload`**；不得二次 snapshot/build。
- **D-48.P2 / schema trust**：`sessionHistoryLoader.ts` 現有 shallow `isExportPayload()` 不足以保護 filesystem/API；T1 建立單一 strict runtime parser，舊 loader 改用它。
- **D-48.P3 / source of truth**：JSON 是唯一 source of truth；memory index/cache 皆可重建，不引入 DB。
- **D-48.P4 / identity**：run identity 使用 schemaVersion + Participant ID + exact drillId + normalized startedAt；同 identity same content=idempotent，different content=conflict。
- **D-48.P5 / missing participant**：不使用 `anonymous`／`unknown` placeholder；沒有 Participant ID 就拒絕保存並顯示可行動狀態。
- **D-48.P6 / live loop isolation**：History API/client 不進 sim tick；保存失敗不影響 Result metrics、session progression 或 determinism。
- **D-48.P7 / Assessment-only archive**：只有 `meta.assessment !== undefined` 的 payload 可以建立歷史紀錄。Practice 仍是合法 `ExportPayload`，但 client 回 `excluded` 且不送 request；repository/API 對直接 submission 回 `PRACTICE_NOT_ARCHIVABLE`，不得建立任何檔案。此決策取代原本的 Practice 歷史／Participant context 規劃。
- **D-48.P8 / OQ-48.1 hosting（T0 凍結，使用者確認）**：Node History API 採 **Vite `configureServer`/`configurePreviewServer` middleware**（Option A）。理由：PoC 4 證實 close hook 可靠釋放 root lease，且與現有 `coopCoep()` plugin 同型，不需新增 process orchestrator。標記為 conscious technical debt（README §3.2 #1）；`historyApi.ts` handler 需與 hosting 解耦，未來要換 standalone process 時可重用。
- **D-48.P9 / OQ-48.2 history root（T0 凍結，使用者確認）**：history root 正式凍結為 `<repo>/data/session-history/`。browser UI 不接受路徑輸入；production 預設路徑由 server 端解析，可用 `FPS_HISTORY_ROOT` 環境變數覆寫（僅供 test/Playwright 使用，見下方 root 注入計畫）。
- **D-48.P10 / T1 canonical serializer**：`canonicalExportJSON` 採遞迴 key 排序（`JSON.stringify` 前對每個物件的 key 做 `Array.sort()`），陣列元素順序保持不變，而非手動複刻 `Meta` 逐欄位順序。理由：語意等價、更簡單（Rule 0），且對任何未來 additive optional 欄位自動成立，不需要每次新增 Meta 欄位都同步更新 canonical 排序表。
- **D-48.P11 / T1 spawn 欄位驗證邊界**：`SpawnMeta.motion`／`spawnArea`／`spiderShot`／`spawnDelayMsRange` 在 `metadata.ts` 本身即宣告為 `unknown`（opaque contract，WP-36 comment）；parser 對這些欄位僅原樣傳遞、不深入驗證，只驗證型別具體的 `seed`（必填 finite number）與 `presentationMs`（選填 finite number）。與現有 `collectMeta()` 對 `spawn` 完全不驗證（直接 passthrough）的既有行為相容，不新增比原本更嚴格的隱性契約。

## Blast Radius Notes

- `buildCurrentExportPayload()`：CodeGraph 顯示 2 個 caller，均在 `src/main.ts` export actions；無 direct covering test。T5 屬 cross-module risk。
- `ResultScreen`：`createResultScreen()` 由 `src/main.ts` 使用並有 `src/ui/ResultScreen.test.ts`；新增 save-status seam 是 local UI API change，但 main wiring 使整體為 cross-module。
- `sessionHistoryLoader`：現有 parser/guard 僅 local caller；替換為 shared strict parser blast radius 小，但會改 legacy invalid-file 行為，T1 必須以 tests 釘死。
- `vite.config.ts`：現有 COOP/COEP plugin 同時覆蓋 dev/preview；T3 必須保留其 header 行為與 Playwright 固定埠契約。

## Surprises

- 8 份現有 research export fixture 最大約 **1.18 MiB**，平均約 **0.62 MiB**；16 MiB request limit 有足夠 headroom，不需要無上限 body parser。
- 研究員主入口直接進 Drill Controls，不走 Session Setup，因此 Practice 可能缺 `meta.session.participantId`。新範圍明確不封存 Practice，故不再新增 Participant context UI；missing Participant 只作為 malformed Assessment 的防禦性錯誤。
- `tsconfig.json` 只 typecheck `src`，新增 `server/` 若不建立 Node config，CI 可能在 typecheck 階段看不到錯誤。
- 制定計畫時 `src/main.ts` 已有未提交 WP-47 變更；本規劃未修改它。T5 前須重新確認 owner/status。
- T1 撰寫 fixture-driven tests 時發現：`tsconfig.json` 的 `include: ["src"]` 沒有 `types: ["node"]`，`src/**/*.test.ts` 內 `import { readFileSync } from 'node:fs'` 會讓 `tsc --noEmit` 直接報 TS2307（找不到模組）。改用對 `research/fixtures/exports/*.json` 的**靜態** `import`（`resolveJsonModule: true` 已開啟）取代 runtime `fs` 讀取，同時也是 C-D1 例外條款明文允許的「committed golden/parity JSON fixture」匯入方式；`tests/**/*.test.ts`（不在 `include` 內)則不受此限，可自由用 `node:fs`（現有 `tests/golden/research/*.test.ts` 即此模式）。T2（Node repository/API 本體會用到真正的 `node:fs`/`node:path`）需要獨立的 `tsconfig.node.json`（README §2.1／T0 已規劃），此發現印證了該規劃的必要性。

## Open Questions（status）

- **OQ-48.1 / API hosting**：**Closed（2026-08-27）**。採 Vite dev/preview middleware（D-48.P8）。使用者經 AskUserQuestion 確認推薦預設。
- **OQ-48.2 / history root**：**Closed（2026-08-27）**。凍結為 `data/session-history/`（D-48.P9）。使用者經 AskUserQuestion 確認推薦預設。
- **OQ-48.3 / corrupt-file UX**：Deferred to WP-49 T0；WP-48 只回 count/safe diagnostics。
- **原 OQ-48.2 / researcher Participant context**：Closed；Practice 不持久化，因此不需要此 UI。
