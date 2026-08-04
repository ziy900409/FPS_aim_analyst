# T-exit — M14 gate 宣告(research 地基成立)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 全綠 |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `docs/operational/analysis-segments.md`;ADD 一鍵 script(`research/` 內:匯出 → 分段 + 品質報告);MODIFY [../README.md](../README.md) §3 狀態、[../../../README.md](../../../README.md) §2/§3 |
| **狀態** | 🟡 **②③⑥ 綠;①④⑤ 阻塞(OQ-S4-8 真實樣本)→ M14 未宣告** |

## Objective

宣告 **M14**:research 地基(ingest + ω/ε + parity + 分段 + flags)成立且可被 WP-29/30/31 引用。M14 是 stage4 的脊椎閘——**未過不展開 WP-30/31**。

## In scope

- **一鍵 script**:`匯出 JSON → ingest + dt 報告 + ω/ε + 分段 + 品質摘要` 單一命令產出(輸出落 `notebooks/*/outputs/` 或 `research/out/`);此 script 是 WP-29/30/31 的共同入口。
- **`docs/operational/analysis-segments.md`**(新):分段演算法定義、`SegmentParams` 凍結值 + `version`、掃參證據摘要、flags 詞彙表、**已知限制**(128Hz 頻帶、二元移動速度、單 drill n 偏小、真實資料檢核範圍)。
- **M14 六項證據彙整**(逐項連結 progress 與測試輸出)。
- 文件對帳:[../README.md](../README.md) §3 WP-28 狀態翻 ✅ + §9 `analysis-segments.md` 項打勾;[exec-plan/README.md](../../../README.md) §2 階段 D 表狀態 + §3 M14 行更新;CONTEXT.md 術語(submovement 分段 / ω(t) / parity fixture / reliability gate 佔位)隨本切片回寫。

## Out of scope

- WP-29/30/31/32 的任何指標;驗收清單 D(WP-32 T-exit)。

## Steps

- [x] 一鍵 script + 於合成匯出上跑通;(樣本到位後)於真實匯出上跑通 → **合成綠;真實待樣本**。
- [x] `analysis-segments.md` 落地(參數凍結值 + version + 限制 + flags 詞彙表)。
- [x] `uv run pytest` + `npm run test:ci` 兩份輸出貼 progress。
- [x] M14 六項證據表填齊(下方 DoD),阻塞項狀態明確。
- [x] 文件對帳(WP README §3/§9、exec-plan README §2/§3、CONTEXT.md 術語)。

## Definition of Done — M14 六項

| # | 條件 | 判定方式 | 結果(2026-08-04) |
|---|---|---|---|
| ① | **真實** drill 匯出 ingest 綠 + dt 報告產出 | 一鍵 script 於真實匯出 exit 0;dt 報告含 tick 數/缺口/中位間隔 | 🟡 **阻塞(OQ-S4-8)**。script 已交付並在合成匯出 exit 0(48 ticks / median dt 7.8125ms / gap 0);真實匯出未跑 |
| ② | **ε 層 parity 綠** | `npm run test:ci` exit 0 且 `epsilon-parity.test.ts` 五個量 ≤1e-9 | ✅ `test:ci` exit 0(tsc + Vitest 82 files / 641 tests + Playwright 18);parity 測試逐 presentation 覆蓋 `tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg` |
| ③ | 合成 fixture 分段邊界誤差 ≤ 2 tick | T3 六個 fixture 測試綠 | ✅ `test_known_submovement_boundaries_are_within_two_ticks` 綠(T3 掃參實測 max error = 1 tick) |
| ④ | **真實**資料分段成功率 + 疊圖報告 | `notebooks/t3-sweep/outputs/` 產出 + progress 記錄 | 🟡 **阻塞(OQ-S4-8)**。`run_sweep.py --real-export` 疊圖路徑 + 一鍵 script 成功率欄位已備妥,無樣本可跑 |
| ⑤ | 分段參數 pre-registered 凍結並記 `analysis-segments.md` | 文件含凍結值 + `version` + 掃參證據 | 🟡 **凍結與文件已完成,真實效度未驗**。`seg-v1` 凍結值 + 243 組掃參證據 + 限制 + flags 詞彙表已入 [analysis-segments.md](../../../../operational/analysis-segments.md);該文件明載全部證據來自合成軌跡 |
| ⑥ | `uv run pytest` 全綠 | 退出碼 0(輸出貼 progress) | ✅ **74 passed in 5.24s**,exit 0 |

**宣告規則**:①④⑤ 需真實匯出樣本;**樣本未到位時 M14 不得宣告**,本 task 停在「②③⑥ 綠 + ①④⑤ 明列阻塞」狀態,WP-29 仍可依 T1 ingest 先行(相依圖 §5),但 **WP-30/31 不得開工**。

### 判定:M14 ⬜ 未宣告

②③⑥ 綠、①④⑤ 阻塞於 OQ-S4-8。**WP-30/31 不得開工**;WP-29 可依 T1 ingest 與本 task 的一鍵 script 先行。

樣本到位後解除阻塞只需三步(無需改碼):

1. 匿名化 ≤30s 匯出放 `research/fixtures/exports/`。
2. `uv run python src/report/run_pipeline.py --export fixtures/exports/<real>.json` → ① 的 dt 報告 + ④ 的分段成功率。
3. `uv run python src/modules/segments/notebooks/t3-sweep/run_sweep.py --real-export fixtures/exports/<real>.json` → ④ 的疊圖 SVG;人工檢核後把結論回寫 `analysis-segments.md`(⑤ 的真實效度)。若真實資料否證 `seg-v1`,依 D-28.7 只能**升版重跑全鏈**,不得原地調參。

## Commit

`docs(wp-28): T-exit gate — M14 宣告(research 地基:ingest/ω-ε parity/分段/flags + analysis-segments.md)`
