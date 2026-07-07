# T1 — Source friction/accelerate integrator(取代 M1 snap)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 公式權威來源:規格附錄 D([../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md))

| | |
|---|---|
| **相依** | T0(盤點與授權確認完成) |
| **Risk / Cplx** | **High** / High |
| **Touches** | MODIFY `src/sim/MovementController.ts`、`src/sim/MovementController.test.ts`、`src/loop/__tests__/determinism.test.ts`、`tests/regression/determinism.test.ts`(baseline 重錄) |
| **狀態** | ✅ complete |

## Objective

`createMovementController` 內部以 Source ground-move(1D,x 軸)取代 M1 線性 snap:
每 tick **先 friction 後 accelerate**,速度成為連續值;公開介面 `step(state, dtSec)` 不變。

## In scope
- friction(每 tick 先跑):`speed = |vx|`;`speed < 0.1 → vx = 0`;
  `control = max(speed, SV_STOPSPEED)`;`drop = control × SV_FRICTION × dt`;
  `vx *= max(speed − drop, 0) / speed`。
- accelerate(friction 之後):`wishdir ∈ {−1, 0, +1}`(由 `state.held` 定,A+D 互斥抵消);
  `wishspeed = vStrafe`;`currentspeed = vx × wishdir`;`addspeed = wishspeed − currentspeed`;
  `addspeed > 0 → vx += wishdir × min(SV_ACCELERATE × wishspeed × dt, addspeed)`。
- 常數收斂為 **`MovementProfile`** 注入(比照 WeaponConfig 精神;附錄 D 值 = `CS2_PROFILE` 預設):
  `{ friction: 5.2, accelerate: 5.6, stopSpeed: 75, maxSpeed: 250, accuracyThreshold: 88 }`;
  `createMovementController(profile = CS2_PROFILE)`,模組內不散落 loose 常數。
  **Valorant 接口即此**(使用者拍板 2026-07-03):新模型 = 新 profile + factory,本階段不實作。
- `stopped` 語意改寫:`|vx| < ACCURACY_THRESHOLD(88)` 時 true(SharedState 註解既定接縫);
  counter-strafe 判定(反向鍵)不再瞬停,由物理自然減速穿越門檻。
- M1 決定性契約重驗(異 FPS 同 tick 軌跡)→ 綠之後依 T0 盤點清單逐檔重錄 baseline。

## Out of scope
- fire 側 accurate/residualSpeed(T2);呈現層(T3);y/z 軸與斜向移動(階段 B 僅 1D strafe);
  Valorant profile 實作(settle-timer 手感等——僅留注入接口,見 [README](README.md) out of scope)。

## Steps

- [x] `MovementProfile` 型別 + `CS2_PROFILE` 預設 + `createMovementController(profile)` 簽名(預設參數,呼叫端零改)。
- [x] integrator 實作:單一 `step` 內兩個私有步驟(讀 profile 欄位),順序 friction → accelerate 固定。
- [x] 解析對照單測:起步 0 → ~250 的時間常數、急停 250 → <88 的 tick 數,
      對照逐步手算序列(±1 tick)。
- [x] `stopped` 改寫 + 既有消費點(HUD 燈 / 記錄欄)行為驗證。
- [x] M1 契約重驗:pump 60/144/240 → 同 tick index 同 position/velocity(**先於**重錄)。
- [x] Baseline 重錄:T0 清單逐檔更新期望值;重錄理由記 progress + GD-5 補記連結。
- [x] `npx vitest run` 全綠。

## Definition of Done

- 介面/呼叫端零 diff(`git diff` 僅 MovementController 內部 + 測試);曲線單測綠
  (起步/急停解析對照);M1 契約重驗綠;baseline 重錄完成且記錄可追(GD + progress);
  物理常數僅存在 `CS2_PROFILE` 一處(grep 5.2 / 88 單點)。

## Commit

`feat(wp-14): T1 Source friction/accelerate integrator 取代 M1 snap(baseline 重錄)`
