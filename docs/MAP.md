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
| ③ | [PLAN.md](PLAN.md) | 大框架執行計畫：補充決策 D1–D5、技術棧、架構總覽、WP-0~9 |
| ④ | [exec-plan/README.md](exec-plan/README.md) | 執行計畫頂層索引：把 WP-0~18（階段 A+B）展開成可執行子資料夾 |
| ⑤ | `exec-plan/completed/stage1/wp-N-*/`（階段 A 已交付）、`exec-plan/active/stage2/wp-N-*/`（階段 B 進行中）、`exec-plan/active/stage3/wp-N-*/`（階段 C 已規劃；導航見 [stage3 MAP](exec-plan/active/stage3/MAP.md)） | 進入要做的 WP，從該 WP 的 `README.md` 開始 |

---

## 2. 頂層文件（`docs/`）

| 文件 | 內容 | 狀態 |
|---|---|---|
| [MAP.md](MAP.md) | 本檔 — 文件地圖 / 目錄 | — |
| [規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 規格書 v1.1 + WBS（含 F5 移動目標）；ADR-1~9 為架構決策準繩 | ✅ |
| [PLAN.md](PLAN.md) | 階段 A 執行計畫；決策 D1–D5、技術棧、雙迴圈架構、相依圖 | ✅ |
| [DESIGN.md](DESIGN.md) | 執行期/執行緒模型（§1 單執行緒真相 + 後果 a；兩時鐘、跨界縫指路） | ✅ |
| [FRONTEND.md](FRONTEND.md) | 前端 / UI 設計（預留） | ⬜ 空檔 |

---

## 3. 執行計畫（`docs/exec-plan/`）

頂層索引：[exec-plan/README.md](exec-plan/README.md) — 含里程碑門控（M1–M10）、跨階段相依圖、執行規則。stage2 tech spec 見 [exec-plan/active/stage2/README.md](exec-plan/active/stage2/README.md)；stage3 導航 / 大框架 / tech spec 見 [exec-plan/active/stage3/MAP.md](exec-plan/active/stage3/MAP.md) · [PLAN.md](exec-plan/active/stage3/PLAN.md) · [README.md](exec-plan/active/stage3/README.md)。

### 3.1 資料夾慣例

```
docs/exec-plan/
├── README.md              ← 頂層索引（WP 狀態表 + milestones）
├── DECISIONS.md           ← 全域決策 / 跨文件矛盾帳本（global episodic）
├── active/                ← 進行中的 WP
│   ├── stage2/            ← 階段 B（CS2 後座力系統 + 真急停）
│   │   ├── README.md      ← stage2 頂層索引 + tech spec
│   │   └── wp-N-*/        ← 每個 WP 一個自足子資料夾（WP-10~18）
│   └── stage3/            ← 階段 C（研究場景與感知實驗，WP-19~22）
│       ├── MAP.md         ← stage3 導航 · PLAN.md ← 大框架 · README.md ← tech spec
│       └── wp-N-*/
├── completed/             ← WP 交付後移入
│   └── stage1/            ← 階段 A 已交付（WP-0~9）
│       └── wp-N-*/
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

> 里程碑：M1 = 脊椎（WP-2）· M2 = 核心玩法（WP-5）· M3 = 可匯出資料（WP-7）· M4 = 階段 A 交付（WP-9）· M5 = recoil 核心（WP-10）· M6 = 壓槍玩法（WP-13）· M7 = 校準效度（WP-14+15）· M8 = 階段 B 交付（WP-17）· M9 = 場景脊椎（WP-19）· M10 = 階段 C 交付（WP-22）。
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

#### 階段 B（`active/stage2/`，WP-10~18 🟡 進行中）

> stage2 頂層索引 + tech spec：[exec-plan/active/stage2/README.md](exec-plan/active/stage2/README.md)。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-10** | [wp-10-recoil-core/](exec-plan/active/stage2/wp-10-recoil-core/README.md) | 後座力數學核心（彈道表 + punch 動力學 + inaccuracy）+ golden tests | **M5** | — |
| **WP-11** | [wp-11-weapon-fire/](exec-plan/active/stage2/wp-11-weapon-fire/README.md) | `WeaponConfig` + fire down/up + cycletime 產彈 + 彈匣 | — | WP-10 |
| **WP-12** | [wp-12-input-seams/](exec-plan/active/stage2/wp-12-input-seams/README.md) | CS2 感度換算（A4）+ 射線方向注入（A3） | — | — |
| **WP-13** | [wp-13-sim-camera-integration/](exec-plan/active/stage2/wp-13-sim-camera-integration/README.md) | recoil 進 simStep（64Hz 子節奏）+ 相機/彈道合成 + 彈孔 | **M6** | WP-10,11,12 |
| **WP-14** | [wp-14-movement-physics/](exec-plan/active/stage2/wp-14-movement-physics/README.md) | friction/accelerate integrator + velocity gate（~88 u/s） | — | —（介面不變，可並行） |
| **WP-15** | [wp-15-calibration/](exec-plan/active/stage2/wp-15-calibration/README.md) | `cl_showpos` 軌跡校準 + pattern 圖逐彈比對 | **M7** | WP-13,14 |
| **WP-16** | [wp-16-metrics-export-v2/](exec-plan/active/stage2/wp-16-metrics-export-v2/README.md) | 匯出 schema v2 + 壓槍指標（補償 vs 理想路徑） | — | WP-13 |
| **WP-17** | [wp-17-integration/](exec-plan/active/stage2/wp-17-integration/README.md) | E2E 全鏈路 + 決定性回歸擴充 + 驗收清單 B | **M8** | WP-15,16 |
| **WP-18** ⏸待 M8 | [wp-18-f5-subtick/](exec-plan/active/stage2/wp-18-f5-subtick/README.md) | F5 移動 drill + 目標 sub-tick 命中內插 + 追蹤指標 | — | ~~OQ-S2-5~~ ✅（GD-7）+ WP-17 |

#### 階段 C（`active/stage3/`，WP-19~22 ⬜ 已規劃 2026-07-06）

> stage3 導航：[MAP.md](exec-plan/active/stage3/MAP.md) · 大框架：[PLAN.md](exec-plan/active/stage3/PLAN.md) · tech spec：[README.md](exec-plan/active/stage3/README.md) · 研究決議：[DECISIONS.md](exec-plan/DECISIONS.md) GD-6~10（2026-07-06 grill）。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-19** | [wp-19-scene-system/](exec-plan/active/stage3/wp-19-scene-system/README.md) | 場景系統：SceneConfig + GLTF 管線 + 淨空驗證 + 雜亂度階層場景 ×2 | **M9** | M4（可與 stage2 尾段並行） |
| **WP-20** | [wp-20-display-pipeline/](exec-plan/active/stage3/wp-20-display-pipeline/README.md) | 解析度模式 + fullscreen/資格閘 + frame-time log + session setup | — | M4（可並行） |
| **WP-21** | [wp-21-detection-drill/](exec-plan/active/stage3/wp-21-detection-drill/README.md) | seeded spawn + pop-in 偵測 drill + t_detect 離線推導 spec | — | T1/T2 獨立；T3 需 WP-16 |
| **WP-22** | [wp-22-perception-integration/](exec-plan/active/stage3/wp-22-perception-integration/README.md) | 追蹤×場景 + 解析度 protocol E2E + 決定性回歸 + 驗收清單 C | **M10** | WP-19,20,21 + WP-18 |

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

**階段 B（`active/stage2/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-10 | [T1 ran1/彈道表](exec-plan/active/stage2/wp-10-recoil-core/T1-ran1-recoil-table.md) · [T2 punch 動力學](exec-plan/active/stage2/wp-10-recoil-core/T2-punch-dynamics.md) · [T3 spread/inaccuracy](exec-plan/active/stage2/wp-10-recoil-core/T3-spread-inaccuracy.md) · [T4 pattern viewer](exec-plan/active/stage2/wp-10-recoil-core/T4-pattern-viewer.md) · [T-exit](exec-plan/active/stage2/wp-10-recoil-core/T-exit-gate.md) |
| WP-11 | [T1 WeaponConfig](exec-plan/active/stage2/wp-11-weapon-fire/T1-weapon-config.md) · [T2 fire down/up](exec-plan/active/stage2/wp-11-weapon-fire/T2-fire-down-up.md) · [T3 cycletime 排程](exec-plan/active/stage2/wp-11-weapon-fire/T3-cycletime-scheduler.md) · [T-exit](exec-plan/active/stage2/wp-11-weapon-fire/T-exit-gate.md) |
| WP-12 | [T1 CS2 感度](exec-plan/active/stage2/wp-12-input-seams/T1-cs2-sensitivity.md) · [T2 射線注入](exec-plan/active/stage2/wp-12-input-seams/T2-ray-injection.md) · [T-exit](exec-plan/active/stage2/wp-12-input-seams/T-exit-gate.md) |
| WP-13 | [T1 simStep 佈線](exec-plan/active/stage2/wp-13-sim-camera-integration/T1-simstep-recoil-wiring.md) · [T2 相機/彈道合成](exec-plan/active/stage2/wp-13-sim-camera-integration/T2-camera-ballistic-compose.md) · [T3 彈孔 + debug](exec-plan/active/stage2/wp-13-sim-camera-integration/T3-bullet-holes-debug.md) · [T-exit](exec-plan/active/stage2/wp-13-sim-camera-integration/T-exit-gate.md) |
| WP-14 | [T1 friction integrator](exec-plan/active/stage2/wp-14-movement-physics/T1-friction-integrator.md) · [T2 velocity gate](exec-plan/active/stage2/wp-14-movement-physics/T2-velocity-gate.md) · [T3 指標連續化](exec-plan/active/stage2/wp-14-movement-physics/T3-metrics-continuous.md) · [T-exit](exec-plan/active/stage2/wp-14-movement-physics/T-exit-gate.md) |
| WP-15 | [T1 cl_showpos 校準](exec-plan/active/stage2/wp-15-calibration/T1-clshowpos-calibration.md) · [T2 pattern 比對](exec-plan/active/stage2/wp-15-calibration/T2-pattern-comparison.md) · [T-exit](exec-plan/active/stage2/wp-15-calibration/T-exit-gate.md) |
| WP-16 | [T1 schema v2](exec-plan/active/stage2/wp-16-metrics-export-v2/T1-schema-v2.md) · [T2 理想路徑指標](exec-plan/active/stage2/wp-16-metrics-export-v2/T2-ideal-path-metric.md) · [T3 結果頁對照](exec-plan/active/stage2/wp-16-metrics-export-v2/T3-result-overlay.md) · [T-exit](exec-plan/active/stage2/wp-16-metrics-export-v2/T-exit-gate.md) |
| WP-17 | [T1 決定性回歸](exec-plan/active/stage2/wp-17-integration/T1-determinism-regression.md) · [T2 全鏈路 E2E](exec-plan/active/stage2/wp-17-integration/T2-e2e-full-chain.md) · [T-exit](exec-plan/active/stage2/wp-17-integration/T-exit-gate.md) |
| WP-18 ⏸ | [README stub](exec-plan/active/stage2/wp-18-f5-subtick/README.md)（~~OQ-S2-5~~ ✅ 已解 GD-7；M8 ✅ 後展開） |

**階段 C（`active/stage3/`）**

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-19 | [T1 SceneConfig](exec-plan/active/stage3/wp-19-scene-system/T1-scene-config.md) · [T2 GLTF + field-low](exec-plan/active/stage3/wp-19-scene-system/T2-gltf-pipeline.md) · [T3 淨空驗證器](exec-plan/active/stage3/wp-19-scene-system/T3-clearance-validator.md) · [T4 場景切換 + meta](exec-plan/active/stage3/wp-19-scene-system/T4-scene-switch-metadata.md) · [T5 urban-high + perf](exec-plan/active/stage3/wp-19-scene-system/T5-second-scene-perf.md) · [T-exit](exec-plan/active/stage3/wp-19-scene-system/T-exit-gate.md) |
| WP-20 | [T1 解析度模式](exec-plan/active/stage3/wp-20-display-pipeline/T1-resolution-modes.md) · [T2 fullscreen + 資格閘](exec-plan/active/stage3/wp-20-display-pipeline/T2-fullscreen-eligibility-gate.md) · [T3 frame-time log](exec-plan/active/stage3/wp-20-display-pipeline/T3-frame-time-log.md) · [T4 session setup](exec-plan/active/stage3/wp-20-display-pipeline/T4-session-setup-form.md) · [T-exit](exec-plan/active/stage3/wp-20-display-pipeline/T-exit-gate.md) |
| WP-21 | [T1 seeded spawn](exec-plan/active/stage3/wp-21-detection-drill/T1-seeded-spawn.md) · [T2 偵測 drill config](exec-plan/active/stage3/wp-21-detection-drill/T2-detection-drill-config.md) · [T3 推導 spec + fixture](exec-plan/active/stage3/wp-21-detection-drill/T3-offline-derivation-spec.md) · [T-exit](exec-plan/active/stage3/wp-21-detection-drill/T-exit-gate.md) |
| WP-22 | [T1 追蹤 × 場景](exec-plan/active/stage3/wp-22-perception-integration/T1-tracking-in-scene.md) · [T2 protocol E2E](exec-plan/active/stage3/wp-22-perception-integration/T2-resolution-protocol-e2e.md) · [T3 決定性 + 清單 C](exec-plan/active/stage3/wp-22-perception-integration/T3-determinism-acceptance-c.md) · [T-exit](exec-plan/active/stage3/wp-22-perception-integration/T-exit-gate.md) |

> 每個 WP 另含 `T0-entry-gate.md`、`task-checklist.md`、`progress.md`（見 §3.1 慣例），此處省略以保持精簡。

---

## 4. 維護約定

- 新增 / 移除 `docs/` 下的資料夾或頂層文件時，**同步更新本檔**。
- WP 交付移入 `completed/` 時，更新 §3.2 路徑與 [exec-plan/README.md](exec-plan/README.md) 狀態。
- 本檔只列**結構與導航**；各文件的內容變更不需回寫本檔。
