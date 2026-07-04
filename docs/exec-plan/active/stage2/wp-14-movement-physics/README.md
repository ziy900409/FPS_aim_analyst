# WP-14 — movement-physics:friction/accelerate integrator + velocity gate

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 公式依據:規格 §1.3 階段 B(1)(2) + 附錄 D([../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md))
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | `MovementController` 內部以 Source ground-move(friction/accelerate)取代 M1 線性 snap;開火精準 gate 由二元 `stopped` 升級為連續速度模型(門檻 ~88 u/s);殘速/過衝指標連續化 |
| **里程碑** | —(M7 前置:WP-15 校準的對象就是本 WP 的速度曲線) |
| **相依** | 無(公開介面不變,可與 WP-10–13 並行;**T2 例外**:需 WP-11 T3 `fireOneShot`) |
| **對應 FR** | FR-B11(integrator)、FR-B12(velocity gate + 連續指標) |
| **估時** | 2–3 dev-days |
| **狀態** | ⬜ 未開始 |

---

## 1. 範圍

**In scope**:

```
src/sim/MovementController.ts        ← MODIFY 內部換 integrator(step(state, dtSec) 介面不變) [T1]
src/sim/MovementController.test.ts   ← MODIFY 加減速曲線解析單測 + M1 契約重驗               [T1]
src/loop/__tests__/determinism.test.ts、tests/regression/determinism.test.ts ← baseline 重錄  [T1]
src/loop/SimLoop.ts、src/state/SharedState.ts ← MODIFY accurate 判定 + residualSpeed 連續值   [T2]
src/metrics/compute.ts、src/ui/ResultScreen.ts ← MODIFY 殘速/過衝連續 u/s 呈現                [T3]
```

**Out of scope**:校準對照(WP-15)、schema v2 全量擴欄(WP-16;T3 只動計算與呈現,
對帳點在檔內註記)、移動參數 UI(常數走規格附錄 D,不做面板)、
**Valorant 移動模式**(settle-timer 急停、2D WASD、Unreal 單位/校準——僅以 `MovementProfile`
注入點留接口,實作排 WP-14 之後另立 WP;meta 斷代標記 `movementModel` 由 WP-16 T1 承接)。

## 2. 關鍵契約

- 公開介面**不變**:`step(state, dtSec)`(規格附錄 D 承諾;呼叫端零 diff)。
- 每 tick 順序 = **先 friction 後 accelerate**(Source 慣例);常數(附錄 D)以 **`MovementProfile`** 資料物件注入
  (`CS2_PROFILE = { friction: 5.2, accelerate: 5.6, stopSpeed: 75, maxSpeed: 250, accuracyThreshold: 88 }`),
  比照 WeaponConfig 精神:新移動模型 = 新 profile,不改引擎與呼叫端——**Valorant 接口即此,本階段僅留不實作**。
- `stopped` 語意改寫:`|vx| < ACCURACY_THRESHOLD(88)` 時 true(SharedState 註解既定接縫);
  counter-strafe 不再瞬停,由物理自然減速穿越門檻。
- 決定性 baseline **預期重錄**(GD-5 已記):先重驗 M1 契約(異 FPS 同軌跡)再重錄。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| integrator 改變逐 tick 軌跡 → 既有決定性 baseline 全紅 | 回歸誤判為 regression | **預期 breaking**([../README.md §2.6](../README.md)):先重驗 M1 契約(異 FPS 同軌跡)再重錄 baseline + GD 記錄 |
| friction/accelerate 次序寫反或 dt 代錯 | 曲線形狀錯 → WP-15 校準全歪且難歸因 | T1 解析對照單測(起步時間常數 / 急停 tick 數)把關 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-5 重錄授權確認 + 決定性測試盤點 + 介面承諾確認 | — | Low |
| **T1** | [T1-friction-integrator.md](T1-friction-integrator.md) | Source integrator 替換(`MovementProfile` 注入)+ baseline 重錄 | T0 | **High** |
| **T2** | [T2-velocity-gate.md](T2-velocity-gate.md) | velocity gate 連續模型(88 u/s)+ spread 接真速度 | T1、**WP-11 T3** | Med |
| **T3** | [T3-metrics-continuous.md](T3-metrics-continuous.md) | 殘速/過衝指標連續 u/s 呈現 | T2 | Low |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | baseline 重錄完成 + 急停手感手動驗證 | T1–T3 | — |
