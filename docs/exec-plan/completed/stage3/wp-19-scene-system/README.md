# WP-19 — scene-system:場景系統(SceneConfig + GLTF + 淨空驗證)

> stage3 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:[DECISIONS.md](../../../DECISIONS.md) **GD-6**(純裝飾 + 淨空驗證)/ **GD-9**(寫實原創 + 授權紀律)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 場景 = 資料驅動、可置換、render-only:`SceneConfig` schema + GLTF 載入管線 + **淨空驗證**(視線走廊 vs prop-bounds,相交拒載)+ 場景切換/meta + 兩個雜亂度階層場景(`field-low`/`urban-high`) |
| **里程碑** | **M9**(場景脊椎) |
| **相依** | M4 ✅(可與 stage2 尾段並行;不碰 recoil 鏈檔案) |
| **對應 FR** | FR-C1 ~ FR-C5 |
| **估時** | 4–6 dev-days |
| **狀態** | ✅ **M9 達成 2026-07-08**(T0–T-exit 全綠;場景脊椎宣告) |

---

## 1. 範圍

**In scope**:

```
src/scene/SceneConfig.ts        ← ADD schema + validateScene(比照 drill/schema.ts)      [T1]
src/scene/scenes/placeholder-room.ts ← ADD 佔位房間收編為第一個 SceneConfig(asset:null) [T1]
src/render/sceneLoader.ts       ← ADD GLTF async 管線 + dispose + fallback               [T2]
src/render/SceneManager.ts      ← MODIFY 接受 SceneConfig(佔位房間走同一路徑)           [T2]
public/assets/scenes/field-low/ ← ADD 首個寫實場景資產(CC0/CC-BY)                      [T2]
ATTRIBUTIONS.md                 ← ADD 資產授權逐項稽核檔(repo root)                     [T2]
src/scene/clearance.ts          ← ADD validateClearance(走廊 × propBounds slab test)    [T3]
src/drill/DrillLoader.ts        ← MODIFY 載入時跑淨空驗證,違規拒載                      [T3]
src/main.ts                     ← MODIFY 場景切換掛線 + 載入時序 gating                  [T4]
src/ui/Controls.ts              ← MODIFY 場景選擇(比照換 drill)                         [T4]
src/data/metadata.ts            ← MODIFY meta.scene 區塊填值(v2 optional,縫由 WP-16 留)[T4]
public/assets/scenes/urban-high/ ← ADD 第二場景(高雜亂度)+ 負載驗證                    [T5]
```

**Out of scope**:宣告式 occluder / slide-in(GD-6 路徑 C,觸發條件見 [../README.md §2.1](../README.md))、場景幾何進 sim(**GD-6 永久排除 B-full**)、付費資產管線(GD-9 觸發後另議)、追蹤 drill 本體(WP-18)。

## 2. 關鍵契約

- `SceneConfig` / `validateScene` / `validateClearance` 簽名:[../README.md §2.3](../README.md)。
- **`propBounds` 資料流終點 = validator**:`src/sim/`、`SharedState` 不得 import `src/scene/`(lint/架構測試守住,GD-6 硬約束)。
- 淨空驗證幾何(保守過近似、margin 常數、等價性論證):[../README.md §2.4](../README.md)。
- 佔位房間收編:現行 `SceneManager` 程序化房間變成 `sceneId: 'placeholder-room'` 的 config(`asset: null`),**載入失敗 fallback 與預設場景走同一條路**——單一路徑,無特例分支。
- 資產紀律(GD-9):CC0/CC-BY only、`ATTRIBUTIONS.md` 逐項(資產名/作者/來源 URL/授權/取得日)、`sceneId` 中性命名、`assetPackVersion` 斷代進 meta。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 場景資產壓垮 render(draw calls/貼圖) | 顯示鏈延遲汙染量測 | T2 選型即測負載;T5 兩場景 frame 分佈 DoD;資產預算記 config 註記 |
| 淨空驗證漏擋/誤擋 | 效度破口 / 場景做不出來 | 對抗性 fixture(恰相交/恰不相交)為 T3 DoD;誤擋錯誤指名 prop id + 線段 |
| GLTF 載入與 drill 開始競態 | drill 在場景 ready 前開跑 | 載入 gating(controls disabled);T4 DoD 含時序斷言 |
| 場景切換污染 sim 決定性 | baseline 全紅 | 「同輸入序列跨場景 sim 狀態逐位一致」自動化斷言(T4 DoD;FR-C4) |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-6/9 收斂驗證 + 資產選型(OQ-S3-3)+ CLAUDE.md 硬約束回寫 | — | Low |
| **T1** | [T1-scene-config.md](T1-scene-config.md) | `SceneConfig` schema + `validateScene` + 佔位房間收編 | T0 | Low |
| **T2** | [T2-gltf-pipeline.md](T2-gltf-pipeline.md) | GLTF async 管線 + `field-low` 場景 + ATTRIBUTIONS | T1 | **High** |
| **T3** | [T3-clearance-validator.md](T3-clearance-validator.md) | 淨空驗證器 + DrillLoader 拒載掛線 | T1 | **High** |
| **T4** | [T4-scene-switch-metadata.md](T4-scene-switch-metadata.md) | 場景切換 UI + meta.scene + 跨場景決定性斷言 | T2, T3 | Med |
| **T5** | [T5-second-scene-perf.md](T5-second-scene-perf.md) | `urban-high` 第二場景 + 兩場景負載驗證 | T4 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | M9 宣告:置換/拒載/決定性/attribution 四項證據 | T1–T5 | — |
