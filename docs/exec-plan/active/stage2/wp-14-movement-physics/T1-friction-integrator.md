# T1 — Source friction/accelerate integrator(取代 M1 snap)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 公式權威來源:規格附錄 D([../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md))

| | |
|---|---|
| **相依** | T0(盤點與授權確認完成) |
| **Risk / Cplx** | **High** / High |
| **Touches** | MODIFY `src/sim/MovementController.ts`、`src/sim/MovementController.test.ts`、`src/loop/__tests__/determinism.test.ts`、`tests/regression/determinism.test.ts`(baseline 重錄) |
| **狀態** | ⬜ |

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
- 常數(附錄 D):`SV_FRICTION = 5.2`、`SV_ACCELERATE = 5.6`、`SV_STOPSPEED = 75`、`vStrafe ≈ 250`。
- `stopped` 語意改寫:`|vx| < ACCURACY_THRESHOLD(88)` 時 true(SharedState 註解既定接縫);
  counter-strafe 判定(反向鍵)不再瞬停,由物理自然減速穿越門檻。
- M1 決定性契約重驗(異 FPS 同 tick 軌跡)→ 綠之後依 T0 盤點清單逐檔重錄 baseline。

## Out of scope
- fire 側 accurate/residualSpeed(T2);呈現層(T3);y/z 軸與斜向移動(階段 B 僅 1D strafe)。

## Steps

- [ ] integrator 實作:單一 `step` 內兩個私有步驟,順序 friction → accelerate 固定。
- [ ] 解析對照單測:起步 0 → ~250 的時間常數、急停 250 → <88 的 tick 數,
      對照逐步手算序列(±1 tick)。
- [ ] `stopped` 改寫 + 既有消費點(HUD 燈 / 記錄欄)行為驗證。
- [ ] M1 契約重驗:pump 60/144/240 → 同 tick index 同 position/velocity(**先於**重錄)。
- [ ] Baseline 重錄:T0 清單逐檔更新期望值;重錄理由記 progress + GD-5 補記連結。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 介面/呼叫端零 diff(`git diff` 僅 MovementController 內部 + 測試);曲線單測綠
  (起步/急停解析對照);M1 契約重驗綠;baseline 重錄完成且記錄可追(GD + progress)。

## Commit

`feat(wp-14): T1 Source friction/accelerate integrator 取代 M1 snap(baseline 重錄)`
