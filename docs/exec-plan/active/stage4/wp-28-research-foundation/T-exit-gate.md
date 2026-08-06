# T-exit — M14 gate 宣告(research 地基成立)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 全綠 |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `docs/operational/analysis-segments.md`;ADD 一鍵 script(`research/` 內:匯出 → 分段 + 品質報告);MODIFY [../README.md](../README.md) §3 狀態、[../../../README.md](../../../README.md) §2/§3 |
| **狀態** | 🔴 **M14 ②③④⑤ 已撤回;僅 ①⑥ 維持**(② 於 2026-08-05 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md);③④⑤ 於 2026-08-06 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) + [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md)) |

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
| ③ | 合成 fixture 分段邊界誤差 ≤ 2 tick | T3 六個 fixture 測試綠 | ❌ **撤回(2026-08-06,[KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md))**。測試本身仍綠(max error = 1 tick),但**證據力失效**:`make_synthetic_export` 直接產生 `aim`/ω 序列,**完全不經 render path**,故合成訊號結構上不可能含 render/sim aliasing。此閘無法保證分段器在真實訊號上的行為 |
| ④ | **真實**資料分段成功率 + 疊圖報告 | `notebooks/t3-sweep/outputs/` 產出 + progress 記錄 | ❌ **撤回(2026-08-06)**,兩條**相互獨立**的理由:**(a) [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md)** — ω(t) 受 240/128 Hz beat 汙染,每 8 tick 一個假凹口;0.95 計入被假象切碎後又合併的段,真正未 flag 的逐段指標僅 **n = 4 / 19(21%)**(`merged_adjacent_peaks` 15/19)。人工檢核的「merges within one noisy principal burst」方向正確,但把確定性儀器假象歸因為 noise。**(b) [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md)** — 該樣本 `vx ≠ 0` 的 tick = **0**、`keys` 全空、`counter` 事件 **0**,是站樁純 flick,**counter-strafe 構念從未被執行**。即使 (a) 修好,以此樣本重跑仍不構成效度證據 |
| ⑤ | 分段參數 pre-registered 凍結並記 `analysis-segments.md` | 文件含凍結值 + `version` + 掃參證據 | ❌ **撤回(2026-08-06,[KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) + [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md))**。`seg-v1` 的 SG window = **7 tick**,而 beat 週期 = **8 tick** —— **濾波窗短於假象週期,數學上不可能濾除**;且 243 組掃參全在不含此假象的合成訊號上進行。凍結值於真實資料不適用,須待 KI-005 修法落地後**升版 `seg-v2` 重掃**(依 D-28.7 不得原地調參)。[analysis-segments.md](../../../../operational/analysis-segments.md) 的 “Real-export validation” 段已加註撤回 |
| ⑥ | `uv run pytest` 全綠 | 退出碼 0(輸出貼 progress) | ✅ **74 passed in 4.52s**,exit 0(workspace `--basetemp`) |

~~**宣告規則已滿足**:匿名真實匯出已完成 ① ingest/dt、④ 成功率/疊圖與 ⑤ 人工效度回填;②③⑥ 亦於 2026-08-05 複驗全綠。~~(2026-08-06 作廢,見下)

### 判定:M14 🔴 —— ② 於 2026-08-05 撤回;③④⑤ 於 2026-08-06 撤回

原判定(六項全綠、WP-30/31 解除 blocker)已分兩次撤銷,**目前僅 ①⑥ 維持**:

- **② 撤回(2026-08-05,[KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md))** —— parity 綠燈是「兩個實作一致地錯」,不構成 ε 地基成立的證據。待 KI-004 S1(修正原點 + Python 同步 + 重產 parity fixture + 新增 `fire.offsetDeg` 正確性閘)後重新宣告。
- **③④⑤ 撤回(2026-08-06,[KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) + [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md))** —— 見下方「豁免撤銷」。
- **① 維持** —— ingest/dt 屬 schema 與取樣層檢核,與 aim 差分及行為內容皆無關;3,507 ticks / gap 0 / uniform 仍有效。
- **⑥ 維持** —— `uv run pytest` 74 passed / exit 0,與上述缺陷無關。
- **WP-30/31 entry blocker 維持**,現有**三條相互獨立**的理由:KI-004(ε 原點)、KI-005(ω 汙染)、KI-006(樣本無構念)。
- **WP-29 不受影響**(只吃 `events` 與 `ticks[].keys`)。
- OQ-S4-8 維持關閉(fixture 政策與此無關)。

#### 豁免撤銷:「分段走 ω(t) 故不受影響」不再成立

本文件原記「①③④⑤⑥ 維持 —— 分段地基走 ω(t),只依賴 `ticks[].aim`,與量測原點無關,不受 KI-004 影響」。該推論**就量測原點而言正確**,但 `ticks[].aim` 另有一個**獨立**缺陷:它是以 **render 速率(~240 Hz)寫入**、以 **sim 速率(128 Hz)讀取**的訊號,逐 tick 差分後產生 zero-order-hold aliasing(每 8 tick 一個假凹口)。KI-005 §3.3 以 `meta.frames.series` 重建幀時序作決定性驗證:`corr = 0.805`,1 幀 tick 的正規化 ω = 0.550(模型預測 0.533)、2 幀 tick = 1.108(預測 1.067)、1 幀 tick 佔比 12.7%(預測 12.5%)。

⇒ **「只依賴 `aim`」不等於「不受影響」**。此豁免於 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md)、[BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md) BD-004 與本文件三處出現,**全部作廢**。

#### 重新宣告 ③④⑤ 的前置條件

> **前置條件已於 2026-08-06 因修法拍板而收斂**(BD-005:採選項 A、感度由 meta 重建、**不做過渡期選項 C**)。
> 關鍵後果:**既有 08:03 / 09:39 兩份匯出的 ω(t) 永久不可用** —— 選項 A 改變的是「記錄什麼」,
> 舊檔的 `aim` 已把 beat 假象寫死,且不做回溯清洗。**③④⑤ 無法用既有樣本搶跑。**

1. **KI-005 修法落地**(選項 A:tick 窗內積分 mouse delta;opt-in,關閉時逐位不變),
   並附決定性回歸測試(等速輸入下 ω 不隨 rAF 節奏跳動)。
2. **補 `meta.fovDeg`**(hip 基準 FOV,additive v2 欄)—— 感度由 meta 重建的必要條件;
   現行 meta 只有 `weapon.ads.fovDeg` 與 `sensitivity`,缺基準 FOV 則 ADS 期間增益無法還原
   ([KI-005 §6.2](../../../../known_issue/KI-005-omega-render-sim-aliasing.md))。
3. **重新採樣**(KI-006 選項 B;選項 A「改用 09:39」已隨本次拍板出局)—— 須明確要求受試者執行完整
   counter-strafe,使 `counter` 事件與橫移 tick 確實存在。建議一併考慮 n ≥ 2 session(OQ-KI6-4)。
4. **`seg-v2` 升版重掃** —— 以**修法後的新匯出**重掃;SG window 必須大於該 session 的 beat 週期;
   不得原地調參(D-28.7)。
5. 建議併行 **construct presence gate**(KI-006 選項 C),使「drill 宣告的構念未出現」在 ingest 層即被擋下。

解除阻塞實測記錄:

1. 匿名化 27.390625s 匯出已放 `research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json`。
2. `uv run python src/report/run_pipeline.py --export fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` → exit 0,dt uniform,分段成功率 0.95。
3. `uv run python src/modules/segments/notebooks/t3-sweep/run_sweep.py --real-export fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` → 20 張 SVG;人工檢核支持 `seg-v1`,結論已回寫 `analysis-segments.md`。參數未調整;未來若新真實資料否證 `seg-v1`,依 D-28.7 只能**升版重跑全鏈**,不得原地調參。

## Commit

`docs(wp-28): T-exit gate — M14 宣告(research 地基:ingest/ω-ε parity/分段/flags + analysis-segments.md)`
