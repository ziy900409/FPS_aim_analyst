# T4 — JSON / CSV 匯出

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1, T2, T3 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/data/export.ts`；MODIFY `src/ui/`（匯出按鈕，WP-8 也用） |
| **Status** | ⬜ TODO |

## Objective
組 `{meta, ticks, events}` payload，匯出可下載的 JSON（主）與 CSV（ticks.csv + events.csv），對齊附錄 C（FR-7.4）。

## In scope
- `downloadJSON(payload)`：Blob + `URL.createObjectURL` 下載。
- `downloadCSV(payload)`：ticks 扁平表 + events 扁平表（OQ-7.3）。
- payload 組裝：`meta`（T3）+ `ticks`（T1 snapshot）+ `events`（T2）。

## Out of scope
- schema 文件（→ T5）；指標（→ WP-8）。

## Design notes
- JSON 對齊附錄 C 結構（`meta`/`ticks[]`/`events[]`）。
- CSV：ticks 欄 `t,vx,vz,cx,cy,keys`；events 欄 `type,t,...`（異質欄位以稀疏填或分檔）。
- 匯出讀 snapshot（不在熱路徑配置，OQ-7.4）。

## Steps
- [ ] 建 `export.ts`（JSON + CSV 下載）。
- [ ] 接 DataRecorder snapshot + metadata。
- [ ] Vitest：合成 payload → JSON 結構符附錄 C；CSV 欄位/行數正確。
- [ ] 手動驗：跑一場 drill → 下載 JSON/CSV，內容可開、欄位齊。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 完整 drill 可下載 JSON + CSV；JSON 結構對齊附錄 C；CSV 可解析。

## Commit
`feat(wp-7): JSON/CSV 匯出（對齊附錄 C schema）（FR-7.4）`
