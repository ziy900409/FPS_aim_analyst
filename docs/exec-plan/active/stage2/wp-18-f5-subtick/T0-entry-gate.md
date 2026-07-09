# T0 — Entry gate(上游 exit 驗證 + F5 seam 基線凍結 + OQ 收斂)

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(WP-17 M8 exit + GD-7 為 entry 前提,本 task 驗證其可追溯) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../CLAUDE.md) §4(移動目標決定性硬約束回寫,若尚缺)|
| **狀態** | ✅ PASS(2026-07-09) |

## Objective

動 `TargetManager`/`HitDetector` 之前先鎖:F5 seam 現況行為基線(零破壞不變式的參照)、移動目標的決定性紀律、motion 階層與 timed presentation 落點決議、與 WP-19 淨空驗證/WP-22 交付形狀的對帳點。

## In scope
- **上游 exit 可追溯**:WP-17(M8)✅ 與 GD-7 拍板證據引用(link + 一句結論);確認 `test:ci` 乾淨基準 exit 0(記 vitest/playwright 檔數/測項數作為 T1 零破壞基線)。
- **F5 seam 現況基線**(讀碼證據記 progress,作 T1/T2 零破壞參照):
  - `TargetManager` 現況——motion 寫入目標但不驅動([TargetManager.ts](../../../../src/sim/TargetManager.ts):33/117);`age` 未累加。
  - `HitDetector.raycastWithRay` 直接讀 `t.pos`([HitDetector.ts](../../../../src/sim/HitDetector.ts):84),無 sub-tick。
  - `simStep` 目標系統步位於命中判定之前([SimLoop.ts](../../../../src/loop/SimLoop.ts):335)——motion drive 與 posPrev 快照的注入點。
  - 既有命中/決定性回歸測試清單(T1/T2 零破壞閘的先跑對象)。
- **OQ-18.1 motion 階層**:本 WP T1 驅動的 motion type 集(建議 `linear`/`pingpong`/`sine`;`waypoints` 只淺驗形狀、不驅動)+ 各自 range/speed 的 `field-low` 走廊相容預設值範圍。記 ledger(明確集合與數值,非「傾向」)。
- **OQ-18.2 presentation 落點**:timed presentation 時長欄位落點(`timing.presentationMs` additive optional vs 複用 `peekTimeoutMs`)+ 追蹤 drill「命中不撤除」的機制點(DrillRunner running 相位語意)。記 ledger 定方向(細節在 T3 落地)。
- **OQ-18.3 posPrev 快照落點**:sub-tick 內插基準存 `TargetState.posPrev`(每目標,GC 紀律下物件重用)vs SimLoop 側平行結構——定方向,細節在 T2。
- **WP-19 對帳**:移動目標運動包絡(pingpong/sine range 極值、linear 行程)是否已被 `deriveTargetEnvelopes`/淨空驗證涵蓋;未涵蓋 → 記為 T1(或 WP-19)的待辦,互記雙方 progress。
- **OQ-S3-5 預對帳**:列出 WP-22 T1 需要的交付形狀清單(drill 型 / motion 欄 / presentation / render alpha / 指標欄),標明各由哪個 task 交付——供 T-exit 回填。
- **CLAUDE.md §4 回寫**(若尚缺):「移動目標位置一律以 `age`(sim tick 累加)驅動的純函式演進,不代入變動 dt、不讀時鐘——與逐 tick 決定性契約相容。」

## Out of scope
- 任何 `src/` 變更;schema 擴欄(T3/T4);motion 驅動實作(T1)。

## Steps

- [x] `npm run test`(或 `test:ci`)乾淨基準 exit 0,記檔數/測項數 progress(T1 零破壞基線)。→ tsc exit 0;vitest 58 files/438 tests;playwright 11 tests(edge)。
- [x] F5 seam 現況讀碼證據 + 既有命中/決定性回歸測試清單記 progress。→ TargetManager:33/117、HitDetector:84、SimLoop:338 核對無誤。
- [x] OQ-18.1 / OQ-18.2 / OQ-18.3 決議記 ledger(明確集合/數值/落點)。
- [x] WP-19 淨空包絡對帳結論(互記 progress)。→ `deriveTargetEnvelopes`/`expandForMotion` 已涵蓋,WP-18 不新增驗證碼。
- [x] OQ-S3-5 交付形狀清單 × task 對應表記 progress。
- [x] CLAUDE.md §4 移動目標決定性硬約束回寫(若尚缺;與本 task 同 commit)。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游 exit 可追溯、F5 seam 現況基線、三條 OQ 決議(明確數值/落點)、WP-19 對帳結論、OQ-S3-5 形狀×task 表;CLAUDE.md §4 含移動目標決定性約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-18): T0 entry gate — 上游 exit 驗證 + F5 seam 基線凍結 + motion/presentation OQ 收斂`
