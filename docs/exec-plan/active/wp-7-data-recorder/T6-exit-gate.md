# T6 / T-exit — Exit gate（宣告 M3）

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-7 ✅ + M3）；docs only |
| **Status** | ✅ DONE（2026-07-03）— **M3 達成** |

## Objective
驗證 F1/F2 資料層整體綠燈，宣告 **M3（完整 drill 能端到端匯出資料）**，可開始 pilot。交棒 WP-8（消費記錄/匯出做統計）。

## Steps
- [x] `npx vitest run` 綠燈（ring buffer/事件/metadata/匯出 + 決定性回歸）— **20 files / 153 tests passed**（含 determinism 9 tests）。
- [x] `npx tsc --noEmit` exit 0。
- [x] 手動驗（端到端）：使用者於 Edge/Chromium 146 實跑 `counterstrafe_ad_v1` 並下載 JSON + `ticks.csv`（2026-07-03）。**22,219 ticks / 37 visible·21 counter·39 fire**；`meta` 齊全有效（`backend: webgpu`、`crossOriginIsolated: true`、`simHz: 128`、`suspect: false`）；`vx` 達 ±250（vStrafe source unit）；schema 與 `schema.md` 一致；無可感 GC 卡頓。（序列化鏈另由 `export.test.ts` byte-exact 覆蓋。）
- [x] map 下方 5 項驗收 → 證據；勾選（見 progress.md 2026-07-03 表）。
- [x] 翻 [頂層索引](../../README.md) §2 WP-7 ✅ + §3 標記 **M3 達成**。
- [x] progress.md 寫 `Outcomes & Retrospective`（無 GC 壓測結果、schema 一致性、metadata 完整性）。
- [x] 記本機紅綠燈證據（progress.md）；發現跨 WP crosshair 缺口 → 記 [DECISIONS.md](../../DECISIONS.md) GD-4。

## Acceptance criteria（PLAN WP-7 / F1/F2 / M3）→ evidence
- [x] ring buffer 每 tick 記錄、無 GC 卡頓 → T1（100k-tick 無配置壓測）
- [x] 事件流完整 → T2（visible/counter/fire 三 variant）
- [x] 環境 metadata 完整 → T3（collectMeta 強制必填 + finite）
- [x] JSON/CSV 可下載 → T4（byte-exact 附錄 C + UI 串接）
- [x] schema 與文件一致 → T5（schema.md 逐欄對照型別）

## Known limitation（不 blocking M3 機制門）
- `SharedState.crosshair` 無 production writer → 匯出恆 `[0,0]`。跨 WP 缺口，記 [DECISIONS.md](../../DECISIONS.md) GD-4，WP-8 entry-gate 處理。

## Definition of Done
- 5 項驗收勾選有證據；**M3 達成**並記於頂層索引；交棒 note 指向 WP-8。✅

## Commit
`docs(wp-7): exit gate — 宣告 M3 + 驗收 map + 交棒 WP-8`
