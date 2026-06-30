# T4 — yaw/pitch 視角 + pitch 夾角

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T3 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/view/CameraController.ts`；MODIFY `src/main.ts` |
| **Status** | ✅ DONE（2026-06-30）|

## Objective
把 Pointer Lock 的 `movementX/Y` 累積成 yaw/pitch 旋轉並套到 camera；pitch 夾角避免翻轉（FR-1.4）。視角更新走輸入路徑，不入 sim（雙迴圈邊界）。

## In scope
- `CameraController.applyDelta(dx, dy)`：`yaw -= dx*sens*k`、`pitch = clamp(pitch - dy*sens*k, -maxPitch, +maxPitch)`，組成 quaternion 套到 camera。
- `PointerLock.onMove` → `applyDelta`。

## Out of scope
- sensitivity/FOV UI（→ T5；本 task 用預設常數）。
- 玩家位移（→ WP-5）。

## Design notes
- maxPitch ≈ 89°（`Math.PI/2 - ε`）。
- 用 yaw（繞世界 Y）+ pitch（繞 camera local X）組合，避免 roll：`camera.quaternion = qYaw * qPitch`。
- `k` 為 counts→radians 固定係數（OQ-1.1）；sensitivity 預設 1.0。

```ts
export class CameraController {
  applyDelta(dx: number, dy: number): void;
  setSensitivity(s: number): void;   // T5 用
  setFov(deg: number): void;         // T5 用
}
```

## Steps
- [x] 建 `CameraController`：yaw/pitch 累積 + clamp + quaternion 套用。
- [x] 串 `onMove` → `applyDelta`。
- [x] 驗：鎖定後可平順環顧四周；往上/下看不會翻轉（夾在 ±89°）。→ 一次性合成驗證：極端 dy 下 forward.y 夾在 ±sin(MAX_PITCH)、|y|<1、無 roll（right.y≈0）。
- [x] 驗：視角更新在事件路徑，未進任何 accumulator/sim（程式審查）。→ CameraController 只 import `three/webgpu`，無 sim 依賴；main 由 `onMove` 事件直接 `applyDelta`。
- [x] `tsc` 乾淨。

## Definition of Done
- [x] 可環顧四周；pitch 夾角生效不翻轉。→ yaw 方向正確、pitch 夾 ±89° 不翻轉（合成驗證全綠）。
- [x] 視角與 sim 解耦（無 sim 依賴）。→ 程式審查 + import 檢查確認。

## Commit
`feat(wp-1): yaw/pitch 視角 + pitch 夾角（FR-1.4）`
