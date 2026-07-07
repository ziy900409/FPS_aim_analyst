# 執行計畫索引 — FPS 反向急停瞄準訓練器（階段 A + B + C）

> 頂層索引。把 [`../PLAN.md`](../PLAN.md) 的工作包（階段 A：WP-0 ~ WP-9；階段 B：WP-10 ~ WP-18；階段 C：WP-19 ~ WP-22）展開成**每 WP 一個自足子資料夾**的可執行實作計畫。
> 規格書：[`../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) v1.0 · 專有名詞：[`../../CONTEXT.md`](../../CONTEXT.md)
> 格式參照 `performance_analysis` repo 的 `issue-26` exec-plan（每 task 一個自足檔案，單 task 執行時 context 用量 < 40%）。

| | |
|---|---|
| **Repo** | [ziy900409/FPS_aim_analyst](https://github.com/ziy900409/FPS_aim_analyst) |
| **交付範圍** | 階段 A：F1–F4 + 1 個完整 counter-strafe drill（簡化「立即停止」急停） |
| **技術棧** | Three.js `WebGPURenderer`（`three/webgpu`）+ TypeScript + Vite；UI = 純 TS + DOM overlay；測試 = Vitest + Playwright |
| **估時** | 25–39 dev-days（≈5–8 週，含 WebGPU 設定與學習爬升） |
| **狀態** | ✅ **階段 A 交付**（WP-0 ~ WP-9 全部完成，**M4 達成 2026-07-03**；已移入 `completed/stage1/`）· ✅ **階段 B 交付**（WP-10~17 於 `active/stage2/`，**M8 達成 2026-07-07**；WP-18 F5 為門控後續）· ⬜ **階段 C 已規劃**（WP-19~22 於 `active/stage3/`，2026-07-06；研究決議 GD-6~10 已全數拍板） |

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

**階段 B（`active/stage2/`，🟡 進行中；tech spec：[`active/stage2/README.md`](active/stage2/README.md)）**

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-10** | [`active/stage2/wp-10-recoil-core/`](active/stage2/wp-10-recoil-core/README.md) | 後座力數學核心（彈道表 + punch 動力學 + inaccuracy）+ golden tests | **M5** | —（可立即開跑） | 2–3 | ✅ **M5（2026-07-05）** |
| **WP-11** | [`active/stage2/wp-11-weapon-fire/`](active/stage2/wp-11-weapon-fire/README.md) | `WeaponConfig` + fire down/up + cycletime 產彈 + 彈匣 | — | WP-10 | 2–3 | ✅ **（2026-07-06）** |
| **WP-12** | [`active/stage2/wp-12-input-seams/`](active/stage2/wp-12-input-seams/README.md) | CS2 感度換算（A4）+ 射線方向注入（A3） | — | — | 1–1.5 | ✅ **（2026-07-06）** |
| **WP-13** | [`active/stage2/wp-13-sim-camera-integration/`](active/stage2/wp-13-sim-camera-integration/README.md) | recoil 進 simStep（64Hz 子節奏）+ 相機/彈道合成 + 彈孔 | **M6** | WP-10, 11, 12 | 2–3 | ✅ **M6（2026-07-06）** |
| **WP-14** | [`active/stage2/wp-14-movement-physics/`](active/stage2/wp-14-movement-physics/README.md) | friction/accelerate integrator + velocity gate（~88 u/s）+ 殘速指標連續化 | — | —（介面不變，可並行） | 2–3 | ✅ **（2026-07-06）** |
| **WP-15** | [`active/stage2/wp-15-calibration/`](active/stage2/wp-15-calibration/README.md) | `cl_showpos` 軌跡校準 + pattern 圖逐彈比對 | **M7** | WP-13, 14 | 1.5–2 | ✅ **M7 caveated（2026-07-07）** |
| **WP-16** | [`active/stage2/wp-16-metrics-export-v2/`](active/stage2/wp-16-metrics-export-v2/README.md) | 匯出 schema v2 + 壓槍指標（補償 vs 理想路徑）+ 結果頁對照 | — | WP-13 | 2–3 | ✅ **2026-07-07** |
| **WP-17** | [`active/stage2/wp-17-integration/`](active/stage2/wp-17-integration/README.md) | E2E 全鏈路 + 決定性回歸擴充 + 驗收清單 B | **M8** | WP-15, 16 | 1.5–2.5 | ✅ **M8（2026-07-07）** |
| **WP-18** | [`active/stage2/wp-18-f5-subtick/`](active/stage2/wp-18-f5-subtick/README.md) | F5 移動 drill + 目標 sub-tick 命中內插 + 追蹤指標 | — | ~~OQ-S2-5~~ ✅（GD-7）+ WP-17（M8） | +2–3.5 | ⏸ 待 M8 |

**階段 C（`active/stage3/`，⬜ 已規劃 2026-07-06；tech spec：[`active/stage3/README.md`](active/stage3/README.md)；研究決議 [DECISIONS.md](DECISIONS.md) GD-6~10）**

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-19** | [`active/stage3/wp-19-scene-system/`](active/stage3/wp-19-scene-system/README.md) | 場景系統：SceneConfig + GLTF 管線 + 淨空驗證 + 雜亂度階層場景 ×2 | **M9** | M4 ✅（可與 stage2 尾段並行） | 4–6 | ⬜ |
| **WP-20** | [`active/stage3/wp-20-display-pipeline/`](active/stage3/wp-20-display-pipeline/README.md) | 解析度模式 + fullscreen/資格閘 + frame-time log + session setup | — | M4 ✅（可並行） | 3–4 | ⬜ |
| **WP-21** | [`active/stage3/wp-21-detection-drill/`](active/stage3/wp-21-detection-drill/README.md) | seeded spawn + pop-in 偵測 drill + t_detect 離線推導 spec | — | T1/T2 獨立；T3 需 WP-16 | 2.5–3.5 | ⬜ |
| **WP-22** | [`active/stage3/wp-22-perception-integration/`](active/stage3/wp-22-perception-integration/README.md) | 追蹤×場景 + 解析度 protocol E2E + 決定性回歸 + 驗收清單 C | **M10** | WP-19, 20, 21 + WP-18 | 2–3 | ⬜ |

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
| **M9 ⬜** | 場景可置換(≥2 雜亂度階層)+ 淨空驗證拒載違規 drill + 跨場景 sim 決定性逐位一致 + 資產 attribution 可稽核 | WP-19 | 場景脊椎:「換場景零引擎碼」與「場景不碰決定性」被測試釘死 |
| **M10 ⬜** | 驗收清單 C 全項通過:資格閘拒入/放行、受試者內解析度 protocol E2E、追蹤×場景 E2E、偵測推導 round-trip、三條決定性不變性全綠 | WP-22 | **stage3 交付**:追蹤能力與解析度×偵測兩實驗 pilot-ready |

---

## 4. 跨階段相依圖（關鍵路徑，來自 PLAN §6）

```
階段 A（completed/stage1/）
WP-0 → WP-1 → WP-2 →┬→ WP-3 →┐
                     ├→ WP-4 →┼→ WP-5 → WP-6 → WP-7 → WP-8 → WP-9 ─── M4 ✅
                     └────────┘

階段 B（active/stage2/；上游門檻 = M4 ✅）
WP-10 ──┬→ WP-11 ──┐
        │          ├→ WP-13(M6) ──┬→ WP-16 ──┐
WP-12 ──┴──────────┘               │          ├→ WP-17(M8)
WP-14 ─────────────────────────────┴→ WP-15(M7)┘
                                          WP-18(F5，⏸ 門控)
```

- WP-2（脊椎，M1）是階段 A 的門控閘：完成且決定性驗證通過前，不展開 WP-3 之後。
- WP-3 / WP-4 在 WP-2 之後可並行。
- 階段 B 可並行三線開跑：WP-10、WP-12、WP-14 互不相依；**M5 未過不進 WP-13**（先鎖數學再接線）。詳見 [`active/stage2/README.md §5`](active/stage2/README.md)。

```
階段 C（active/stage3/；研究側門檻 = GD-6~10 ✅ 2026-07-06；工程側各 entry gate 把關）
WP-19（場景，M9）────────────────┐
WP-20（顯示管線）────────────────┼→ WP-22（整合，M10）= stage3 交付
WP-21（偵測；T3 需 WP-16）───────┤
WP-18（F5；stage2，M8 後）───────┘
```

- 階段 C 三線可並行：WP-19、WP-20、WP-21（T1/T2）互不相依，皆不碰 stage2 recoil 鏈熱區；建議排程點 stage2 **M6（✅ 2026-07-06 已達成）**之後——條件已成立。**M9 未過不進 WP-22**。詳見 [`active/stage3/README.md §5`](active/stage3/README.md)。

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
│   ├── stage2/                        ← 階段 B（WP-10~18）
│   │   ├── README.md                  ← stage2 頂層索引 + tech spec
│   │   └── wp-N-*/                    ← 每 WP 一自足子資料夾
│   │       ├── README.md              ← WP tech spec
│   │       ├── task-checklist.md      ← master task index
│   │       ├── progress.md            ← running log
│   │       ├── T0-entry-gate.md
│   │       ├── T1..Tn.md
│   │       └── T-exit-gate.md
│   └── stage3/                        ← 階段 C（WP-19~22，同一結構）
│       ├── README.md                  ← stage3 頂層索引 + tech spec
│       └── wp-N-*/
├── completed/                         ← WP 交付後移入
│   └── stage1/                        ← 階段 A（WP-0~9，✅ 交付；格式模板）
│       └── wp-N-*/
└── superseded/                        ← 被取代的計畫
```
