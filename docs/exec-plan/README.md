# 執行計畫索引 — FPS 反向急停瞄準訓練器（階段 A + B + C + E + D）

> **本檔為大框架的現行權威**：WP 狀態、里程碑門控、跨階段相依圖、執行規則一律以本檔為準。全部工作包（階段 A：WP-0 ~ WP-9；階段 B：WP-10 ~ WP-18；階段 C：WP-19 ~ WP-22；階段 E：WP-23 ~ WP-26；單 WP：WP-27；階段 D：WP-28 ~ WP-32）在此展開成**每 WP 一個自足子資料夾**的可執行實作計畫。
> 階段 A（WP-0 ~ WP-9）源自 [`../PLAN.md`](../PLAN.md)，該檔 🧊 **已凍結**（停寫 2026-06、內容停在階段 A）；除 §1 決策 D1–D5 外不得引用，**階段 B 之後的工作包從不在該檔內**。
> 規格書：[`../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) v1.0 · 專有名詞：[`../../CONTEXT.md`](../../CONTEXT.md)
> 格式參照 `performance_analysis` repo 的 `issue-26` exec-plan（每 task 一個自足檔案，單 task 執行時 context 用量 < 40%）。

| | |
|---|---|
| **Repo** | [ziy900409/FPS_aim_analyst](https://github.com/ziy900409/FPS_aim_analyst) |
| **交付範圍** | 階段 A：F1–F4 + 1 個完整 counter-strafe drill（簡化「立即停止」急停） |
| **技術棧** | Three.js `WebGPURenderer`（`three/webgpu`）+ TypeScript + Vite；UI = 純 TS + DOM overlay；測試 = Vitest + Playwright |
| **估時** | 25–39 dev-days（≈5–8 週，含 WebGPU 設定與學習爬升） |
| **狀態** | ✅ **階段 A 交付**（WP-0 ~ WP-9 全部完成，**M4 達成 2026-07-03**；已移入 `completed/stage1/`）· ✅ **階段 B 交付**（WP-10~17 於 `completed/stage2/`，**M8 達成 2026-07-07**；**WP-18 F5 ✅ 交付 2026-07-09**，於 `completed/stage2/`）· ✅ **階段 C 交付**（WP-19~22 於 `completed/stage3/`；**WP-19 ✅ M9 2026-07-08 + WP-20 ✅ + WP-21 ✅ 2026-07-09 + WP-22 ✅ M10 2026-07-10**；兩感知實驗端到端成立且 pilot-ready、`test:ci` exit 0 + 清單 C 全 10 項（C-5 真 fullscreen 實機證據）；研究決議 GD-6~10 已全數拍板；已移入 `completed/stage3/`）· 🟡 **階段 E 已歸檔 `completed/stage5/`**（2026-07-15;**WP-23 ✅ M11 + WP-24 ✅ + WP-25 ✅ M12 + WP-26 T-exit 自動閘 ✅（`test:ci` exit 0）/ M13 待研究者實機手動回填（#32）正式宣告交付**；BR 遠距跟槍測試模組；編號分配見 [DECISIONS.md](DECISIONS.md) GD-15） · 🟡 **階段 D 已採納**（2026-08-04，[`active/stage4/`](active/stage4/README.md)：選手表現分析管線 research 層，WP-28~32 / M14~M15；GD-19/GD-20；**WP-28 ✅ 完成,M14 六項全數恢復/重新宣告**——①⑥維持,②已於 [KI-004](../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1 落地後重新宣告(2026-08-06),③④⑤ 已於 [A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告(2026-08-07,[KI-005](../known_issue/KI-005-omega-render-sim-aliasing.md)/[KI-006](../known_issue/KI-006-m14-sample-no-counterstrafe.md) 兩條理由均已解除,KI-006 CLOSED),**WP-30/31 entry blocker 已解除,可展開**） |

---

## 1. 規劃補充決策（全域，沿用 PLAN §1）

| # | 決策 | 結論 |
|---|---|---|
| D1 | 2D UI 層技術 | **純 TS + DOM overlay** |
| D2 | 測試框架 | **Vitest + Playwright** |
| D3 | COOP/COEP 部署 | **本機 Vite plugin + 靜態主機（後定）** |
| D4 | 文件語言 | **繁體中文（術語保留英文）** |
| D5 | PLAN 顆粒度 | **Agent 可執行的階段步驟（保留人工估時）** |

> **grill 對帳補充（2026-06）**：規格/PLAN 已併入一批規劃討論決策（F5 接縫 in·drills out、ADR-7 兩時鐘、輸入分桶、`DataRecorder` arena、M1 移動模型 + 指標分層、P2 推進、H1 單一 hitbox、source unit、開火 inline 評估）。權威定義見 [`../../CONTEXT.md`](../../CONTEXT.md)、[`../DESIGN.md`](../DESIGN.md)、規格 ADR-7 與 PLAN §1 決策表。**下列 WP 的舊 OQ/假設若與上述衝突，一律以 CONTEXT/規格為準**：WP-4 OQ-4.1（→ H1 單一 hitbox）、WP-6（→ `targets.motion?` 接縫、`spawnDelayMs`=0、`peekTimeoutMs`）、WP-7 OQ-7.1（→ arena 不繞圈 + `recorderOverflow`）、WP-8 過衝/殘速（→ 階段 A 分類呈現）。

---

## 2. 階段資料夾索引（WP-0 ~ WP-18）

> 每個 WP = 一個自足子資料夾，內含 `README.md`（tech spec）、`task-checklist.md`、`progress.md`、`T0-entry-gate` → `Tn` → `T-exit-gate`。
> ⬜ 待建立 · 🟡 進行中 · ✅ 完成

**階段 A（`completed/stage1/`，✅ 已交付 M4 2026-07-03）**

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-0** | [`completed/stage1/wp-0-environment-setup/`](completed/stage1/wp-0-environment-setup/README.md) | 空場景 + cross-origin isolation + backend 偵測 | → M1 | — | 3–5 | ✅ 完成（2026-06-30） |
| **WP-1** | [`completed/stage1/wp-1-fps-pointerlock/`](completed/stage1/wp-1-fps-pointerlock/README.md) | FPS 控制 + Pointer Lock + 原始輸入 | → M1 | WP-0 | 2–3 | ✅ 完成（2026-06-30） |
| **WP-2** | [`completed/stage1/wp-2-dual-loop-skeleton/`](completed/stage1/wp-2-dual-loop-skeleton/README.md) | `SharedState` + 雙迴圈骨架 + 決定性驗證 ★脊椎 | **M1 ✅** | WP-0, WP-1 | 3–4 | ✅ 完成（2026-07-01）|
| **WP-3** | [`completed/stage1/wp-3-input-sampler/`](completed/stage1/wp-3-input-sampler/README.md) | `InputSampler`（F1）高解析度時間戳採集 | — | WP-2 | 2–3 | ✅ 完成（2026-07-01） |
| **WP-4** | [`completed/stage1/wp-4-target-tvisible/`](completed/stage1/wp-4-target-tvisible/README.md) | `TargetManager` + `t_visible`（F2）左右交替 | — | WP-1, WP-2 | 2–3 | ✅ 完成（2026-07-02） |
| **WP-5** | [`completed/stage1/wp-5-hit-counterstrafe/`](completed/stage1/wp-5-hit-counterstrafe/README.md) | `HitDetector` + 橫移 + 簡化急停（F3） | **M2 ✅** | WP-3, WP-4 | 2–3 | ✅ 完成（2026-07-02） |
| **WP-6** | [`completed/stage1/wp-6-drill-system/`](completed/stage1/wp-6-drill-system/README.md) | `DrillConfig` 資料驅動 drill（F4） | — | WP-4, WP-5 | 2–4 | ✅ 完成（2026-07-02） |
| **WP-7** | [`completed/stage1/wp-7-data-recorder/`](completed/stage1/wp-7-data-recorder/README.md) | `DataRecorder` ring buffer + JSON/CSV 匯出（[`schema`](../operational/schema.md)） | **M3 ✅** | WP-2, WP-4, WP-5 | 3–5 | ✅ 完成（2026-07-03） |
| **WP-8** | [`completed/stage1/wp-8-metrics-hud/`](completed/stage1/wp-8-metrics-hud/README.md) | `MetricsDashboard` + 即時 HUD | — | WP-5, WP-6, WP-7 | 3–4 | ✅ 完成（2026-07-03） |
| **WP-9** | [`completed/stage1/wp-9-integration/`](completed/stage1/wp-9-integration/README.md) | 端到端整合 + 計時效度 + 決定性回歸 | **M4 ✅** | 全部 | 3–5 | ✅ 完成（2026-07-03） |

**階段 B（WP-10~17 ✅ 已移入 `completed/stage2/`；index 與 WP-18 於 `completed/stage2/`；tech spec：[`completed/stage2/README.md`](completed/stage2/README.md)）**

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-10** | [`completed/stage2/wp-10-recoil-core/`](completed/stage2/wp-10-recoil-core/README.md) | 後座力數學核心（彈道表 + punch 動力學 + inaccuracy）+ golden tests | **M5** | —（可立即開跑） | 2–3 | ✅ **M5（2026-07-05）** |
| **WP-11** | [`completed/stage2/wp-11-weapon-fire/`](completed/stage2/wp-11-weapon-fire/README.md) | `WeaponConfig` + fire down/up + cycletime 產彈 + 彈匣 | — | WP-10 | 2–3 | ✅ **（2026-07-06）** |
| **WP-12** | [`completed/stage2/wp-12-input-seams/`](completed/stage2/wp-12-input-seams/README.md) | CS2 感度換算（A4）+ 射線方向注入（A3） | — | — | 1–1.5 | ✅ **（2026-07-06）** |
| **WP-13** | [`completed/stage2/wp-13-sim-camera-integration/`](completed/stage2/wp-13-sim-camera-integration/README.md) | recoil 進 simStep（64Hz 子節奏）+ 相機/彈道合成 + 彈孔 | **M6** | WP-10, 11, 12 | 2–3 | ✅ **M6（2026-07-06）** |
| **WP-14** | [`completed/stage2/wp-14-movement-physics/`](completed/stage2/wp-14-movement-physics/README.md) | friction/accelerate integrator + velocity gate（~88 u/s）+ 殘速指標連續化 | — | —（介面不變，可並行） | 2–3 | ✅ **（2026-07-06）** |
| **WP-15** | [`completed/stage2/wp-15-calibration/`](completed/stage2/wp-15-calibration/README.md) | `cl_showpos` 軌跡校準 + pattern 圖逐彈比對 | **M7** | WP-13, 14 | 1.5–2 | ✅ **M7 caveated（2026-07-07）** |
| **WP-16** | [`completed/stage2/wp-16-metrics-export-v2/`](completed/stage2/wp-16-metrics-export-v2/README.md) | 匯出 schema v2 + 壓槍指標（補償 vs 理想路徑）+ 結果頁對照 | — | WP-13 | 2–3 | ✅ **2026-07-07** |
| **WP-17** | [`completed/stage2/wp-17-integration/`](completed/stage2/wp-17-integration/README.md) | E2E 全鏈路 + 決定性回歸擴充 + 驗收清單 B | **M8** | WP-15, 16 | 1.5–2.5 | ✅ **M8（2026-07-07）** |
| **WP-18** | [`completed/stage2/wp-18-f5-subtick/`](completed/stage2/wp-18-f5-subtick/README.md) | F5 移動 drill + 目標 sub-tick 命中內插 + 追蹤指標 | — | ~~OQ-S2-5~~ ✅（GD-7）+ ~~WP-17（M8）~~ ✅ | +2–3.5 | ✅ **交付（2026-07-09）** — T-exit gate 綠（`test:ci` exit 0；motion/FR-B17 內插/timed presentation/追蹤指標） |

**階段 C（✅ 已交付 M10 2026-07-10，已移入 `completed/stage3/`；tech spec：[`completed/stage3/README.md`](completed/stage3/README.md)；研究決議 [DECISIONS.md](DECISIONS.md) GD-6~10）**

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-19** | [`completed/stage3/wp-19-scene-system/`](completed/stage3/wp-19-scene-system/README.md) | 場景系統：SceneConfig + GLTF 管線 + 淨空驗證 + 雜亂度階層場景 ×2 | **M9 ✅** | M4 ✅（可與 stage2 尾段並行） | 4–6 | ✅ **M9（2026-07-08）** |
| **WP-20** | [`completed/stage3/wp-20-display-pipeline/`](completed/stage3/wp-20-display-pipeline/README.md) | 解析度模式 + fullscreen/資格閘 + frame-time log + session setup | — | M4 ✅（可並行） | 3–4 | ✅ **交付（2026-07-08）** |
| **WP-21** | [`completed/stage3/wp-21-detection-drill/`](completed/stage3/wp-21-detection-drill/README.md) | seeded spawn + pop-in 偵測 drill + t_detect 離線推導 spec | — | T1/T2 獨立；T3 需 WP-16 | 2.5–3.5 | ✅ **交付（2026-07-09）** |
| **WP-22** | [`completed/stage3/wp-22-perception-integration/`](completed/stage3/wp-22-perception-integration/README.md) | 追蹤×場景 + 解析度 protocol E2E + 決定性回歸 + 驗收清單 C | **M10 ✅** | WP-19, 20, 21 + WP-18 | 2–3 | ✅ **M10（2026-07-10）** — stage3 交付;`test:ci` exit 0 + 清單 C 全 10 項（C-5 真 fullscreen 實機證據） |

**階段 E（`completed/stage5/`，🟡 已歸檔 2026-07-15；WP-23 ✅ M11 · WP-24 ✅ · WP-25 ✅ M12 · WP-26 自動閘 ✅ / M13 待 #32 手動回填；tech spec：[`completed/stage5/README.md`](completed/stage5/README.md)；編號分配 [DECISIONS.md](DECISIONS.md) GD-15）**

> BR 遠距跟槍測試模組：BR 場景 × 遠距小目標 × ADS × 彈道。stage4 草稿（選手表現分析管線，[`active/stage4/README.md`](active/stage4/README.md)）未採納、採納時 WP 重編為 WP-27+（GD-15）。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-23** | [`completed/stage5/wp-23-longrange-tracking/`](completed/stage5/wp-23-longrange-tracking/README.md) | 遠距小目標追蹤：hitbox config 化（單一來源）+ 遠距 drill + 指標 round-trip/決定性 | **M11 ✅** | WP-18 ✅ + M10 ✅ | 1.5–2.5 | ✅（2026-07-10） |
| **WP-24** | [`completed/stage5/wp-24-ads-optics/`](completed/stage5/wp-24-ads-optics/README.md) | ADS 開鏡：EV_ADS 輸入鏈 + WeaponConfig.ads + zoom/感度（GD-16）+ scope overlay + 記錄 | — | M8 ✅（可與 WP-23 並行） | 2–3 | ✅（2026-07-13） |
| **WP-25** | [`completed/stage5/wp-25-ballistics-tracer/`](completed/stage5/wp-25-ballistics-tracer/README.md) | 彈道：tracer 顯示（T1 獨立）+ config-gated projectile（數學核心/sim 整合/指標語意） | **M12 ✅** | T1 獨立；T2+ 需 M11 | 4–6.5 | ✅（2026-07-14） |
| **WP-26** | [`completed/stage5/wp-26-br-scene-integration/`](completed/stage5/wp-26-br-scene-integration/README.md) | BR 場景實作與整合：`br-field` 原創資產/上線 + `tracking_br_v1` + protocol + E2E + 驗收清單 E | **M13** | WP-23, 24, 25 | 3–5 | 🟡 自動閘 ✅ / M13 待手動 |

**單 WP（`completed/muzzle-tracer/`，✅ 已交付 2026-08-04；編號分配 [DECISIONS.md](DECISIONS.md) GD-18）**

> WP-25 tracer 家族的 render-only 視覺延伸，不屬任何 stage、**無獨立里程碑**（T-exit gate 即交付判定）。依 GD-15「先採納先得」取用 **WP-27**，stage4 草稿順延重編為 **WP-28+ / M14+**。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-27** | [`completed/muzzle-tracer/`](completed/muzzle-tracer/README.md) | tracer 視覺起點自準心移至**槍口**（hip 右手位）+ ADS 時移至**準心下方**；命中判定/彈道物理/匯出**三不變**（GD-18） | —（exit gate 即交付） | WP-25 ✅ + WP-24 ✅ + **KI-002 D1 ✅**（[BD-002](../known_issue/BUGFIX-DECISIONS.md)） | 1.75–2.75 | ✅（2026-08-04） |

**階段 D（`active/stage4/`，🟡 已採納 2026-08-04；tech spec：[`active/stage4/README.md`](active/stage4/README.md)；編號分配 [DECISIONS.md](DECISIONS.md) GD-19 · 教練報告紅線 GD-20）**

> 選手表現分析管線（research 層：瞄準 × 急停診斷指標）。新增 `research/` Python 離線分析層（Python 3.12 + uv），**引擎零改動**（例外：WP-29 T3 選配 key 事件、WP-32 metrics/UI）。parity 雙向：既有構念（ε(t)/t_acquire）TS 為權威、Python 對表；新構念 Python 為權威、TS 對表——兩向的對表閘皆落在既有 `test:ci`。
> **M14 🟡**：①⑥ 維持,②於 KI-004 S1 落地後重新宣告(2026-08-06),③④⑤ 仍撤回(詳見 §3 M14 列)——KI-005 **A1 已落地**(2026-08-06,量測儀器修法)但 **A2**(新採樣 → 複驗 → `seg-v2` → M14 重新宣告)待排程,KI-006 的 **C**(construct presence gate)已落地(2026-08-07)但 **B**(重新採樣)待 A2,C 落地不解除任何 M14 撤回。**WP-30/31 entry blocker 因兩者解除條件均未滿足仍維持**。效度範圍仍限單一 counter-strafe 樣本。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-28** | [`active/stage4/wp-28-research-foundation/`](active/stage4/wp-28-research-foundation/README.md) | research 地基:四目錄制 + schema v2 ingest + ω(t)/ε(t)(**含 ε 雙向 parity 閘**)+ submovement 分段(參數凍結)+ quality flags + 一鍵 pipeline | **M14 ✅** | M4 ✅ + WP-16 ✅ + M11/M12 ✅ | 3.5–4.5 | ✅ **task 全數完成(2026-08-05);M14 六項全數恢復/重新宣告**(①⑥維持,②已於 2026-08-06 重新宣告,③④⑤ 已於 [A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 2026-08-07 重新宣告,KI-005 A1+A2 全數落地、KI-006 CLOSED) |
| **WP-29** | [`active/stage4/wp-29-coach-timeline/`](active/stage4/wp-29-coach-timeline/README.md) | 教練第一層：逐 peek 時間軸（交叉驗證 `compute.ts`）+ Release-to-Click Sync 族（+ 選配 `key` 事件）+ 教練報告 v0（單檔靜態 HTML，條件分層） | — | WP-28 **T1**（僅 ingest） | 1.5–2.5 | ✅ **完成(2026-08-05)**；`timeline-v1`/`sync-v1` 定稿，OQ-S4-6 關閉 |
| **WP-30** | `active/stage4/wp-30-trajectory-metrics/` | 軌跡診斷：REC/MR/V phase 分解 + L/R 101 點正規化曲線 + 教練報告 v1 | — | **M14 ✅**(entry blocker 已解除) | 2.5–3.25 | ✅ **完成(2026-08-10)**：`phase-v1`／`curve-v1` 定稿、`coach-report-v1` 一鍵與雙閘綠；REC/`t_detect` 系統性分歧保留研究向 OQ-S4-17 |
| **WP-31** | `active/stage4/wp-31-advanced-diagnostics/` | 進階診斷:SPARC + Key-Velocity xcorr（reliability gate，GD-20）+ Fitts | — | **M14 ✅**(entry blocker 已解除) | 2–3 | ⬜(可展開) |
| **WP-32** | `active/stage4/wp-32-dashboard-integration/` | 晉升整合：golden parity → `src/metrics/` TS 實作 + 結果頁擴充 + 驗收清單 D | **M15** | WP-29 + WP-30（WP-31 選項） | 2–3 | ⬜ |

---

## 3. 里程碑門控（gates）

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M1 ✅（2026-07-01）** | 雙迴圈骨架可空跑 + 決定性驗證通過 | WP-2 | 脊椎，量測效度基礎，**已達成 → WP-3 / WP-4 可並行展開** |
| **M2 ✅（2026-07-02）** | 場景中可橫移、急停、開火、命中 | WP-5 | 核心玩法成立，**已達成 → WP-6（drill 編排）/ WP-7（記錄）可展開** |
| **M3 ✅（2026-07-03）** | 完整 drill 能端到端匯出資料 | WP-7 | 資料層（F1/F2）端到端綠燈，**已達成 → 可開始 pilot / WP-8 metrics 可展開**（先讀 GD-4 crosshair 缺口） |
| **M4 ✅（2026-07-03）** | 階段 A 全部驗收清單通過（附錄 E 10 項硬閘全綠；自動閘 `test:ci` exit 0） | WP-9 | **階段 A 交付達成**（手動遊玩手感項為研究者實機回填步驟，不阻塞自動閘） |
| **M5 ✅（2026-07-05）** | recoil-core golden tests 全綠:seed 223 前 8 筆彈道表、10 發 punch 向量、前 4 發抑制係數、同 seed 決定性 | WP-10 | 數學核心正確性釘死;之後整合問題可歸因到接線而非公式 |
| **M6 ✅（2026-07-06）** | 瀏覽器內可按住連發壓槍:視覺上跳 + 彈道 = viewAngles + rawPunch×2 + spread 分離生效(automated `test:ci` 全綠 + 手動視覺 4 項使用者確認通過) | WP-13 | 壓槍玩法成立,核心手感可實測 |
| **M7 ✅ caveated（2026-07-07）** | 速度曲線於 sim cadence 公式/常數對表通過(theory surrogate,非 `cl_showpos` 實錄);recoil pattern 對 CS2 vdata M5 golden 逐位釘死;第三方 Aiming.Pro pattern 差異分層歸因為來源模型不匹配並被研究者接受(GD-14);velocity gate 連續模型上線 | WP-14+15 | counter-strafe × 壓槍研究效度成立;**外部實錄行為級真值仍為 caveat** |
| **M8 ✅（2026-07-07）** | E2E + schema v2 + 決定性回歸(punch/彈著序列)全綠;驗收清單 B(附錄 E-B)全 10 項通過;`test:ci` exit 0 | WP-17 | **stage2 交付達成**(WP-10~17;WP-18 F5 為門控後續) |
| **M9 ✅（2026-07-08）** | 場景可置換(≥2 雜亂度階層)+ 淨空驗證拒載違規 drill + 跨場景 sim 決定性逐位一致 + 資產 attribution 可稽核 | WP-19 | 場景脊椎:「換場景零引擎碼」與「場景不碰決定性」被測試釘死（`test:ci` exit 0：356 vitest + 10 e2e） |
| **M10 ✅（2026-07-10）** | 驗收清單 C 全項通過:資格閘拒入/放行、受試者內解析度 protocol E2E、追蹤×場景 E2E、偵測推導 round-trip、三條決定性不變性全綠 | WP-22 | **stage3 交付達成**:追蹤能力與解析度×偵測兩實驗 pilot-ready（`test:ci` exit 0 + 清單 C 全 10 項,含 C-5 真 fullscreen 實機證據） |
| **M11 ✅**<br>(2026-07-10) | hitbox config 化零破壞(舊 drill 逐位不變)+ 命中 ⇔ on-target 同幾何斷言 + `tracking_longrange_v1` round-trip(推導誤差 ≤ 1 tick)+ 遠距 fixture 決定性綠 | WP-23 | 遠距追蹤效度地基;**WP-25 T2+ entry 前提自此可引用** |
| **M12 ✅**<br>(2026-07-14) | hitscan 逐位回歸綠(baseline 零重錄)+ projectile golden(位置序列/命中 tick)綠 + tracer 交付(單 draw call/sim 零改動)+ shot/hit 事件 schema 對帳 | WP-25 | 彈道模型門控:**M12 已過 → `bullet` 欄自此可進 drill config(WP-26 T3 解鎖)** |
| **M13 🟡**<br>(自動閘 2026-07-14) | 驗收清單 E 全項通過:BR 整合 drill E2E、三條決定性不變性(場景/ADS/彈道 gate)、ads/hit/追蹤欄匯出 round-trip、資產 attribution 可稽核;`test:ci` exit 0。**自動項 E-1~E-10 全綠 + `test:ci` exit 0(branch-guarded);清單 E §2 手動視覺/手感回填為 M13 阻塞項,待研究者實機**——回填後正式宣告 stage5 交付 | WP-26 | **stage5 交付**:BR 遠距跟槍測試(含 ADS 與彈道條件)pilot-ready |
| **M14 ✅**<br>(①⑥ 維持;②於 [KI-004](../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1 落地後重新宣告 2026-08-06;③④⑤ 已於 [A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告 2026-08-07) | ① 真實匯出 3,507 ticks / dt 7.8125ms / gap 0(維持)⑥ `uv run pytest` 74→228 passed(維持)。**②** 原六項全綠宣告(2026-08-05)因 ε(t) 量測原點錯誤(D2a/D2b,實測偏差 12.52°/67.11°)撤回;**KI-004 S1 落地後以新證據重新宣告**(閘 ① `fire.offsetDeg` oracle ≤0.5°、閘 ② 閉式幾何 ≤1e-9、parity fixture 重產綠、`test:ci` 88 files/694 tests + 19 e2e、`uv run pytest` 183 passed;詳見 [WP-28 progress.md](active/stage4/wp-28-research-foundation/progress.md)「M14 ② 重新宣告」段)。**③④⑤** 另因 KI-005(ω(t) render/sim aliasing)+ KI-006(真實樣本無 counter-strafe 構念)於 2026-08-06 撤回;**KI-005 的選項 A(A1,2026-08-06)+ A2(新採樣 → 複驗 → `seg-v2` 重掃,2026-08-07)已全數落地**——`ticks[].dYaw/dPitch` 依事件時間戳積分(四種刷新率下逐位相同,NFR-A-4)、守恆閘機器精度通過(FM-1 關閉)、`seg-v2` 重掃凍結並在真實資料驗證優於 `seg-v1`;**KI-006 的 C(construct presence gate,2026-08-06)+ B(重新採樣,[A2-T1](../known_issue/KI-005-A/A2-blocked-plan.md),2026-08-07)已全數落地**,§6 B-1~B-5 驗收清單全數滿足,**KI-006 CLOSED**。兩條理由皆已解除,**③④⑤ 已於 [A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)(2026-08-07)逐項重新宣告**。效度聲稱不擴大:仍限單一匿名受試者、n=3 session、非母體層級證據 | WP-28 | research ingest/parity 機制 + ε 地基(KI-004 原因)已修正;量測儀器層面 KI-005 A1+A2 全數落地、KI-006 CLOSED,**M14 ③④⑤ 已重新宣告,WP-30/31 entry blocker 三條理由全數解除,可展開**。效度聲稱限單一匿名 counter-strafe 樣本(n=3 session,非母體層級證據) |
| **M15 ⬜** | 驗收清單 D 全項通過：教練報告一鍵產出（FR-D16）、晉升指標 TS golden 對表綠、`test:ci` exit 0 **且** `uv run pytest` 綠、每指標附效度證據（fixture + 真實檢核 + 限制）、P2 三指標各有明確進退判定（GD-20） | WP-32 | **stage4 交付**：瞄準 × 急停教練分析管線 pilot-ready |

---

## 4. 跨階段相依圖（關鍵路徑，來自 PLAN §6）

```
階段 A（completed/stage1/）
WP-0 → WP-1 → WP-2 →┬→ WP-3 →┐
                     ├→ WP-4 →┼→ WP-5 → WP-6 → WP-7 → WP-8 → WP-9 ─── M4 ✅
                     └────────┘

階段 B（completed/stage2/；上游門檻 = M4 ✅）
WP-10 ──┬→ WP-11 ──┐
        │          ├→ WP-13(M6) ──┬→ WP-16 ──┐
WP-12 ──┴──────────┘               │          ├→ WP-17(M8)
WP-14 ─────────────────────────────┴→ WP-15(M7)┘
                                          WP-18（F5，✅ 交付 2026-07-09）
```

- WP-2（脊椎，M1）是階段 A 的門控閘：完成且決定性驗證通過前，不展開 WP-3 之後。
- WP-3 / WP-4 在 WP-2 之後可並行。
- 階段 B 可並行三線開跑：WP-10、WP-12、WP-14 互不相依；**M5 未過不進 WP-13**（先鎖數學再接線）。詳見 [`completed/stage2/README.md §5`](completed/stage2/README.md)。

```
階段 C（completed/stage3/；研究側門檻 = GD-6~10 ✅ 2026-07-06；工程側各 entry gate 把關）
WP-19（場景，M9）────────────────┐
WP-20（顯示管線）────────────────┼→ WP-22（整合，M10）= stage3 交付
WP-21（偵測；T3 需 WP-16）───────┤
WP-18（F5；stage2，M8 後）───────┘
```

- 階段 C 三線可並行：WP-19、WP-20、WP-21（T1/T2）互不相依，皆不碰 stage2 recoil 鏈熱區；建議排程點 stage2 **M6（✅ 2026-07-06 已達成）**之後——條件已成立。**M9 未過不進 WP-22**。詳見 [`completed/stage3/README.md §5`](completed/stage3/README.md)。

```
階段 E（completed/stage5/；上游門檻 = WP-18 ✅ + M10 ✅；編號分配 GD-15）
WP-23（遠距追蹤，M11）──┬─(M11)─→ WP-25 T2–T4（projectile，M12）──┐
WP-24（ADS）────────────┼───────────────────────────────────────────┼→ WP-26（BR 整合，M13）= stage5 交付
WP-25 T1（tracer）──────┴───────────────────────────────────────────┘
```

- 階段 E 三線可並行開跑：WP-23、WP-24、WP-25 T1 互不相依（hitbox 鏈 / 輸入+相機鏈 / SharedState+render 鏈,無檔案熱區重疊）;WP-26 T1（資產）可提前並行。**M11 未過不進 WP-25 T2+；M12 未過不進 WP-26 T3+**。詳見 [`completed/stage5/README.md §5`](completed/stage5/README.md)。

```
單 WP（completed/muzzle-tracer/；上游門檻 = WP-25 ✅ + WP-24 ✅ + KI-002 D1 ✅）
WP-25（tracer）─┐
WP-24（ADS）────┼→ WP-27（muzzle tracer：T0 → T1 hip → T2 ADS → T-exit）
KI-002 D1（BD-002，相機錨定 sim origin）─┘
```

- WP-27 不屬任何 stage、無獨立里程碑；**T1 未綠不開 T2**（ADS 是 hip 路徑的分支）。KI-002 D1 是硬前置：未修時偏移基準錯（camera z=144），數值全錯——該前置已於 2026-07-15 落地。WP-27 已於 2026-08-04 交付，詳見 [`completed/muzzle-tracer/README.md`](completed/muzzle-tracer/README.md)。

```
階段 D（active/stage4/；上游門檻 = M4 ✅ + WP-16 ✅ + M11/M12 ✅；編號分配 GD-19）
                     ┌─(T1 ingest 綠即可)─→ WP-29（時間軸 + Sync）──┐
WP-28（地基，M14）──┤                                              ├→ WP-32（晉升整合，M15）= stage4 交付
                     ├─(M14)─────────────→ WP-30（phase + 101pt）──┤
                     └─(M14)─────────────→ WP-31（SPARC/xcorr/Fitts）┘
```

- 階段 D 全在 `research/`（Python 離線）＋兩個對表閘，引擎零改動（例外：WP-29 T3 選配 `key` 事件、WP-32 metrics/UI）；與其他 stage 零檔案熱區重疊。**M14 原六項全綠宣告(2026-08-05)曾分兩次撤回**（② 因 KI-004、③④⑤ 因 KI-005/KI-006）；**② 已於 KI-004 S1 落地後重新宣告(2026-08-06)**，**③④⑤ 已於 [A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告(2026-08-07)**——KI-005(儀器修法 A1 + 複驗與重掃 A2)與 KI-006(構念存在性閘 C + 重新採樣 B)兩條獨立理由均已全數落地,KI-006 CLOSED。**WP-30/31 entry blocker 三條理由全數解除,可展開**；WP-31 為 M15 選項（未過 reliability gate 的指標不晉升，GD-20）。詳見 [`active/stage4/README.md §5`](active/stage4/README.md)。

---

## 5. 執行規則（每 task 一個切片）

- **一個 task = 一個垂直切片 = 一個原子 commit**。先驗證再 commit；當前 task 未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message。
- task 完成時更新該 WP 的 `progress.md`（Progress / Decision Log / Surprises / Open Questions），與切片一起 stage。
- task 完成把該 WP `task-checklist.md` 的 **Done** box 翻 ✅；WP 完成把本索引 §2 的狀態翻 ✅。
- 跨 WP entry-gate 先驗證上游 WP 的 exit-gate 已綠燈。
- PR 步驟以本 repo remote（`ziy900409/FPS_aim_analyst`）為準；CI 不可用時記錄本機紅綠燈證據。

---

## 6. 目錄慣例

```
docs/exec-plan/
├── README.md                          ← 本檔（頂層索引）
├── DECISIONS.md                       ← 全域決策 / 跨文件矛盾帳本
├── active/                            ← 進行中的 WP
│   └── stage4/                        ← 階段 D（選手表現分析管線，✅ 採納 2026-08-04；GD-19/GD-20）
│       ├── README.md                  ← stage4 頂層索引 + tech spec
│       └── wp-28-research-foundation/ ← WP-28（M14）；WP-29~32 於各自 entry 前展開
│           ├── README.md · task-checklist.md · progress.md
│           └── T0-entry-gate.md · T1..T4.md · T-exit-gate.md
├── completed/                         ← WP 交付後移入
│   ├── stage1/                        ← 階段 A（WP-0~9，✅ 交付；格式模板）
│   │   └── wp-N-*/
│   ├── stage2/                        ← 階段 B（WP-10~18，✅ 交付）
│   │   ├── README.md                  ← stage2 頂層索引 + tech spec
│   │   └── wp-N-*/                    ← 每 WP 一自足子資料夾
│   │       ├── README.md              ← WP tech spec
│   │       ├── task-checklist.md      ← master task index
│   │       ├── progress.md            ← running log
│   │       ├── T0-entry-gate.md
│   │       ├── T1..Tn.md
│   │       └── T-exit-gate.md
│   ├── stage3/                        ← 階段 C（WP-19~22，✅ 交付）
│   │   ├── README.md                  ← stage3 頂層索引 + tech spec
│   │   └── wp-N-*/
│   ├── stage5/                        ← 階段 E（WP-23~26；歸檔 2026-07-15，M13 待 #32 手動回填）
│   │   ├── README.md                  ← stage5 頂層索引 + tech spec
│   │   └── wp-N-*/
│   └── muzzle-tracer/                 ← WP-27（✅ 交付 2026-08-04；GD-18）
└── superseded/                        ← 被取代的計畫
```
