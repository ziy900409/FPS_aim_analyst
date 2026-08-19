# 文件地圖 — FPS 反向急停瞄準訓練器

> 本檔為 `docs/` 的**目錄總覽**，作為閱讀導航的單一入口。
> 文件語言：繁體中文（術語保留英文，沿用 [PLAN.md](PLAN.md) 決策 D4）。
> 想找「該做什麼、怎麼做」→ 看 [exec-plan/](exec-plan/README.md)；想找「為什麼這樣設計」→ 看[規格書](規格書_Three.js_WebGPU_反向急停瞄準訓練器.md)。

---

## 1. 閱讀順序（新進者）

| 順序 | 文件 | 用途 |
|---|---|---|
| ⓪ | [`../CLAUDE.md`](../CLAUDE.md) | 執行協議 + 導航（agent 開場即載入；repo 根） |
| ① | [`../CONTEXT.md`](../CONTEXT.md) | 專有名詞 / ubiquitous language（repo 根） |
| ② | [規格書](規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 需求、ADR-1~9、WBS、功能 F1–F5（source of truth） |
| ③ | [DESIGN.md](DESIGN.md) | 執行期與執行緒模型：三迴圈在階段 A 的單執行緒真相、兩時鐘、階段 B 跨界縫 |
| ④ | [exec-plan/README.md](exec-plan/README.md) | **大框架的現行權威**：WP-0~39（階段 A+B+C+E+D+F + 單 WP muzzle-tracer）狀態表、里程碑門控 M1–M16、跨階段相依圖、執行規則 |
| ⑤ | `exec-plan/completed/stage1/wp-N-*/`（階段 A 已交付）、`exec-plan/completed/stage2/wp-N-*/`（階段 B 已交付）、`exec-plan/completed/stage3/wp-N-*/`（階段 C 已交付；導航見 [stage3 MAP](exec-plan/completed/stage3/MAP.md)）、`exec-plan/completed/stage4/wp-N-*/`（階段 D 已交付；tech spec 見 [stage4 README](exec-plan/completed/stage4/README.md)）、`exec-plan/completed/stage5/wp-N-*/`（階段 E 已歸檔;M13 待手動回填；tech spec 見 [stage5 README](exec-plan/completed/stage5/README.md)）、**[`exec-plan/completed/muzzle-tracer/`](exec-plan/completed/muzzle-tracer/README.md)（WP-27，✅ 已交付）** | 進入要做的 WP，從該 WP 的 `README.md` 開始 |

---

## 2. 頂層文件（`docs/`）

| 文件 | 內容 | 狀態 |
|---|---|---|
| [MAP.md](MAP.md) | 本檔 — 文件地圖 / 目錄 | — |
| [規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 規格書 v1.1 + WBS（含 F5 移動目標）；ADR-1~9 為架構決策準繩 | ✅ |
| [DESIGN.md](DESIGN.md) | 執行期/執行緒模型（§1 單執行緒真相 + 後果 a；兩時鐘、跨界縫指路） | ✅ |
| [PLAN.md](PLAN.md) | 階段 A 執行計畫（歷史紀錄）。**仍被引用者僅 §1 決策 D1–D5 的理由欄**；WP/里程碑/相依/範圍各段一律以 [exec-plan/README.md](exec-plan/README.md) 為準 | 🧊 **已凍結**（停寫 2026-06，不再維護） |
| [FRONTEND.md](FRONTEND.md) | 前端 / UI 設計（預留） | ⬜ 空檔 |

---

## 3. 執行計畫（`docs/exec-plan/`）

頂層索引：[exec-plan/README.md](exec-plan/README.md) — 含里程碑門控（M1–M15）、跨階段相依圖、執行規則。stage2 tech spec 見 [exec-plan/completed/stage2/README.md](exec-plan/completed/stage2/README.md)；stage3 導航 / 大框架 / tech spec 見 [exec-plan/completed/stage3/MAP.md](exec-plan/completed/stage3/MAP.md) · [PLAN.md](exec-plan/completed/stage3/PLAN.md) · [README.md](exec-plan/completed/stage3/README.md)；stage5（階段 E，BR 遠距跟槍測試模組）tech spec 見 [exec-plan/completed/stage5/README.md](exec-plan/completed/stage5/README.md)；stage4（階段 D，選手表現分析管線）tech spec 見 [exec-plan/completed/stage4/README.md](exec-plan/completed/stage4/README.md)。

**進行中（`active/`）**：[`active/stage6/`](exec-plan/active/stage6/README.md) — 階段 F,個人瞄準能力測試框架 v1(架槍挑戰/Spider Shot/急停測試 + 診斷推薦 + 縱向追蹤)。🟡 **已採納規劃(2026-08-19,[DECISIONS.md](exec-plan/DECISIONS.md) GD-22)**:WP-33~39/M16 編號拍板;**WP-34 可見度時間線列高風險,先跑獨立 T0 讀碼 spike**;WP-33 子資料夾尚未展開。原案:[aim-assessment-framework-v1.md](exec-plan/active/stage6/aim-assessment-framework-v1.md)。

**階段 D 選手表現分析管線已於 2026-08-17 完整交付**（M15，WP-32 T-exit），移入 `completed/stage4/`（2026-08-04 採納，[DECISIONS.md](exec-plan/DECISIONS.md) **GD-19**/**GD-20**/**GD-21**；WP-28~32 / M14~M15 / [驗收清單 D](operational/acceptance-stage-d.md)）。新增 **`research/` Python 離線分析層**（Python 3.12 + uv，四目錄制學 performance_analysis），引擎零改動；`research/` ↔ `src/` **單向隔離**，parity **雙向**（既有構念 ε(t)/t_acquire 以 TS + `docs/operational/analysis-*.md` 為權威；新構念 Python 為權威）且兩向對表閘皆落在既有 `npm run test:ci`。三項新構念（`phase-v1`/`sync-v1`/`curve-v1`）已晉升進 `src/metrics/` 並擴充結果頁；WP-31 的 P2 三指標（SPARC/xcorr/Fitts）全數判定不晉升（合格交付，C-D3）。分段參數 registry、quality flags 詞彙表與一鍵 pipeline 契約見 [analysis-segments.md](operational/analysis-segments.md)。

**單 WP（不屬任何 stage）**：[`completed/muzzle-tracer/`](exec-plan/completed/muzzle-tracer/README.md) = **WP-27**，tracer 視覺起點自準心移至槍口（hip）+ ADS 時移至準心下方；render-only，命中判定/彈道物理/匯出**三不變**。✅ 已交付 2026-08-04（[DECISIONS.md](exec-plan/DECISIONS.md) **GD-18**），無獨立里程碑。Task：[T0](exec-plan/completed/muzzle-tracer/T0-entry-gate.md) · [T1 hip](exec-plan/completed/muzzle-tracer/T1-hip-muzzle-tracer.md) · [T2 ADS](exec-plan/completed/muzzle-tracer/T2-ads-muzzle.md) · [T-exit](exec-plan/completed/muzzle-tracer/T-exit-gate.md)。

### 3.1 資料夾慣例

```
docs/exec-plan/
├── README.md              ← 頂層索引（WP 狀態表 + milestones）
├── DECISIONS.md           ← 全域決策 / 跨文件矛盾帳本（global episodic）
├── active/                ← 進行中的 WP
│   └── stage6/            ← 階段 F（🟡 規劃 2026-08-19，WP-33~39/M16；GD-22）
├── completed/             ← WP 交付後移入
│   ├── stage1/            ← 階段 A 已交付（WP-0~9）
│   │   └── wp-N-*/
│   ├── stage2/            ← 階段 B 已交付（WP-10~18）
│   │   ├── README.md      ← stage2 頂層索引 + tech spec
│   │   └── wp-N-*/
│   ├── stage3/            ← 階段 C 已交付（WP-19~22）
│   │   ├── MAP.md         ← stage3 導航 · PLAN.md ← 大框架 · README.md ← tech spec
│   │   └── wp-N-*/
│   ├── stage4/            ← 階段 D 已交付（選手表現分析管線，WP-28~32，2026-08-17；GD-19/GD-20/GD-21）
│   │   ├── README.md      ← stage4 頂層索引 + tech spec
│   │   └── wp-28-research-foundation/ … wp-32-dashboard-integration/
│   ├── stage5/            ← 階段 E 已歸檔（BR 遠距跟槍測試，WP-23~26；M13 待 #32 手動回填）
│   │   ├── README.md      ← stage5 頂層索引 + tech spec
│   │   └── wp-N-*/
│   └── muzzle-tracer/     ← WP-27（✅ 已交付 2026-08-04，GD-18）
└── superseded/            ← 被取代的計畫
```

> 頂層索引：[exec-plan/README.md](exec-plan/README.md) · 全域決策帳本：[exec-plan/DECISIONS.md](exec-plan/DECISIONS.md)

每個 `wp-N-*/` 子資料夾固定內含：

| 檔案 | 角色 |
|---|---|
| `README.md` | 該 WP 的 tech spec / source of truth（需求、FR、相依、估時） |
| `task-checklist.md` | master task index，Done box |
| `progress.md` | running log（Progress / Decision Log / Surprises / Open Questions） |
| `T0-entry-gate.md` | 進入閘：驗證上游 WP exit-gate 已綠燈 |
| `T1..Tn-*.md` | 每個 task 一個自足檔（垂直切片 = 原子 commit） |
| `T-exit-gate.md` | 退出閘：本 WP 驗收 |

### 3.2 WP 索引

> 里程碑：M1 = 脊椎（WP-2）· M2 = 核心玩法（WP-5）· M3 = 可匯出資料（WP-7）· M4 = 階段 A 交付（WP-9）· M5 = recoil 核心（WP-10）· M6 = 壓槍玩法（WP-13）· M7 = 校準效度（WP-14+15）· M8 = 階段 B 交付（WP-17）· M9 = 場景脊椎（WP-19）· M10 = 階段 C 交付（WP-22）· M11 = 遠距追蹤地基（WP-23）· M12 = 彈道模型門控（WP-25）· M13 = 階段 E 交付（WP-26）· M14 = research 地基（WP-28）· M15 = 階段 D 交付（WP-32）· **M16 🟡 = 階段 F 交付（WP-39，規劃中）**。
> 詳細狀態以 [exec-plan/README.md §2](exec-plan/README.md) 為準。

#### 階段 A（`completed/stage1/`，WP-0~9 ✅ 已交付 M4 2026-07-03）

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-0** | [wp-0-environment-setup/](exec-plan/completed/stage1/wp-0-environment-setup/README.md) | 空場景 + cross-origin isolation + backend 偵測 | → M1 | — |
| **WP-1** | [wp-1-fps-pointerlock/](exec-plan/completed/stage1/wp-1-fps-pointerlock/README.md) | FPS 控制 + Pointer Lock + 原始輸入 | → M1 | WP-0 |
| **WP-2** ★脊椎 | [wp-2-dual-loop-skeleton/](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/README.md) | `SharedState` + 雙迴圈骨架 + 決定性驗證 | **M1** | WP-0,1 |
| **WP-3** | [wp-3-input-sampler/](exec-plan/completed/stage1/wp-3-input-sampler/README.md) | `InputSampler`（F1）高解析度時間戳採集 | — | WP-2 |
| **WP-4** | [wp-4-target-tvisible/](exec-plan/completed/stage1/wp-4-target-tvisible/README.md) | `TargetManager` + `t_visible`（F2）左右交替 | — | WP-1,2 |
| **WP-5** | [wp-5-hit-counterstrafe/](exec-plan/completed/stage1/wp-5-hit-counterstrafe/README.md) | `HitDetector` + 橫移 + 簡化急停（F3） | **M2** | WP-3,4 |
| **WP-6** | [wp-6-drill-system/](exec-plan/completed/stage1/wp-6-drill-system/README.md) | `DrillConfig` 資料驅動 drill（F4） | — | WP-4,5 |
| **WP-7** | [wp-7-data-recorder/](exec-plan/completed/stage1/wp-7-data-recorder/README.md) | `DataRecorder` ring buffer + JSON/CSV 匯出 | **M3** | WP-2,4,5 |
| **WP-8** | [wp-8-metrics-hud/](exec-plan/completed/stage1/wp-8-metrics-hud/README.md) | `MetricsDashboard` + 即時 HUD | — | WP-5,6,7 |
| **WP-9** | [wp-9-integration/](exec-plan/completed/stage1/wp-9-integration/README.md) | 端到端整合 + 計時效度 + 決定性回歸 | **M4** | 全部 |

#### 階段 B（`completed/stage2/`，WP-10~18 ✅ 已交付 M8 2026-07-07 · WP-18 ✅ 2026-07-09）

> stage2 頂層索引 + tech spec：[exec-plan/completed/stage2/README.md](exec-plan/completed/stage2/README.md)。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-10** | [wp-10-recoil-core/](exec-plan/completed/stage2/wp-10-recoil-core/README.md) | 後座力數學核心（彈道表 + punch 動力學 + inaccuracy）+ golden tests | **M5** | — |
| **WP-11** | [wp-11-weapon-fire/](exec-plan/completed/stage2/wp-11-weapon-fire/README.md) | `WeaponConfig` + fire down/up + cycletime 產彈 + 彈匣 | — | WP-10 |
| **WP-12** | [wp-12-input-seams/](exec-plan/completed/stage2/wp-12-input-seams/README.md) | CS2 感度換算（A4）+ 射線方向注入（A3） | — | — |
| **WP-13** | [wp-13-sim-camera-integration/](exec-plan/completed/stage2/wp-13-sim-camera-integration/README.md) | recoil 進 simStep（64Hz 子節奏）+ 相機/彈道合成 + 彈孔 | **M6** | WP-10,11,12 |
| **WP-14** | [wp-14-movement-physics/](exec-plan/completed/stage2/wp-14-movement-physics/README.md) | friction/accelerate integrator + velocity gate（~88 u/s） | — | —（介面不變，可並行） |
| **WP-15** | [wp-15-calibration/](exec-plan/completed/stage2/wp-15-calibration/README.md) | `cl_showpos` 軌跡校準 + pattern 圖逐彈比對 | **M7** | WP-13,14 |
| **WP-16** | [wp-16-metrics-export-v2/](exec-plan/completed/stage2/wp-16-metrics-export-v2/README.md) | 匯出 schema v2 + 壓槍指標（補償 vs 理想路徑） | — | WP-13 |
| **WP-17** | [wp-17-integration/](exec-plan/completed/stage2/wp-17-integration/README.md) | E2E 全鏈路 + 決定性回歸擴充 + 驗收清單 B | **M8** | WP-15,16 |
| **WP-18** ✅ | [wp-18-f5-subtick/](exec-plan/completed/stage2/wp-18-f5-subtick/README.md) | F5 移動 drill + 目標 sub-tick 命中內插 + 追蹤指標 | — | ~~OQ-S2-5~~ ✅（GD-7）+ WP-17 |

#### 階段 C（`completed/stage3/`，WP-19~22 ⬜ 已規劃 2026-07-06）

> stage3 導航：[MAP.md](exec-plan/completed/stage3/MAP.md) · 大框架：[PLAN.md](exec-plan/completed/stage3/PLAN.md) · tech spec：[README.md](exec-plan/completed/stage3/README.md) · 研究決議：[DECISIONS.md](exec-plan/DECISIONS.md) GD-6~10（2026-07-06 grill）。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-19** | [wp-19-scene-system/](exec-plan/completed/stage3/wp-19-scene-system/README.md) | 場景系統：SceneConfig + GLTF 管線 + 淨空驗證 + 雜亂度階層場景 ×2 | **M9** | M4（可與 stage2 尾段並行） |
| **WP-20** | [wp-20-display-pipeline/](exec-plan/completed/stage3/wp-20-display-pipeline/README.md) | 解析度模式 + fullscreen/資格閘 + frame-time log + session setup | — | M4（可並行） |
| **WP-21** | [wp-21-detection-drill/](exec-plan/completed/stage3/wp-21-detection-drill/README.md) | seeded spawn + pop-in 偵測 drill + t_detect 離線推導 spec | — | T1/T2 獨立；T3 需 WP-16 |
| **WP-22** | [wp-22-perception-integration/](exec-plan/completed/stage3/wp-22-perception-integration/README.md) | 追蹤×場景 + 解析度 protocol E2E + 決定性回歸 + 驗收清單 C | **M10** | WP-19,20,21 + WP-18 |

#### 階段 E（`completed/stage5/`，🟡 已歸檔 2026-07-15：WP-23 ✅ M11 · WP-24 ✅ · WP-25 ✅ M12 · **WP-26 T-exit 自動閘 ✅（`test:ci` exit 0）/ M13 待研究者實機手動回填（#32）正式宣告**）

> stage5 tech spec：[README.md](exec-plan/completed/stage5/README.md) · 編號分配：[DECISIONS.md](exec-plan/DECISIONS.md) GD-15（stage4 為未採納草稿，採納時重編 WP-27+）。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-23** | [wp-23-longrange-tracking/](exec-plan/completed/stage5/wp-23-longrange-tracking/README.md) | 遠距小目標追蹤：hitbox config 化 + 遠距 drill + 指標 round-trip/決定性 | **M11** | WP-18 + M10 |
| **WP-24** | [wp-24-ads-optics/](exec-plan/completed/stage5/wp-24-ads-optics/README.md) | ADS 開鏡：EV_ADS 輸入鏈 + WeaponConfig.ads + zoom/感度 + scope overlay + 記錄 | — | M8（可並行） |
| **WP-25** | [wp-25-ballistics-tracer/](exec-plan/completed/stage5/wp-25-ballistics-tracer/README.md) | 彈道：tracer 顯示（T1 獨立）+ config-gated projectile | **M12** | T1 獨立；T2+ 需 M11 |
| **WP-26** | [wp-26-br-scene-integration/](exec-plan/completed/stage5/wp-26-br-scene-integration/README.md) | BR 場景實作與整合：br-field + tracking_br_v1 + protocol + E2E + 驗收清單 E | **M13** | WP-23,24,25 |

#### 階段 D（`completed/stage4/`，✅ 2026-08-04 採納 → 2026-08-17 交付：WP-28~32 / M14~M15 / 驗收清單 D）

> stage4 tech spec：[README.md](exec-plan/completed/stage4/README.md) · 決議：[DECISIONS.md](exec-plan/DECISIONS.md) **GD-19**（編號 + research 邊界 + parity 雙向）/ **GD-20**（教練報告紅線）/ **GD-21**（雙實作對表紀律）。
> 交付物在 **`research/`**（Python 離線分析層，四目錄制）+ 兩個對表閘；引擎零改動（例外：WP-29 T3 選配 `key` 事件、WP-32 metrics/UI）。三項新構念（`phase-v1`/`sync-v1`/`curve-v1`）已晉升進 `src/metrics/`；驗收清單 D 見 [acceptance-stage-d.md](operational/acceptance-stage-d.md)。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-28** | [wp-28-research-foundation/](exec-plan/completed/stage4/wp-28-research-foundation/README.md) | research 地基：ingest + ω(t)/ε(t)（含 **ε 雙向 parity**）+ submovement 分段 + quality flags | **M14 ✅** | M4 + WP-16 + M11/M12 |
| **WP-29** | [wp-29-coach-timeline/](exec-plan/completed/stage4/wp-29-coach-timeline/README.md) | 逐 peek 時間軸（交叉驗證 `compute.ts`）+ Release-to-Click Sync 族 | — | WP-28 T1 |
| **WP-30** | [wp-30-trajectory-metrics/](exec-plan/completed/stage4/wp-30-trajectory-metrics/README.md) | REC/MR/V phase 分解 + L/R 101 點正規化曲線 | — | **M14 ✅** |
| **WP-31** | [wp-31-advanced-diagnostics/](exec-plan/completed/stage4/wp-31-advanced-diagnostics/README.md) | SPARC + Key-Velocity xcorr（reliability gate）+ Fitts | — | **M14 ✅** |
| **WP-32** | [wp-32-dashboard-integration/](exec-plan/completed/stage4/wp-32-dashboard-integration/README.md) | golden parity → TS metrics + 結果頁擴充 + 驗收清單 D | **M15 ✅** | WP-29 ✅ + WP-30 ✅ + WP-31 ✅ |

#### 階段 F（`active/stage6/`，🟡 規劃 2026-08-19：WP-33~39/M16；[DECISIONS.md](exec-plan/DECISIONS.md) GD-22）

> stage6 tech spec：[README.md](exec-plan/active/stage6/README.md) · 需求草稿：[aim-assessment-framework-v1.md](exec-plan/active/stage6/aim-assessment-framework-v1.md)。子資料夾尚未展開；**WP-34 先跑獨立 T0 讀碼 spike** 判定可見度時間線工程量。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-33** | `wp-33-assessment-contract/`（⬜） | 共同 Assessment/Practice 契約 + metadata + 事件時間線 + 品質旗標 | — | M4 + WP-20 |
| **WP-34** | `wp-34-hold-click-visibility/`（⬜） | 架槍 `hold-click-v1` + 遮蔽物可見度時間線（T0 = 讀碼 spike） | — | WP-33（spike 可提前） |
| **WP-35** | `wp-35-hold-track/`（⬜） | 架槍 `hold-track-v1`：移動期間鎖 fire + 追蹤窗指標 | — | WP-34 |
| **WP-36** | `wp-36-spider-shot/`（⬜） | Spider Shot `spider-shot-v1`：單目標約束 + 中心—周邊排程 | — | WP-33 |
| **WP-37** | `wp-37-counterstrafe-protocols/`（⬜） | 急停三協定包裝（cued/reversal/free）+ 對稱指標 | — | WP-33 |
| **WP-38** | `wp-38-diagnosis-recommendation/`（⬜） | 診斷規則引擎 + 版本化推薦 + session history | — | WP-34,35,36,37 |
| **WP-39** | `wp-39-calibration-freeze/`（⬜） | Calibration pilot + `protocolVersion=1.0.0` 凍結 + 驗收清單 F | **M16** | 全部 |

### 3.3 各 WP task 一覽

**階段 A（`completed/stage1/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-0 | [T1 scaffold](exec-plan/completed/stage1/wp-0-environment-setup/T1-scaffold.md) · [T2 COOP/COEP](exec-plan/completed/stage1/wp-0-environment-setup/T2-coop-coep-isolation.md) · [T3 WebGPU backend 偵測](exec-plan/completed/stage1/wp-0-environment-setup/T3-webgpu-backend-detection.md) · [T4 deploy headers](exec-plan/completed/stage1/wp-0-environment-setup/T4-deploy-headers.md) · [T5 reference notes](exec-plan/completed/stage1/wp-0-environment-setup/T5-reference-notes.md) · [T6 exit-gate](exec-plan/completed/stage1/wp-0-environment-setup/T6-exit-gate.md) |
| WP-1 | [T1 scene](exec-plan/completed/stage1/wp-1-fps-pointerlock/T1-scene.md) · [T2 pointerlock](exec-plan/completed/stage1/wp-1-fps-pointerlock/T2-pointerlock.md) · [T3 raw-input fallback](exec-plan/completed/stage1/wp-1-fps-pointerlock/T3-raw-input-fallback.md) · [T4 yaw/pitch](exec-plan/completed/stage1/wp-1-fps-pointerlock/T4-yaw-pitch.md) · [T5 settings panel](exec-plan/completed/stage1/wp-1-fps-pointerlock/T5-settings-panel.md) · [T6 exit-gate](exec-plan/completed/stage1/wp-1-fps-pointerlock/T6-exit-gate.md) |
| WP-2 | [T1 shared-state](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/T1-shared-state.md) · [T2 sim-loop](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/T2-sim-loop.md) · [T3 render interpolation](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/T3-render-interpolation.md) · [T4 determinism](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/T4-determinism.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-2-dual-loop-skeleton/T5-exit-gate.md) |
| WP-3 | [T1 keyboard](exec-plan/completed/stage1/wp-3-input-sampler/T1-keyboard.md) · [T2 mouse coalesced](exec-plan/completed/stage1/wp-3-input-sampler/T2-mouse-coalesced.md) · [T3 fire](exec-plan/completed/stage1/wp-3-input-sampler/T3-fire.md) · [T4 sim-consume](exec-plan/completed/stage1/wp-3-input-sampler/T4-sim-consume.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-3-input-sampler/T5-exit-gate.md) |
| WP-4 | [T1 target-entity](exec-plan/completed/stage1/wp-4-target-tvisible/T1-target-entity.md) · [T2 visibility t_visible](exec-plan/completed/stage1/wp-4-target-tvisible/T2-visibility-tvisible.md) · [T3 alternation](exec-plan/completed/stage1/wp-4-target-tvisible/T3-alternation.md) · [T4 crosshair](exec-plan/completed/stage1/wp-4-target-tvisible/T4-crosshair.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-4-target-tvisible/T5-exit-gate.md) |
| WP-5 | [T1 hit-detector](exec-plan/completed/stage1/wp-5-hit-counterstrafe/T1-hit-detector.md) · [T2 first-shot](exec-plan/completed/stage1/wp-5-hit-counterstrafe/T2-first-shot.md) · [T3 strafe movement](exec-plan/completed/stage1/wp-5-hit-counterstrafe/T3-strafe-movement.md) · [T4 simplified counter-strafe](exec-plan/completed/stage1/wp-5-hit-counterstrafe/T4-simplified-counterstrafe.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-5-hit-counterstrafe/T5-exit-gate.md) |
| WP-6 | [T1 drill-config](exec-plan/completed/stage1/wp-6-drill-system/T1-drill-config.md) · [T2 drill-loader](exec-plan/completed/stage1/wp-6-drill-system/T2-drill-loader.md) · [T3 counter-strafe drill](exec-plan/completed/stage1/wp-6-drill-system/T3-counterstrafe-drill.md) · [T4 lifecycle](exec-plan/completed/stage1/wp-6-drill-system/T4-lifecycle.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-6-drill-system/T5-exit-gate.md) |
| WP-7 | [T1 ring-buffer](exec-plan/completed/stage1/wp-7-data-recorder/T1-ring-buffer.md) · [T2 event recording](exec-plan/completed/stage1/wp-7-data-recorder/T2-event-recording.md) · [T3 metadata](exec-plan/completed/stage1/wp-7-data-recorder/T3-metadata.md) · [T4 export](exec-plan/completed/stage1/wp-7-data-recorder/T4-export.md) · [T5 schema doc](exec-plan/completed/stage1/wp-7-data-recorder/T5-schema-doc.md) · [T6 exit-gate](exec-plan/completed/stage1/wp-7-data-recorder/T6-exit-gate.md) |
| WP-8 | [T1 compute-metrics](exec-plan/completed/stage1/wp-8-metrics-hud/T1-compute-metrics.md) · [T2 result-screen](exec-plan/completed/stage1/wp-8-metrics-hud/T2-result-screen.md) · [T3 hud](exec-plan/completed/stage1/wp-8-metrics-hud/T3-hud.md) · [T4 controls](exec-plan/completed/stage1/wp-8-metrics-hud/T4-controls.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-8-metrics-hud/T5-exit-gate.md) |
| WP-9 | [T1 e2e integration](exec-plan/completed/stage1/wp-9-integration/T1-e2e-integration.md) · [T2 timing validity](exec-plan/completed/stage1/wp-9-integration/T2-timing-validity.md) · [T3 determinism regression](exec-plan/completed/stage1/wp-9-integration/T3-determinism-regression.md) · [T4 buffer acceptance](exec-plan/completed/stage1/wp-9-integration/T4-buffer-acceptance.md) · [T5 exit-gate](exec-plan/completed/stage1/wp-9-integration/T5-exit-gate.md) |

**階段 B（`completed/stage2/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-10 | [T1 ran1/彈道表](exec-plan/completed/stage2/wp-10-recoil-core/T1-ran1-recoil-table.md) · [T2 punch 動力學](exec-plan/completed/stage2/wp-10-recoil-core/T2-punch-dynamics.md) · [T3 spread/inaccuracy](exec-plan/completed/stage2/wp-10-recoil-core/T3-spread-inaccuracy.md) · [T4 pattern viewer](exec-plan/completed/stage2/wp-10-recoil-core/T4-pattern-viewer.md) · [T-exit](exec-plan/completed/stage2/wp-10-recoil-core/T-exit-gate.md) |
| WP-11 | [T1 WeaponConfig](exec-plan/completed/stage2/wp-11-weapon-fire/T1-weapon-config.md) · [T2 fire down/up](exec-plan/completed/stage2/wp-11-weapon-fire/T2-fire-down-up.md) · [T3 cycletime 排程](exec-plan/completed/stage2/wp-11-weapon-fire/T3-cycletime-scheduler.md) · [T-exit](exec-plan/completed/stage2/wp-11-weapon-fire/T-exit-gate.md) |
| WP-12 | [T1 CS2 感度](exec-plan/completed/stage2/wp-12-input-seams/T1-cs2-sensitivity.md) · [T2 射線注入](exec-plan/completed/stage2/wp-12-input-seams/T2-ray-injection.md) · [T-exit](exec-plan/completed/stage2/wp-12-input-seams/T-exit-gate.md) |
| WP-13 | [T1 simStep 佈線](exec-plan/completed/stage2/wp-13-sim-camera-integration/T1-simstep-recoil-wiring.md) · [T2 相機/彈道合成](exec-plan/completed/stage2/wp-13-sim-camera-integration/T2-camera-ballistic-compose.md) · [T3 彈孔 + debug](exec-plan/completed/stage2/wp-13-sim-camera-integration/T3-bullet-holes-debug.md) · [T-exit](exec-plan/completed/stage2/wp-13-sim-camera-integration/T-exit-gate.md) |
| WP-14 | [T1 friction integrator](exec-plan/completed/stage2/wp-14-movement-physics/T1-friction-integrator.md) · [T2 velocity gate](exec-plan/completed/stage2/wp-14-movement-physics/T2-velocity-gate.md) · [T3 指標連續化](exec-plan/completed/stage2/wp-14-movement-physics/T3-metrics-continuous.md) · [T-exit](exec-plan/completed/stage2/wp-14-movement-physics/T-exit-gate.md) |
| WP-15 | [T1 cl_showpos 校準](exec-plan/completed/stage2/wp-15-calibration/T1-clshowpos-calibration.md) · [T2 pattern 比對](exec-plan/completed/stage2/wp-15-calibration/T2-pattern-comparison.md) · [T-exit](exec-plan/completed/stage2/wp-15-calibration/T-exit-gate.md) |
| WP-16 | [T1 schema v2](exec-plan/completed/stage2/wp-16-metrics-export-v2/T1-schema-v2.md) · [T2 理想路徑指標](exec-plan/completed/stage2/wp-16-metrics-export-v2/T2-ideal-path-metric.md) · [T3 結果頁對照](exec-plan/completed/stage2/wp-16-metrics-export-v2/T3-result-overlay.md) · [T-exit](exec-plan/completed/stage2/wp-16-metrics-export-v2/T-exit-gate.md) |
| WP-17 | [T1 決定性回歸](exec-plan/completed/stage2/wp-17-integration/T1-determinism-regression.md) · [T2 全鏈路 E2E](exec-plan/completed/stage2/wp-17-integration/T2-e2e-full-chain.md) · [T-exit](exec-plan/completed/stage2/wp-17-integration/T-exit-gate.md) |
| WP-18 ✅ | [T1 motion 驅動](exec-plan/completed/stage2/wp-18-f5-subtick/T1-motion-drive.md) · [T2 sub-tick 命中內插](exec-plan/completed/stage2/wp-18-f5-subtick/T2-subtick-hit-interpolation.md) · [T3 timed presentation](exec-plan/completed/stage2/wp-18-f5-subtick/T3-timed-presentation-render-interp.md) · [T4 追蹤 drill + 指標 spec](exec-plan/completed/stage2/wp-18-f5-subtick/T4-tracking-drill-metrics-spec.md) · [T5 決定性回歸](exec-plan/completed/stage2/wp-18-f5-subtick/T5-determinism-regression-integration.md) · [T-exit](exec-plan/completed/stage2/wp-18-f5-subtick/T-exit-gate.md) |

**階段 C（`completed/stage3/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-19 | [T1 SceneConfig](exec-plan/completed/stage3/wp-19-scene-system/T1-scene-config.md) · [T2 GLTF + field-low](exec-plan/completed/stage3/wp-19-scene-system/T2-gltf-pipeline.md) · [T3 淨空驗證器](exec-plan/completed/stage3/wp-19-scene-system/T3-clearance-validator.md) · [T4 場景切換 + meta](exec-plan/completed/stage3/wp-19-scene-system/T4-scene-switch-metadata.md) · [T5 urban-high + perf](exec-plan/completed/stage3/wp-19-scene-system/T5-second-scene-perf.md) · [T-exit](exec-plan/completed/stage3/wp-19-scene-system/T-exit-gate.md) |
| WP-20 | [T1 解析度模式](exec-plan/completed/stage3/wp-20-display-pipeline/T1-resolution-modes.md) · [T2 fullscreen + 資格閘](exec-plan/completed/stage3/wp-20-display-pipeline/T2-fullscreen-eligibility-gate.md) · [T3 frame-time log](exec-plan/completed/stage3/wp-20-display-pipeline/T3-frame-time-log.md) · [T4 session setup](exec-plan/completed/stage3/wp-20-display-pipeline/T4-session-setup-form.md) · [T-exit](exec-plan/completed/stage3/wp-20-display-pipeline/T-exit-gate.md) |
| WP-21 | [T1 seeded spawn](exec-plan/completed/stage3/wp-21-detection-drill/T1-seeded-spawn.md) · [T2 偵測 drill config](exec-plan/completed/stage3/wp-21-detection-drill/T2-detection-drill-config.md) · [T3 推導 spec + fixture](exec-plan/completed/stage3/wp-21-detection-drill/T3-offline-derivation-spec.md) · [T-exit](exec-plan/completed/stage3/wp-21-detection-drill/T-exit-gate.md) |
| WP-22 | [T1 追蹤 × 場景](exec-plan/completed/stage3/wp-22-perception-integration/T1-tracking-in-scene.md) · [T2 protocol E2E](exec-plan/completed/stage3/wp-22-perception-integration/T2-resolution-protocol-e2e.md) · [T3 決定性 + 清單 C](exec-plan/completed/stage3/wp-22-perception-integration/T3-determinism-acceptance-c.md) · [T-exit](exec-plan/completed/stage3/wp-22-perception-integration/T-exit-gate.md) |

**階段 E（`completed/stage5/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-23 | [T1 hitbox config 化](exec-plan/completed/stage5/wp-23-longrange-tracking/T1-hitbox-config.md) · [T2 遠距 drill](exec-plan/completed/stage5/wp-23-longrange-tracking/T2-longrange-drill.md) · [T3 round-trip + 決定性](exec-plan/completed/stage5/wp-23-longrange-tracking/T3-metrics-roundtrip.md) · [T-exit](exec-plan/completed/stage5/wp-23-longrange-tracking/T-exit-gate.md) |
| WP-24 | [T1 EV_ADS 輸入鏈](exec-plan/completed/stage5/wp-24-ads-optics/T1-ads-input-event.md) · [T2 WeaponConfig.ads + zoom](exec-plan/completed/stage5/wp-24-ads-optics/T2-weapon-camera-zoom.md) · [T3 overlay + 記錄](exec-plan/completed/stage5/wp-24-ads-optics/T3-overlay-recording.md) · [T-exit](exec-plan/completed/stage5/wp-24-ads-optics/T-exit-gate.md) |
| WP-25 | [T0 entry gate](exec-plan/completed/stage5/wp-25-ballistics-tracer/T0-entry-gate.md) ✅ · [T1 tracer](exec-plan/completed/stage5/wp-25-ballistics-tracer/T1-tracer-view.md) · [T2 projectile 數學核心](exec-plan/completed/stage5/wp-25-ballistics-tracer/T2-projectile-math-core.md) · [T3 sim 整合](exec-plan/completed/stage5/wp-25-ballistics-tracer/T3-sim-integration.md) · [T4 指標語意](exec-plan/completed/stage5/wp-25-ballistics-tracer/T4-metrics-semantics.md) · [T-exit](exec-plan/completed/stage5/wp-25-ballistics-tracer/T-exit-gate.md) |
| WP-26 | [T1 br-field 資產](exec-plan/completed/stage5/wp-26-br-scene-integration/T1-br-scene-assets.md) · [T2 場景上線](exec-plan/completed/stage5/wp-26-br-scene-integration/T2-br-scene-online.md) · [T3 整合 drill + protocol](exec-plan/completed/stage5/wp-26-br-scene-integration/T3-br-tracking-drill.md) · [T4 E2E + 清單 E](exec-plan/completed/stage5/wp-26-br-scene-integration/T4-e2e-acceptance.md) · [T-exit](exec-plan/completed/stage5/wp-26-br-scene-integration/T-exit-gate.md) |

**階段 D（`completed/stage4/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-28 | [T0 entry gate](exec-plan/completed/stage4/wp-28-research-foundation/T0-entry-gate.md) · [T1 scaffold + ingest](exec-plan/completed/stage4/wp-28-research-foundation/T1-scaffold-ingest.md) · [T2 角運動學 + ε parity](exec-plan/completed/stage4/wp-28-research-foundation/T2-angular-kinematics.md) · [T3 SG + submovement 分段](exec-plan/completed/stage4/wp-28-research-foundation/T3-submovement-segments.md) · [T4 per_segment_apply + flags](exec-plan/completed/stage4/wp-28-research-foundation/T4-per-segment-flags.md) · [T-exit（M14）](exec-plan/completed/stage4/wp-28-research-foundation/T-exit-gate.md) |
| WP-29 | [T0](exec-plan/completed/stage4/wp-29-coach-timeline/T0-entry-gate.md) · [T1 逐 peek 時間軸](exec-plan/completed/stage4/wp-29-coach-timeline/T1-peek-timeline.md) · [T2 Sync 精度](exec-plan/completed/stage4/wp-29-coach-timeline/T2-sync-precision.md) · [T3 key 事件](exec-plan/completed/stage4/wp-29-coach-timeline/T3-key-events.md) · [T-exit](exec-plan/completed/stage4/wp-29-coach-timeline/T-exit-gate.md) |
| WP-30 | [T0](exec-plan/completed/stage4/wp-30-trajectory-metrics/T0-entry-gate.md) · [T1 t_detect parity](exec-plan/completed/stage4/wp-30-trajectory-metrics/T1-detect-parity.md) · [T2 phase 分解](exec-plan/completed/stage4/wp-30-trajectory-metrics/T2-phase-decompose.md) · [T3 L/R 曲線](exec-plan/completed/stage4/wp-30-trajectory-metrics/T3-lr-curves.md) · [T-exit](exec-plan/completed/stage4/wp-30-trajectory-metrics/T-exit-gate.md) |
| WP-31 | [T0](exec-plan/completed/stage4/wp-31-advanced-diagnostics/T0-entry-gate.md) · [T1 SPARC](exec-plan/completed/stage4/wp-31-advanced-diagnostics/T1-sparc.md) · [T2 Key-Velocity xcorr](exec-plan/completed/stage4/wp-31-advanced-diagnostics/T2-key-velocity-xcorr.md) · [T3 Fitts](exec-plan/completed/stage4/wp-31-advanced-diagnostics/T3-fitts.md) · [T-exit](exec-plan/completed/stage4/wp-31-advanced-diagnostics/T-exit-gate.md) |
| WP-32 | [T0](exec-plan/completed/stage4/wp-32-dashboard-integration/T0-entry-gate.md) · [T1 ω+SG](exec-plan/completed/stage4/wp-32-dashboard-integration/T1-ts-kinematics-sg.md) · [T2 seg-v2](exec-plan/completed/stage4/wp-32-dashboard-integration/T2-ts-segmentation.md) · [T3 phase+sync](exec-plan/completed/stage4/wp-32-dashboard-integration/T3-phase-sync-promotion.md) · [T4 curve](exec-plan/completed/stage4/wp-32-dashboard-integration/T4-curve-promotion.md) · [T5 結果頁](exec-plan/completed/stage4/wp-32-dashboard-integration/T5-result-screen.md) · [T-exit（M15）](exec-plan/completed/stage4/wp-32-dashboard-integration/T-exit-gate.md) |

> 每個 WP 另含 `T0-entry-gate.md`、`task-checklist.md`、`progress.md`（見 §3.1 慣例），此處省略以保持精簡。

---

## 4. 研究筆記（`docs/research/`）

> 外部工具 / 文獻的評估與比較，供架構決策與效度論證引用；非 source of truth。

| 文件 | 內容 |
|---|---|
| [research/FPSci_評估與建議.md](research/FPSci_評估與建議.md) | NVlabs FPSci（SIGGRAPH 2022）與本專案逐軸比較；建議 R1–R7（schema 對映 → WP-16、click-to-photon 校準 → WP-20、CC BY-NC-SA 授權紅線） |

---

## 5. 已知問題與修 bug 決策（`docs/known_issue/`）

> 執行期發現的 bug 的診斷、修改計畫與修復決策。與 exec-plan 分工：exec-plan 記「該做什麼功能」，known_issue 記「發現了什麼 bug、怎麼修、修的決策」。

| 文件 | 內容 |
|---|---|
| [known_issue/BUGFIX-DECISIONS.md](known_issue/BUGFIX-DECISIONS.md) | 修 bug 決策帳本（`BD-n` 對應 `KI-NNN`）+ Known Issues 索引；除錯 episodic memory 的入口 |
| `known_issue/KI-NNN-*.md` | 每個 bug 一支 tech spec（症狀/根因/修改計畫/風險/任務拆解）；source of truth |
| [known_issue/KI-001-input-lag-sim-clock-drift.md](known_issue/KI-001-input-lag-sim-clock-drift.md) | KI-001：開火/鍵盤嚴重輸入延遲（sim 邏輯時鐘漂移）— 已修（re-anchor，BD-001） |
| [known_issue/KI-004-sim-world-unit-domain-mismatch.md](known_issue/KI-004-sim-world-unit-domain-mismatch.md) | KI-004：sim(source unit)/world domain 混用 — corridor gate 緊 100×（真實急停 run 全被標 `suspect`）+ 離線 ε(t) 原點錯尺度。**✅ S1 已落地(2026-08-06);S2(逐 tick eye pose)/S3 待辦。M14 ② 已於 S1 落地後重新宣告** |
| [known_issue/KI-005-omega-render-sim-aliasing.md](known_issue/KI-005-omega-render-sim-aliasing.md) | KI-005：ω(t) 受 render(~240Hz)/sim(128Hz) **zero-order-hold aliasing** 汙染 — 每 8 tick 一個假凹口，`merged_adjacent_peaks` 15/19、有效產率 4/19。**✅ A1+A2(T1–T4)全數完成(2026-08-07);M14 ③④⑤ 已重新宣告,WP-30/31 entry blocker 已解除**。碰 `ticks[].aim` 逐 tick 差分(ω/角加速度/jerk)或 `seg-*` 參數前必讀。舊兩份匯出(08:03/09:39)的 ω(t) 一律不可用(不做回溯清洗,走 `aim-diff-legacy`+`seg-v1`);新匯出(tick-integral)走 `seg-v2` |
| [known_issue/KI-006-m14-sample-no-counterstrafe.md](known_issue/KI-006-m14-sample-no-counterstrafe.md) | KI-006：M14 ④/⑤ 效度閘所用樣本（08:03）**不含 counter-strafe 構念** — `vx ≡ 0`、`keys` 全空、`counter` 事件 0。**✅ CLOSED(2026-08-07)**:C(construct presence gate,[KI-006-C/](known_issue/KI-006-C/README.md))+ B(重新採樣,[A2-T1](known_issue/KI-005-A/A2-blocked-plan.md))全數落地,§6 B-1~B-5 驗收清單全數滿足,M14 ④⑤ 已重新宣告 |
| [known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md](known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) | KI-007：單一「實驗 session」drill 流程從未呼叫 `experimentSession.exit()` — drill 結束後正常退出全螢幕（去抓匯出檔）會被誤判為條件失效，`meta.suspect` 誤標 `true`。**✅ 已修（2026-08-07，F-1：`handleFullscreenChange` 新增 `recording` 參數，只在 drill 錄製中才判定失效）**。發現於 [A2-T1](known_issue/KI-005-A/A2-blocked-plan.md) 新採樣驗證 |

---

## 6. 維護約定

- 新增 / 移除 `docs/` 下的資料夾或頂層文件時，**同步更新本檔**。
- WP 交付移入 `completed/` 時，更新 §3.2 路徑與 [exec-plan/README.md](exec-plan/README.md) 狀態。
- 新增 known issue（`KI-NNN-*.md`）或其修復決策時，更新 §5 表格與 [known_issue/BUGFIX-DECISIONS.md](known_issue/BUGFIX-DECISIONS.md) §1 索引。
- 本檔只列**結構與導航**；各文件的內容變更不需回寫本檔。
