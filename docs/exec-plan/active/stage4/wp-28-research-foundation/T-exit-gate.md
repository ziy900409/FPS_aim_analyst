# T-exit — M14 gate 宣告(research 地基成立)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 全綠 |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `docs/operational/analysis-segments.md`;ADD 一鍵 script(`research/` 內:匯出 → 分段 + 品質報告);MODIFY [../README.md](../README.md) §3 狀態、[../../../README.md](../../../README.md) §2/§3 |
| **狀態** | 🟡 **M14 ② 已撤回(2026-08-05,[KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md));①③④⑤⑥ 維持** |

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

- [x] 一鍵 script + 於合成與真實匯出上跑通;真實樣本 3,507 ticks / median dt 7.8125ms / gap 0 / exit 0。
- [x] `analysis-segments.md` 落地(參數凍結值 + version + 限制 + flags 詞彙表)。
- [x] `uv run pytest` + `npm run test:ci` 兩份輸出貼 progress。
- [x] M14 六項證據表填齊(下方 DoD),阻塞項狀態明確。
- [x] 文件對帳(WP README §3/§9、exec-plan README §2/§3、CONTEXT.md 術語)。

## Definition of Done — M14 六項

| # | 條件 | 判定方式 | 結果(2026-08-05) |
|---|---|---|---|
| ① | **真實** drill 匯出 ingest 綠 + dt 報告產出 | 一鍵 script 於真實匯出 exit 0;dt 報告含 tick 數/缺口/中位間隔 | ✅ `counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json`:exit 0;3,507 ticks / median dt 7.8125ms / gap 0 / uniform;27.390625s、`participantId=P001`、PII-like literal scan 無命中、`suspect=false`、無 overflow |
| ② | **ε 層 parity 綠** | `npm run test:ci` exit 0 且 `epsilon-parity.test.ts` 五個量 ≤1e-9 | ❌ **撤回(2026-08-05,[KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-2)**。機制面仍綠(`test:ci` exit 0、逐 presentation ≤1e-9),但**兩側一致地錯**:ε 的量測原點寫死 `(px, eyeY, pz)`,遺漏 camera base offset(`eyeZ = depth/2 − standoff = 4`)與 `SIM_TO_WORLD`。以引擎 `fire.offsetDeg` 為 ground truth 實測偏差:08:03 = **12.52°**、09:39 = **67.11°**(正確公式 0.21°/0.14°)。待 KI-004 S1 落地 + 重產 parity fixture 後重新宣告 |
| ③ | 合成 fixture 分段邊界誤差 ≤ 2 tick | T3 六個 fixture 測試綠 | ✅ `test_known_submovement_boundaries_are_within_two_ticks` 綠(T3 掃參實測 max error = 1 tick) |
| ④ | **真實**資料分段成功率 + 疊圖報告 | `notebooks/t3-sweep/outputs/` 產出 + progress 記錄 | ✅ 20 peeks 中 19 個 `primary_flick`;成功率 **0.95**;20 張 `real-peek-*-overlay.svg` + summary/segments CSV 產出。人工逐張檢核:19 段皆包住主要 ω burst,未見跨兩個獨立 burst 的錯誤合併;peek 0 長靜止窗為 `below_floor|no_segment` |
| ⑤ | 分段參數 pre-registered 凍結並記 `analysis-segments.md` | 文件含凍結值 + `version` + 掃參證據 | ✅ 保留 `seg-v1` 不調參;243 組合成掃參(max error 1 tick)+ 本次真實成功率/疊圖結論/單樣本效度限制已回寫 [analysis-segments.md](../../../../operational/analysis-segments.md)。T3 runner 的 leading-`nan` flags 污染另列已知限制,不影響 pipeline 品質摘要或疊圖幾何 |
| ⑥ | `uv run pytest` 全綠 | 退出碼 0(輸出貼 progress) | ✅ **74 passed in 4.52s**,exit 0(workspace `--basetemp`) |

**宣告規則已滿足**:匿名真實匯出已完成 ① ingest/dt、④ 成功率/疊圖與 ⑤ 人工效度回填;②③⑥ 亦於 2026-08-05 複驗全綠。

### 判定:M14 🟡 —— ② 於 2026-08-05 撤回

原判定(六項全綠、WP-30/31 解除 blocker)**已於同日撤銷**:② 的 parity 綠燈是「兩個實作一致地錯」,不構成 ε 地基成立的證據([KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md))。現況:

- **①③④⑤⑥ 維持** —— 分段地基走 ω(t),只依賴 `ticks[].aim`,與量測原點無關,不受 KI-004 影響。
- **② 待重新宣告** —— 需 KI-004 S1(修正原點 + Python 同步 + 重產 parity fixture + 新增 `fire.offsetDeg` 正確性閘)。
- **WP-30/31 entry blocker 恢復**;**WP-29 不受影響**(只吃 `events` 與 `ticks[].keys`)。
- OQ-S4-8 維持關閉(fixture 政策與此無關)。

解除阻塞實測記錄:

1. 匿名化 27.390625s 匯出已放 `research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json`。
2. `uv run python src/report/run_pipeline.py --export fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` → exit 0,dt uniform,分段成功率 0.95。
3. `uv run python src/modules/segments/notebooks/t3-sweep/run_sweep.py --real-export fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` → 20 張 SVG;人工檢核支持 `seg-v1`,結論已回寫 `analysis-segments.md`。參數未調整;未來若新真實資料否證 `seg-v1`,依 D-28.7 只能**升版重跑全鏈**,不得原地調參。

## Commit

`docs(wp-28): T-exit gate — M14 宣告(research 地基:ingest/ω-ε parity/分段/flags + analysis-segments.md)`
