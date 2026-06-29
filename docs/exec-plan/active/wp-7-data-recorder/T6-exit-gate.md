# T6 / T-exit — Exit gate（宣告 M3）

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-7 ✅ + M3）；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 F1/F2 資料層整體綠燈，宣告 **M3（完整 drill 能端到端匯出資料）**，可開始 pilot。交棒 WP-8（消費記錄/匯出做統計）。

## Steps
- [ ] `npx vitest run` 綠燈（ring buffer/事件/metadata/匯出 + 決定性回歸）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗（端到端）：跑完整 `counterstrafe_ad_v1` drill → 下載 JSON/CSV → 內容含 meta + ticks + events，schema 一致、無 GC 卡頓。
- [ ] map 下方 5 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-7 ✅ + §3 標記 **M3 達成**。
- [ ] progress.md 寫 `Outcomes & Retrospective`（無 GC 壓測結果、schema 一致性、metadata 完整性）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-7 / F1/F2 / M3）→ evidence
- [ ] ring buffer 每 tick 記錄、無 GC 卡頓 → T1
- [ ] 事件流完整 → T2
- [ ] 環境 metadata 完整 → T3
- [ ] JSON/CSV 可下載 → T4
- [ ] schema 與文件一致 → T5

## Definition of Done
- 5 項驗收勾選有證據；**M3 達成**並記於頂層索引；交棒 note 指向 WP-8。

## Commit
`docs(wp-7): exit gate — 宣告 M3 + 驗收 map + 交棒 WP-8`
