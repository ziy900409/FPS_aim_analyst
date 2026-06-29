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
| ④ | [exec-plan/README.md](exec-plan/README.md) | 執行計畫頂層索引：把 10 個 WP 展開成可執行子資料夾 |
| ⑤ | `exec-plan/active/wp-N-*/` | 進入要做的 WP，從該 WP 的 `README.md` 開始 |

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

頂層索引：[exec-plan/README.md](exec-plan/README.md) — 含里程碑門控（M1–M4）、跨階段相依圖、執行規則。

### 3.1 資料夾慣例

```
docs/exec-plan/
├── README.md          ← 頂層索引（WP 狀態表 + milestones）
├── DECISIONS.md       ← 全域決策 / 跨文件矛盾帳本（global episodic）
├── active/            ← 進行中的 WP（本批全部在此）
│   └── wp-N-*/        ← 每個 WP 一個自足子資料夾
├── completed/         ← WP 交付後移入（尚未建立）
└── superseded/        ← 被取代的計畫（尚未建立）
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

### 3.2 WP 索引（active/）

> 里程碑：M1 = 脊椎（WP-2）· M2 = 核心玩法（WP-5）· M3 = 可匯出資料（WP-7）· M4 = 階段 A 交付（WP-9）。
> 詳細狀態以 [exec-plan/README.md §2](exec-plan/README.md) 為準。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 |
|---|---|---|---|---|
| **WP-0** | [wp-0-environment-setup/](exec-plan/active/wp-0-environment-setup/README.md) | 空場景 + cross-origin isolation + backend 偵測 | → M1 | — |
| **WP-1** | [wp-1-fps-pointerlock/](exec-plan/active/wp-1-fps-pointerlock/README.md) | FPS 控制 + Pointer Lock + 原始輸入 | → M1 | WP-0 |
| **WP-2** ★脊椎 | [wp-2-dual-loop-skeleton/](exec-plan/active/wp-2-dual-loop-skeleton/README.md) | `SharedState` + 雙迴圈骨架 + 決定性驗證 | **M1** | WP-0,1 |
| **WP-3** | [wp-3-input-sampler/](exec-plan/active/wp-3-input-sampler/README.md) | `InputSampler`（F1）高解析度時間戳採集 | — | WP-2 |
| **WP-4** | [wp-4-target-tvisible/](exec-plan/active/wp-4-target-tvisible/README.md) | `TargetManager` + `t_visible`（F2）左右交替 | — | WP-1,2 |
| **WP-5** | [wp-5-hit-counterstrafe/](exec-plan/active/wp-5-hit-counterstrafe/README.md) | `HitDetector` + 橫移 + 簡化急停（F3） | **M2** | WP-3,4 |
| **WP-6** | [wp-6-drill-system/](exec-plan/active/wp-6-drill-system/README.md) | `DrillConfig` 資料驅動 drill（F4） | — | WP-4,5 |
| **WP-7** | [wp-7-data-recorder/](exec-plan/active/wp-7-data-recorder/README.md) | `DataRecorder` ring buffer + JSON/CSV 匯出 | **M3** | WP-2,4,5 |
| **WP-8** | [wp-8-metrics-hud/](exec-plan/active/wp-8-metrics-hud/README.md) | `MetricsDashboard` + 即時 HUD | — | WP-5,6,7 |
| **WP-9** | [wp-9-integration/](exec-plan/active/wp-9-integration/README.md) | 端到端整合 + 計時效度 + 決定性回歸 | **M4** | 全部 |

### 3.3 各 WP task 一覽

| WP | Tasks（`T0` entry-gate → `Tn` → exit-gate） |
|---|---|
| WP-0 | [T1 scaffold](exec-plan/active/wp-0-environment-setup/T1-scaffold.md) · [T2 COOP/COEP](exec-plan/active/wp-0-environment-setup/T2-coop-coep-isolation.md) · [T3 WebGPU backend 偵測](exec-plan/active/wp-0-environment-setup/T3-webgpu-backend-detection.md) · [T4 deploy headers](exec-plan/active/wp-0-environment-setup/T4-deploy-headers.md) · [T5 reference notes](exec-plan/active/wp-0-environment-setup/T5-reference-notes.md) · [T6 exit-gate](exec-plan/active/wp-0-environment-setup/T6-exit-gate.md) |
| WP-1 | [T1 scene](exec-plan/active/wp-1-fps-pointerlock/T1-scene.md) · [T2 pointerlock](exec-plan/active/wp-1-fps-pointerlock/T2-pointerlock.md) · [T3 raw-input fallback](exec-plan/active/wp-1-fps-pointerlock/T3-raw-input-fallback.md) · [T4 yaw/pitch](exec-plan/active/wp-1-fps-pointerlock/T4-yaw-pitch.md) · [T5 settings panel](exec-plan/active/wp-1-fps-pointerlock/T5-settings-panel.md) · [T6 exit-gate](exec-plan/active/wp-1-fps-pointerlock/T6-exit-gate.md) |
| WP-2 | [T1 shared-state](exec-plan/active/wp-2-dual-loop-skeleton/T1-shared-state.md) · [T2 sim-loop](exec-plan/active/wp-2-dual-loop-skeleton/T2-sim-loop.md) · [T3 render interpolation](exec-plan/active/wp-2-dual-loop-skeleton/T3-render-interpolation.md) · [T4 determinism](exec-plan/active/wp-2-dual-loop-skeleton/T4-determinism.md) · [T5 exit-gate](exec-plan/active/wp-2-dual-loop-skeleton/T5-exit-gate.md) |
| WP-3 | [T1 keyboard](exec-plan/active/wp-3-input-sampler/T1-keyboard.md) · [T2 mouse coalesced](exec-plan/active/wp-3-input-sampler/T2-mouse-coalesced.md) · [T3 fire](exec-plan/active/wp-3-input-sampler/T3-fire.md) · [T4 sim-consume](exec-plan/active/wp-3-input-sampler/T4-sim-consume.md) · [T5 exit-gate](exec-plan/active/wp-3-input-sampler/T5-exit-gate.md) |
| WP-4 | [T1 target-entity](exec-plan/active/wp-4-target-tvisible/T1-target-entity.md) · [T2 visibility t_visible](exec-plan/active/wp-4-target-tvisible/T2-visibility-tvisible.md) · [T3 alternation](exec-plan/active/wp-4-target-tvisible/T3-alternation.md) · [T4 crosshair](exec-plan/active/wp-4-target-tvisible/T4-crosshair.md) · [T5 exit-gate](exec-plan/active/wp-4-target-tvisible/T5-exit-gate.md) |
| WP-5 | [T1 hit-detector](exec-plan/active/wp-5-hit-counterstrafe/T1-hit-detector.md) · [T2 first-shot](exec-plan/active/wp-5-hit-counterstrafe/T2-first-shot.md) · [T3 strafe movement](exec-plan/active/wp-5-hit-counterstrafe/T3-strafe-movement.md) · [T4 simplified counter-strafe](exec-plan/active/wp-5-hit-counterstrafe/T4-simplified-counterstrafe.md) · [T5 exit-gate](exec-plan/active/wp-5-hit-counterstrafe/T5-exit-gate.md) |
| WP-6 | [T1 drill-config](exec-plan/active/wp-6-drill-system/T1-drill-config.md) · [T2 drill-loader](exec-plan/active/wp-6-drill-system/T2-drill-loader.md) · [T3 counter-strafe drill](exec-plan/active/wp-6-drill-system/T3-counterstrafe-drill.md) · [T4 lifecycle](exec-plan/active/wp-6-drill-system/T4-lifecycle.md) · [T5 exit-gate](exec-plan/active/wp-6-drill-system/T5-exit-gate.md) |
| WP-7 | [T1 ring-buffer](exec-plan/active/wp-7-data-recorder/T1-ring-buffer.md) · [T2 event recording](exec-plan/active/wp-7-data-recorder/T2-event-recording.md) · [T3 metadata](exec-plan/active/wp-7-data-recorder/T3-metadata.md) · [T4 export](exec-plan/active/wp-7-data-recorder/T4-export.md) · [T5 schema doc](exec-plan/active/wp-7-data-recorder/T5-schema-doc.md) · [T6 exit-gate](exec-plan/active/wp-7-data-recorder/T6-exit-gate.md) |
| WP-8 | [T1 compute-metrics](exec-plan/active/wp-8-metrics-hud/T1-compute-metrics.md) · [T2 result-screen](exec-plan/active/wp-8-metrics-hud/T2-result-screen.md) · [T3 hud](exec-plan/active/wp-8-metrics-hud/T3-hud.md) · [T4 controls](exec-plan/active/wp-8-metrics-hud/T4-controls.md) · [T5 exit-gate](exec-plan/active/wp-8-metrics-hud/T5-exit-gate.md) |
| WP-9 | [T1 e2e integration](exec-plan/active/wp-9-integration/T1-e2e-integration.md) · [T2 timing validity](exec-plan/active/wp-9-integration/T2-timing-validity.md) · [T3 determinism regression](exec-plan/active/wp-9-integration/T3-determinism-regression.md) · [T4 buffer acceptance](exec-plan/active/wp-9-integration/T4-buffer-acceptance.md) · [T5 exit-gate](exec-plan/active/wp-9-integration/T5-exit-gate.md) |

> 每個 WP 另含 `T0-entry-gate.md`、`task-checklist.md`、`progress.md`（見 §3.1 慣例），此處省略以保持精簡。

---

## 4. 維護約定

- 新增 / 移除 `docs/` 下的資料夾或頂層文件時，**同步更新本檔**。
- WP 交付移入 `completed/` 時，更新 §3.2 路徑與 [exec-plan/README.md](exec-plan/README.md) 狀態。
- 本檔只列**結構與導航**；各文件的內容變更不需回寫本檔。
