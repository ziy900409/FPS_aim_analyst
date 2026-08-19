# WP-28 — research-foundation:research/ 地基(ingest + 角運動學 + ε parity + submovement 分段)

> stage4 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:**GD-19**(採納/編號/research 邊界/parity 雙向,2026-08-04)· **GD-20**(教練報告紅線)· GD-7(追蹤指標 raw-over-derived)· GD-11(FPSci 紅線)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | `research/` Python 離線分析層的**地基**:四目錄制 scaffold + schema v2 ingest(含 stage5 additive 欄)+ 角運動學 ω(t)/ε(t)(**與既有 TS 推導雙向 parity**)+ submovement 分段(參數 pre-registered 凍結)+ per-segment quality flags |
| **里程碑** | **M14**(research 地基:分段 + ε 是全 stage 的單點故障;**未過不展開 WP-30/31**) |
| **相依** | M4 ✅ + WP-16 ✅ + **M11/M12 ✅**(`meta.targets.hitbox` / tick `ads` / `hit` 事件語意已鎖) |
| **對應 FR** | FR-D1 ~ FR-D6 |
| **估時** | 3.5–4.5 dev-days |
| **狀態** | 🟡 **M14 ①②⑥ 維持,③④⑤ 已撤回**(2026-08-06)。程式碼交付物(T1–T4 + `run_pipeline.py`)仍在且測試綠。② [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md)(ε 量測原點)已於 S1 落地後**重新宣告(2026-08-06)**;③④⑤ 因 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md)(ω(t) 受 render/sim beat 汙染,有效產率 4/19)+ [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md)(效度閘樣本 `vx ≡ 0`、`counter` 事件 0,無 counter-strafe 構念)撤回、**尚未落地**。**WP-30/31 entry blocker 仍維持**(三條獨立理由中僅 KI-004 一條解除);WP-29 不受影響,已交付。詳見 [T-exit-gate.md](T-exit-gate.md) |

---

## 1. 範圍

**In scope**:

```
research/pyproject.toml                          ← ADD Python 3.12 + uv;numpy/pandas/scipy/pytest   [T1]
research/README.md                               ← ADD 閘門指令 + fixture 體積上限 + 參數 registry   [T1]
research/src/modules/ingest/                     ← ADD load_export / check_dt / 合成匯出產生器        [T1]
research/src/modules/kinematics/                 ← ADD omega_deg_s / epsilon_deg / on_target          [T2]
research/src/modules/segments/                   ← ADD SG 平滑 / submovement 分段 / per_segment_apply [T3/T4]
research/src/shared/filters/                     ← ADD sg_filter / butter_filter(移植)              [T3]
research/fixtures/{exports,parity}/              ← ADD 合成匯出 + parity JSON                         [T1/T2]
tests/golden/research/epsilon-parity.test.ts     ← ADD vitest 對表閘(在既有 test:ci 內)             [T2]
research/src/report/run_pipeline.py               ← ADD 一鍵 pipeline(WP-29/30/31 共同入口)+ tests    [T-exit]
docs/operational/analysis-segments.md            ← ADD 分段參數 registry + 限制                       [T3/T-exit]
CLAUDE.md §4                                     ← MODIFY C-D1~C-D4 四條硬約束                        [T0]
```

**Out of scope**:peek 時間軸 / Sync 族(WP-29)、phase / 101pt(WP-30)、SPARC / xcorr / Fitts(WP-31)、TS 晉升實作與結果頁(WP-32)、教練報告組裝(WP-29 T-exit 起)。

## 2. 關鍵契約

- **既有構念零重定義(C-D4)**:ε(t)/on-target/t_acquire/peek 窗界一律沿用 [analysis-tracking.md](../../../../operational/analysis-tracking.md) 與 [trackingDerivation.ts](../../../../../src/metrics/trackingDerivation.ts):窗 = `[t_visible, nextVisible.t)`(末筆 +∞)、`eyeY = 1.6`、hitbox 取 `meta.targets.hitbox`(缺 → H1 `{1,2,1}`)、ε = aim 前向與目標中心無號夾角。**不重推、不調參**。
- **parity 是 T2 的交付本體,不是附帶測試**:Python 產 `fixtures/parity/*.json`,由 `tests/golden/research/` 的 vitest 對表 `deriveTrackingMetrics`(≤1e-9)。閘落在**既有 `npm run test:ci`**;Python 閘為獨立 `uv run pytest`(GD-19 / OQ-S4-7)。
- **單向隔離(C-D1)**:`research/` 不得 import 任何 TS 模組;`src/` 不得 import Python 產物(唯一例外 = committed parity/golden JSON)。
- **`algorithms/` 純函式(C-D2)**:禁 matplotlib / print / file I/O;純度由測試斷言(import 後無檔案寫入、無 matplotlib)。
- **合成匯出產生器是解鎖器**:真實樣本未到位前,`make_synthetic_export` 提供 schema-faithful、決定性的 v2 payload → ingest/kinematics/parity/分段演算法全可開發並測試。**但合成不得替代 M14 的真實資料項**(§4)。
- **分段參數 pre-registered 凍結**:`SegmentParams` 掃參證據記 progress,定案後寫入 `analysis-segments.md` 並帶 `version` 字串;事後調整 = 改 version + 重跑全鏈。
- **rad→deg 唯一轉換點**:只在 `kinematics/algorithms/angular.py`;下游模組一律吃 deg。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| Python ε 與 TS 不一致(座標慣例/窗界/hitbox fallback) | 全部逐段指標建在錯誤地基,M14 假綠 | parity 為 T2 DoD 首項;不一致先修 Python;若屬 spec 分歧 → 入 [DECISIONS.md](../../../DECISIONS.md) 後才算 PASS |
| 分段閾值在 128Hz/deg/s 不穩(碎段/漏段) | 逐段指標全失真 | 合成 fixture 釘死已知邊界(≤2 tick);真實掃參 + 疊圖人工檢核;fallback = 加大 SG window / 遲滯雙門檻 |
| 真實匯出樣本未到位 | M14 ①④ 無法宣告 | ✅ 2026-08-05 樣本到位並完成 pipeline/sweep/人工檢核;OQ-S4-8 關閉 |
| `algorithms/` 混入 I/O 或繪圖 | 純度紀律腐化,notebook 與演算法糾纏 | 純度測試(import 掃描 + 無寫檔斷言)為 T1 DoD |
| flags 被吞成 NaN | 品質失敗變成「缺資料」,聚合被污染 | `per_segment_apply` 對 fn 拋錯改記 `compute_failed:<reason>` flag;T4 注入測試 |
| dt 非均勻(掉 tick)未被發現 | ω(t) 微分錯,分段全歪 | `check_dt` 報告 gap_count/gaps;非 uniform → 下游 flag |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0 ✅** | [T0-entry-gate.md](T0-entry-gate.md) | 決策落地(OQ-S4-1/7/8)+ CLAUDE.md §4 C-D1~C-D4 + 樣本狀態記錄 | — | Low |
| **T1 ✅** | [T1-scaffold-ingest.md](T1-scaffold-ingest.md) | 四目錄制 + `load_export`/`check_dt` + 合成匯出產生器 | T0 | Low |
| **T2 ✅** | [T2-angular-kinematics.md](T2-angular-kinematics.md) | ω(t)/ε(t)/on_target + **ε 層雙向 parity 閘** | T1 | **High** |
| **T3 ✅** | [T3-submovement-segments.md](T3-submovement-segments.md) | SG 平滑 + submovement 分段 + `seg-v1` 參數凍結(合成 DoD;真實資料證據留 M14 blocker) | T2 | **High** |
| **T4 ✅** | [T4-per-segment-flags.md](T4-per-segment-flags.md) | `per_segment_apply` + quality flags | T3 | Low |
| **T-exit ✅** | [T-exit-gate.md](T-exit-gate.md) | 一鍵 script(`src/report/run_pipeline.py`)+ `analysis-segments.md` + M14 六項證據;2026-08-05 宣告後**分兩次撤回**:② (08-05, KI-004)、③④⑤ (08-06, KI-005/KI-006);② 已於 2026-08-06 KI-004 S1 落地後**重新宣告**,③④⑤ 已於 2026-08-07 [A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)**重新宣告**;**M14 六項全數恢復** | T1–T4 | — |
