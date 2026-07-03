# T1 — E2E 整合測試（drill → 匯出 → 統計）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | High / High |
| **Touches** | NEW `tests/e2e/full-drill.spec.ts`；MODIFY app（dev/test build 暴露 `window.__fpsTest` harness） |
| **Status** | ✅ Done（2026-07-03） |

## Objective
Playwright 端到端：啟動 app（帶 COOP/COEP）→ 斷言 `crossOriginIsolated` → 跑完整 drill（合成輸入）→ 匯出 JSON → 斷言 schema/事件/metadata → 斷言**結果頁統計 = 匯出資料**（FR-9.1）。

## In scope
- 測試 harness `window.__fpsTest`（startDrill/feedInput/forceExportJSON/getMetrics），僅 dev/test build。
- `full-drill.spec.ts`：全鏈路斷言。

## Out of scope
- 真原生滑鼠無加速（→ 手動驗收，T4）；效度分布（→ T2）。

## Design notes
- 合成一輪可控輸入（移動→急停→開火命中，左右交替），確保 events 完整。
- 統計=匯出：`getMetrics()` 與 `forceExportJSON()` 的 ticks/events 推導一致。
- schema 斷言對齊 WP-7 `schema.md`。

## Steps
- [x] app 暴露 `window.__fpsTest` harness（dev/test only，prod 不含 — 動態 import + `import.meta.env.DEV` 守衛；已驗 dist 無 `createFpsTestHarness`/`__fpsTest`）。
- [x] 寫 `full-drill.spec.ts`：COI → drill → 匯出 → schema/事件/meta → 統計=匯出。
- [x] `npx playwright test full-drill` 綠燈（1 passed，Edge）。
- [x] `tsc` 乾淨（`npm run typecheck` 無錯）。

## Definition of Done
- [x] 全鏈路 E2E 通過；匯出符 schema；結果頁統計與匯出資料一致。

## Commit
`test(wp-9): E2E 完整 drill → 匯出 → 統計（FR-9.1）`
