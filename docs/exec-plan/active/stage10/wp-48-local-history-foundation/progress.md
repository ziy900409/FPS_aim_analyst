# WP-48 — progress.md

> Running log。Spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27 / planning**：依使用者指定的 `.claude/skills/engineering-planning/SKILL.md` 完成 repository-grounded tech spec。已讀 `AGENTS.md`、Stage 10 spec、skill design standards/template；以 CodeGraph／graphify 對帳 export completion、Result Screen、metadata/session 與 validator 邊界。尚未寫 production code、尚未開始 T0。
- **2026-08-27 / scope revision**：使用者將 WP-48 改為 Assessment-only history。Practice 不自動保存、不能依 Participant 瀏覽；保留當次 Result Screen 與手動匯出。已移除 Participant context 工作，新增 client short-circuit 與 repository/API rejection 的雙層驗收。

## Decision Log

- **D-48.P1 / payload seam**：自動保存必須使用 render-loop completion 已建立、同時供 metrics/diagnosis/Result Screen 使用的**同一個 `ExportPayload`**；不得二次 snapshot/build。
- **D-48.P2 / schema trust**：`sessionHistoryLoader.ts` 現有 shallow `isExportPayload()` 不足以保護 filesystem/API；T1 建立單一 strict runtime parser，舊 loader 改用它。
- **D-48.P3 / source of truth**：JSON 是唯一 source of truth；memory index/cache 皆可重建，不引入 DB。
- **D-48.P4 / identity**：run identity 使用 schemaVersion + Participant ID + exact drillId + normalized startedAt；同 identity same content=idempotent，different content=conflict。
- **D-48.P5 / missing participant**：不使用 `anonymous`／`unknown` placeholder；沒有 Participant ID 就拒絕保存並顯示可行動狀態。
- **D-48.P6 / live loop isolation**：History API/client 不進 sim tick；保存失敗不影響 Result metrics、session progression 或 determinism。
- **D-48.P7 / Assessment-only archive**：只有 `meta.assessment !== undefined` 的 payload 可以建立歷史紀錄。Practice 仍是合法 `ExportPayload`，但 client 回 `excluded` 且不送 request；repository/API 對直接 submission 回 `PRACTICE_NOT_ARCHIVABLE`，不得建立任何檔案。此決策取代原本的 Practice 歷史／Participant context 規劃。

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

## Open Questions（status）

- **OQ-48.1 / API hosting**：Open；推薦 Vite dev/preview middleware。Owner：使用者／架構師。Deadline：T0 exit。
- **OQ-48.2 / history root**：Open；推薦 `data/session-history/`。Owner：使用者。Deadline：T0 exit。
- **OQ-48.3 / corrupt-file UX**：Deferred to WP-49 T0；WP-48 只回 count/safe diagnostics。
- **原 OQ-48.2 / researcher Participant context**：Closed；Practice 不持久化，因此不需要此 UI。
