# T3 — 環境 metadata

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/data/metadata.ts` |
| **Status** | ⬜ TODO |

## Objective
蒐集每場 drill 的環境 metadata：backend、displayHz、simHz、browser、sensitivity、`crossOriginIsolated`、drillId、startedAt（FR-7.3，附錄 C meta）。研究效度的關鍵（不同後端延遲特性不同，ADR-1）。

## In scope
- `collectMeta(args)`：backend（WP-0 seam）、simHz（常數 128）、displayHz（量測 rAF 頻率或 screen）、browser（UA）、sensitivity（WP-1）、COI（`crossOriginIsolated`）、drillId（WP-6）、startedAt（ISO）。

## Out of scope
- 寫入匯出檔（→ T4）。

## Design notes
- 對齊附錄 C `meta`：`{drillId,backend,displayHz,simHz,browser,sensitivity,crossOriginIsolated,startedAt}`。
- displayHz：量測連續 rAF 間隔近似 refresh rate。
- **必填強制**：缺 backend/COI/sensitivity → throw（避免匯出無效資料）。

## Steps
- [ ] 建 `metadata.ts`：`collectMeta` + 必填檢查。
- [ ] displayHz 量測（rAF 取樣中位數）。
- [ ] Vitest：合成輸入 → meta 欄位齊全；缺必填 → throw。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] meta 欄位完整對齊附錄 C；必填缺漏即報錯；backend 取自 WP-0 seam。

## Commit
`feat(wp-7): 環境 metadata 蒐集（backend/Hz/browser/sensitivity/COI）（FR-7.3）`
