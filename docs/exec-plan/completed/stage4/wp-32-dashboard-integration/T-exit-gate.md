# T-exit — 驗收清單 D + C-D5 硬約束 + 文件對帳 + **M15 宣告**(stage4 交付)

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T5 全綠(T0–T4 已 commit) |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `docs/operational/acceptance-stage-d.md`;MODIFY [CLAUDE.md](../../../../../CLAUDE.md) §4(C-D5)、[DECISIONS.md](../../../DECISIONS.md)(GD-21)、[../README.md](../README.md) §3/§4/§8/§9、[exec-plan/README.md](../../../README.md) §2/§3、[CONTEXT.md](../../../../../CONTEXT.md)、[docs/MAP.md](../../../../MAP.md);移資料夾入 `completed/stage4/` |
| **狀態** | ⬜ |

## Objective

宣告 **M15 = stage4 交付**,並把「stage4 到底交了什麼、不能拿它說什麼」寫成一份可稽核的清單。這份清單的價值不在勾滿綠燈,而在**明列限制** —— 單一匿名受試者、n=3 session、WP-31 三指標全數未晉升、五條仍 open 的 OQ。

## In scope

### ① `docs/operational/acceptance-stage-d.md`(新)

格式比照 [acceptance-stage-e.md](../../../../operational/acceptance-stage-e.md):`§0 執行基線`(命令 + 結果)、`§1 驗收項`(逐項 A/M 判定 + 證據入口 + 狀態)、`§2 手動回填項`、`§3 已知限制`。

**驗收項(逐項對應 [../README.md §4](../README.md) 的 M15 完成條件)**:

| # | 驗收項 | 判定 |
|---|---|---|
| D-1 | 教練報告一鍵產出(FR-D16) | **A** — WP-29 T-exit(v0)+ WP-30 T-exit(v1)+ WP-31 T-exit(v2)的 committed 範例 deterministic |
| D-2 | 晉升指標 TS golden 對表綠 | **A** — 四支 `promoted-*.test.ts` 在 `test:ci` 內;容差三級(≤1e-12 / ≤1e-9 / 逐位相等) |
| D-3 | `npm run test:ci` exit 0 **且** `uv run pytest` 綠 | **A** — 兩閘輸出貼本檔 §0 |
| D-4 | 每指標附效度證據(fixture + 真實檢核 + 已知限制) | **A/M** — 逐指標指向 `analysis-*.md` 的對應段 |
| D-5 | **P2 三指標各有明確進退判定** | **A/M** — SPARC `stratified_only`、xcorr `research_only`、Fitts(WP-31 T3 判定);三者**全數未晉升**,理由與證據位置逐項列出 |
| D-6 | 結果頁晉升區塊在實機成立且統計 = 匯出 | **A** — T5 的 E2E 斷言 |
| D-7 | 引擎不變式未受損 | **A** — 決定性回歸零重錄、`schemaVersion` 未 bump、`src/sim`/`src/input`/`src/loop`/`src/data` 零 diff |
| D-8 | research ↔ src 單向隔離維持(C-D1) | **A** — `research/` 零 TS import;`src/` 只讀 committed golden JSON(且僅測試路徑,生產碼零 fixture 依賴) |

**§3 已知限制**(逐條寫,不得省略):

- 效度聲稱範圍:**單一匿名受試者 P001、n=3 tick-integral session(09:18/09:24/09:37)、非母體層級證據**;
- WP-31 三指標全數未進結果頁與教練報告主表(C-D3);
- `gate-v1` 的**上限條款**:三件組不證明個體差異可靠度,`coach_report` 在本樣本結構下不可達(OQ-S4-3 升級路徑 = ≥3 受試者後另立 `gate-v2`);
- 仍 open 的 OQ:**OQ-S4-10**(`t_release` inferred fallback 未驗)、**OQ-S4-11**(無 ADS-on / projectile 真實對照)、**OQ-S4-17**(REC 與 `t_detect` 系統性分歧)、**OQ-S4-19**(Fitts 的 D 內生性)、**OQ-S4-20**(xcorr 的最大化統計量);
- `filter_degenerate` 在 TS 晉升面不存在(刻意分歧,D-32.4);
- 單 drill n ≈ 20 peeks,結果頁統計為受試者內相對值(OQ-S4-22)。

### ② C-D5 入 CLAUDE.md §4 + GD-21 入 DECISIONS.md(關閉 OQ-S4-24)

**C-D5 — 晉升指標雙實作對表紀律**:`seg-v2` / `phase-v1` / `curve-v1` / `sync-v1` / `sg-seg-v2` 任一端(Python `research/` 或 TS `src/metrics/`)語意或參數變更,**必須同步重跑 `research/fixtures/golden/` 產生腳本並讓 `promoted-*.test.ts` 全綠**;版本字串只能升版,不得原地改語意。

同步入 [DECISIONS.md](../../../DECISIONS.md) 為 **GD-21**(跨 WP:晉升機制與雙實作維護紀律)。

### ③ 文件對帳

| 位置 | 內容 |
|---|---|
| [../README.md](../README.md) | §3 WP-32 狀態 ✅;§4 M15 完成條件逐項附證據;§6 WP-32 task 表更新為七 task 實況;§8 OQ 現況(4/21/22/23/24 關閉,17/19/20/10/11 維持 open);§9 對帳清單勾 `acceptance-stage-d.md` |
| [exec-plan/README.md](../../../README.md) | §2 stage4 狀態 ✅;§3 M15 ✅;§4 相依圖收斂 |
| [CONTEXT.md](../../../../../CONTEXT.md) | 新術語隨本切片回寫:TS 晉升面(`researchMetrics`)、`sg-seg-v2` 係數表、`PromotedMetrics` 的 `blocked` 語意、結果頁 research-promoted 區塊 |
| [docs/MAP.md](../../../../MAP.md) | §3 導航:stage4 完成 + `acceptance-stage-d.md` 入口 |
| 規格書 | 新增「階段 D」節 + 附錄 E 增「驗收清單 D」([../README.md §9](../README.md) 既有待辦項) |
| `analysis-*.md` | 確認 `analysis-phase-curves.md`(T3/T4 已補 TS 晉升面段)與 `analysis-advanced-diagnostics.md`(WP-31 T-exit 定稿)無殘留待辦 |

### ④ 資料夾收斂

`docs/exec-plan/active/stage4/` → `docs/exec-plan/completed/stage4/`(比照 stage5 先例);移動後修正被移動檔案內的相對連結。

## Out of scope

- 任何新指標、新對表、新 UI。
- 解 OQ-S4-10/11/17/19/20(pilot 後或另立 WP)。
- P3 backlog 任何項目(LDJ-V / velocity scaling / RawInputTrace / polling rate;觸發條件見 stage4 §2.1)。

## Steps

- [ ] 跑兩閘,原始輸出貼 `acceptance-stage-d.md` §0 與 progress。
- [ ] 撰寫 `acceptance-stage-d.md`(§0–§3,八個驗收項 + 七條已知限制)。
- [ ] C-D5 寫入 [CLAUDE.md](../../../../../CLAUDE.md) §4;GD-21 寫入 [DECISIONS.md](../../../DECISIONS.md);OQ-S4-24 標關閉。
- [ ] 文件對帳六處。
- [ ] [task-checklist.md](task-checklist.md) 全列翻 ✅;[progress.md](progress.md) 收斂(Progress / Decision Log / Surprises / OQ)。
- [ ] 資料夾移入 `completed/stage4/` + 修正相對連結;移動後重跑 `npm run test:ci` 確認無連結型測試受影響。
- [ ] `graphify update .`(AGENTS.md 規則)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **兩閘綠** | `npm run test:ci` exit 0(含四支 `promoted-*.test.ts` + 既有 `timeline-parity` / `epsilon-parity` / `detect-parity`)、`uv run pytest` exit 0;兩份原始輸出貼 `acceptance-stage-d.md` §0 |
| ② | **驗收清單 D 八項全數有證據入口** | 每項有可點擊的檔案/測試連結;無「待補」字樣 |
| ③ | **已知限制七條逐字落地** | 含單樣本效度範圍、WP-31 三指標未晉升、`gate-v1` 上限條款、五個 open OQ、`filter_degenerate` 分歧、單 drill n |
| ④ | **D-5 的進退判定明確** | 三個 P2 指標各有一句判定 + 證據位置;**三個全判未晉升也是合格交付**(C-D3) |
| ⑤ | **C-D5 + GD-21 落地** | CLAUDE.md §4 與 DECISIONS.md 各有一條;OQ-S4-24 標關閉 |
| ⑥ | **文件對帳六處完成** | 各有 commit 內容;stage4 §9 對帳清單全勾 |
| ⑦ | **M15 宣告可機械判定** | [../README.md §4](../README.md) 的 M15 五項條件逐項附證據位置,無推定字樣 |
| ⑧ | **資料夾已移入 `completed/stage4/`** | 相對連結修正後 `npm run test:ci` 仍 exit 0 |

## Commit

`docs(wp-32): T-exit — 驗收清單 D 定稿 + C-D5/GD-21 雙實作對表紀律 + M15 宣告(stage4 交付)+ 文件對帳與資料夾收斂`
