# T-exit — M14 gate 宣告(research 地基成立)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 全綠 |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `docs/operational/analysis-segments.md`;ADD 一鍵 script(`research/` 內:匯出 → 分段 + 品質報告);MODIFY [../README.md](../README.md) §3 狀態、[../../../README.md](../../../README.md) §2/§3 |
| **狀態** | ⬜ |

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

- [ ] 一鍵 script + 於合成匯出上跑通;(樣本到位後)於真實匯出上跑通。
- [ ] `analysis-segments.md` 落地(參數凍結值 + version + 限制 + flags 詞彙表)。
- [ ] `uv run pytest` + `npm run test:ci` 兩份輸出貼 progress。
- [ ] M14 六項證據表填齊(下方 DoD),阻塞項狀態明確。
- [ ] 文件對帳(WP README §3/§9、exec-plan README §2/§3、CONTEXT.md 術語)。

## Definition of Done — M14 六項

| # | 條件 | 判定方式 | 阻塞狀態 |
|---|---|---|---|
| ① | **真實** drill 匯出 ingest 綠 + dt 報告產出 | 一鍵 script 於真實匯出 exit 0;dt 報告含 tick 數/缺口/中位間隔 | **需真實樣本(OQ-S4-8)** |
| ② | **ε 層 parity 綠** | `npm run test:ci` exit 0 且 `epsilon-parity.test.ts` 五個量 ≤1e-9 | 可立即完成 |
| ③ | 合成 fixture 分段邊界誤差 ≤ 2 tick | T3 六個 fixture 測試綠 | 可立即完成 |
| ④ | **真實**資料分段成功率 + 疊圖報告 | `notebooks/t3-sweep/outputs/` 產出 + progress 記錄 | **需真實樣本(OQ-S4-8)** |
| ⑤ | 分段參數 pre-registered 凍結並記 `analysis-segments.md` | 文件含凍結值 + `version` + 掃參證據 | 需 ④ 的掃參結果 |
| ⑥ | `uv run pytest` 全綠 | 退出碼 0(輸出貼 progress) | 可立即完成 |

**宣告規則**:①④⑤ 需真實匯出樣本;**樣本未到位時 M14 不得宣告**,本 task 停在「②③⑥ 綠 + ①④⑤ 明列阻塞」狀態,WP-29 仍可依 T1 ingest 先行(相依圖 §5),但 **WP-30/31 不得開工**。

## Commit

`docs(wp-28): T-exit gate — M14 宣告(research 地基:ingest/ω-ε parity/分段/flags + analysis-segments.md)`
