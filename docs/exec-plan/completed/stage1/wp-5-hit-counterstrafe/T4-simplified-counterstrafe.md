# T4 — 簡化急停 + gate 開火精準

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T3 |
| **Risk / Complexity** | Med / High |
| **Touches** | MODIFY `src/sim/MovementController.ts`、`src/loop/SimLoop.ts`（fire 結果附 accurate/residualSpeed） |
| **Status** | ✅ 完成（2026-07-02）|

## Objective
簡化 counter-strafe：反向鍵（與當前移動方向相反）按下當 tick 立即把 velocity 視為歸零（`stopped=true`），並以停止狀態 gate 開火精準（FR-5.4，OQ-5.1）。這是階段 A「急停」的核心；介面不變以利階段 B 換真 physics。

## In scope
- `MovementController.step`：偵測反向鍵事件 → `state.player.stopped=true; vx=0`；再次同向移動 → `stopped=false`。
- fire 結果計算：`accurate = state.player.stopped`、`residualSpeed = |vx|`（停止≈0）。

## Out of scope
- 真 friction/accelerate/stopspeed（附錄 D，階段 B）；連續精準度模型（階段 B）。

## Design notes
- 「反向鍵」= 與當前移動方向相反者：移動方向 +x（D held）時按 A 即反向 → 急停；反之亦然。
- 階段 A 為**立即**歸零（非衰減）；`residualSpeed` 在停止時記 ≈0，未停止開火記當下 |vx|（供 §5「速度歸零誤差」「停火時序」量測）。
- `stopped` 為抽象欄位；階段 B 由 friction integrator 寫入連續速度，gate 改為 v < 門檻（附錄 D ~88 u/s）。

## Steps
- [x] `step` 加反向鍵偵測 → 立即停止 flag + vx=0。
- [x] fire 結果附 `accurate` + `residualSpeed`（依 `player.stopped`/`|vx|`；emit 留 WP-7）。
- [x] Vitest：移動中按反向鍵 → stopped=true、vx=0；停止下開火 accurate=true、residualSpeed≈0；移動中開火 accurate=false、residualSpeed=|vx|。
- [x] **回歸**：WP-2/WP-3 決定性測試（納入 movement + 急停）仍綠（determinism 9/9）。
- [ ] 手動驗：移動 → 反向鍵急停 → 停止瞬間開火被標精準（T5 exit-gate 端到端手動驗一併做）。
- [x] `vitest run` + `tsc` 綠燈（99/99、tsc exit 0）。

## Definition of Done
- [x] 反向鍵立即停止；停止 gate 正確標記開火精準 + residualSpeed；決定性回歸綠。

## Commit
`feat(wp-5): 簡化急停（立即停止 flag）+ gate 開火精準（FR-5.4）`
