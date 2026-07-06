# 文件地圖 — 階段 C(stage3)研究場景與感知實驗

> 本檔為 `docs/exec-plan/active/stage3/` 的**目錄總覽**,stage3 閱讀導航的單一入口。上層地圖:[docs/MAP.md](../../../MAP.md)。
> 想找「該做什麼、怎麼做」→ [README.md](README.md)(tech spec)+ 各 WP 資料夾;想找「為什麼這樣定」→ [DECISIONS.md](../../DECISIONS.md) GD-6~10;想快速看懂全貌 → [PLAN.md](PLAN.md)。
> 文件語言:繁體中文,術語保留英文(D4)。

---

## 1. 閱讀順序(stage3 新進者)

| 順序 | 文件 | 用途 |
|---|---|---|
| ⓪ | [`CLAUDE.md`](../../../../CLAUDE.md) | 執行協議 + 導航(agent 開場即載入;repo 根) |
| ① | [`CONTEXT.md`](../../../../CONTEXT.md) | 專有名詞——本階段新術語已收錄(§A:追蹤誤差 ε(t)/on-target、t_acquire、TOT%/追蹤窗口、偵測反應時間/t_detect、偏心度、pop-in/slide-in、雜亂度階層、資格閘;§C:純裝飾場景、淨空驗證、SceneConfig/sceneId) |
| ② | [`DECISIONS.md`](../../DECISIONS.md) **GD-6 ~ GD-10** | 研究決議權威(2026-07-06 grill):遮擋路線、追蹤指標、偵測操作化、資產授權、顯示硬體 |
| ③ | [PLAN.md](PLAN.md) | stage3 大框架:目標、決策依據、架構定位、WP-19~22 階段步驟、風險 |
| ④ | [README.md](README.md) | stage3 tech spec(**source of truth**):FR-C1~15、介面契約、淨空驗證幾何、schema 政策、M9/M10、OQ-S3-1~5 |
| ⑤ | `wp-19..22/` 各 WP 資料夾 | 進入要做的 WP,從該 WP 的 `README.md` 開始 → `T0-entry-gate` → `Tn` → `T-exit-gate` |

---

## 2. 本資料夾文件

| 文件 | 內容 | 狀態 |
|---|---|---|
| [MAP.md](MAP.md) | 本檔 — stage3 文件地圖 / 導航 | — |
| [PLAN.md](PLAN.md) | 大框架執行計畫:GD-6~10 決策表、技術棧新增、架構總覽、WP 階段步驟、測試策略 | ✅ |
| [README.md](README.md) | stage3 頂層索引 + tech spec(FR/設計/里程碑/相依圖/風險/OQ/文件對帳清單) | ✅ |
| [wp-19-scene-system/](wp-19-scene-system/README.md) | 場景系統(SceneConfig + GLTF + 淨空驗證 + 雜亂度階層 ×2)★M9 | ⬜ 未開始 |
| [wp-20-display-pipeline/](wp-20-display-pipeline/README.md) | 顯示管線(解析度模式 + 資格閘 + frame log + session setup) | ⬜ 未開始 |
| [wp-21-detection-drill/](wp-21-detection-drill/README.md) | 偵測 drill(seeded spawn + pop-in + t_detect 離線推導 spec) | ⬜ 未開始 |
| [wp-22-perception-integration/](wp-22-perception-integration/README.md) | 感知實驗整合(追蹤×場景 + protocol E2E + 驗收清單 C)★M10 | ⬜ 未開始 |

每個 `wp-N-*/` 子資料夾固定內含(沿用全 repo 慣例):`README.md`(WP tech spec)· `task-checklist.md` · `progress.md` · `T0-entry-gate.md` → `T1..Tn` → `T-exit-gate.md`。

---

## 3. WP 索引與相依

> 里程碑:**M9** = 場景脊椎(WP-19)· **M10** = stage3 交付(WP-22)。詳細狀態以 [README.md §3](README.md) 與 [exec-plan/README.md §2](../../README.md) 為準。

```
WP-19(場景,M9)────────────────┐
WP-20(顯示管線)────────────────┼→ WP-22(整合,M10)= stage3 交付
WP-21(偵測;T3 需 WP-16)───────┤
WP-18(F5;stage2,M8 後)────────┘
```

三線(WP-19/20/21)可並行;**M9 未過不進 WP-22**;WP-22 另需 stage2 的 WP-18。

---

## 4. 各 WP task 一覽

| WP | Tasks(`T0` entry-gate → `Tn` → exit-gate) |
|---|---|
| **WP-19** | [T0 entry gate](wp-19-scene-system/T0-entry-gate.md) · [T1 SceneConfig schema](wp-19-scene-system/T1-scene-config.md) · [T2 GLTF 管線 + field-low](wp-19-scene-system/T2-gltf-pipeline.md) · [T3 淨空驗證器](wp-19-scene-system/T3-clearance-validator.md) · [T4 場景切換 + meta](wp-19-scene-system/T4-scene-switch-metadata.md) · [T5 urban-high + perf](wp-19-scene-system/T5-second-scene-perf.md) · [T-exit(M9)](wp-19-scene-system/T-exit-gate.md) |
| **WP-20** | [T0 entry gate](wp-20-display-pipeline/T0-entry-gate.md) · [T1 解析度模式](wp-20-display-pipeline/T1-resolution-modes.md) · [T2 fullscreen + 資格閘](wp-20-display-pipeline/T2-fullscreen-eligibility-gate.md) · [T3 frame-time log](wp-20-display-pipeline/T3-frame-time-log.md) · [T4 session setup 表單](wp-20-display-pipeline/T4-session-setup-form.md) · [T-exit](wp-20-display-pipeline/T-exit-gate.md) |
| **WP-21** | [T0 entry gate](wp-21-detection-drill/T0-entry-gate.md) · [T1 seeded spawn](wp-21-detection-drill/T1-seeded-spawn.md) · [T2 偵測 drill config](wp-21-detection-drill/T2-detection-drill-config.md) · [T3 離線推導 spec + fixture](wp-21-detection-drill/T3-offline-derivation-spec.md) · [T-exit](wp-21-detection-drill/T-exit-gate.md) |
| **WP-22** | [T0 entry gate](wp-22-perception-integration/T0-entry-gate.md) · [T1 追蹤 × 場景](wp-22-perception-integration/T1-tracking-in-scene.md) · [T2 protocol 執行器 + E2E](wp-22-perception-integration/T2-resolution-protocol-e2e.md) · [T3 決定性 + 驗收清單 C](wp-22-perception-integration/T3-determinism-acceptance-c.md) · [T-exit(M10)](wp-22-perception-integration/T-exit-gate.md) |

> 每個 WP 另含 `task-checklist.md`、`progress.md`(§2 慣例),此處省略。

---

## 5. stage3 與外部文件的接點

| 接點 | 文件 | 關係 |
|---|---|---|
| **WP-16 schema v2**(stage2) | [wp-16 README](../stage2/wp-16-metrics-export-v2/README.md) · [T1](../stage2/wp-16-metrics-export-v2/T1-schema-v2.md) | stage3 資料面上游:逐 tick `tx/ty/tz/px/pz` + meta `spawn` + `scene`/`display`/`frames` reserved 區塊(GD-7/8/10 回饋已入其 scope,2026-07-06);WP-21 T3 的 task 級相依 |
| **WP-18 F5**(stage2) | [wp-18 README](../stage2/wp-18-f5-subtick/README.md) | 追蹤 drill 供應者(移動目標 + sub-tick 內插 + timed presentation + 目標內插);WP-22 T1 消費;交付形狀對帳點 = OQ-S3-5 |
| 全域決策帳本 | [DECISIONS.md](../../DECISIONS.md) | GD-6~10 = 本階段研究決議權威;新的跨 WP 決策照慣例寫回該帳本 |
| 專有名詞 | [CONTEXT.md](../../../../CONTEXT.md) | 本階段新術語已收錄(見 §1 ①);命名任何東西前先對齊 |
| 匯出 schema | [docs/operational/schema.md](../../../operational/schema.md) | `scene`/`display`/`frames`/`spawn` 區塊與逐 tick 位置欄對帳(隨 WP-16 T1 / WP-19 T4 / WP-20 T3 分批) |
| 規格書 | [規格書 v1.1](../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 升 v1.3 對帳待辦(階段 C 節 + 驗收清單 C 附錄 + F5 既有懸案),見 [README §9](README.md) |
| 執行協議 | [CLAUDE.md](../../../../CLAUDE.md) | §4 三條新硬約束(場景幾何不進 sim / 資產授權白名單 / spawn seeded)於 WP-19/20/21 各自 T0 回寫 |

**本階段將產出的新文件**(隨 task 落地):repo 根 `ATTRIBUTIONS.md`(WP-19 T2)、`docs/operational/analysis-t-detect.md`(WP-21 T3)、`docs/operational/acceptance-checklist-c.md` 與 `docs/operational/pilot-protocol-stage3.md`(WP-22 T3)。

---

## 6. 維護約定

- 新增 / 移除本資料夾的文件時,**同步更新本檔** §2(與上層 [docs/MAP.md](../../../MAP.md) §3)。
- WP 交付時:該 WP 狀態在本檔 §2、[README.md §3](README.md)、[exec-plan/README.md §2](../../README.md) 三處同步翻 ✅。
- stage3 交付(M10)移入 `completed/` 時,更新 [docs/MAP.md](../../../MAP.md) 與 [exec-plan/README.md](../../README.md) 路徑。
- 本檔只列**結構與導航**;內容變更不需回寫本檔。
