# T5 — sensitivity / FOV 設定面板（DOM overlay）

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/ui/SettingsPanel.ts`；MODIFY `src/main.ts` |
| **Status** | ⬜ TODO |

## Objective
純 TS + DOM overlay（D1）的設定面板：sensitivity / FOV 滑桿，調整即時生效到 `CameraController`（FR-1.5）。面板鎖定中隱藏、解除時顯示（OQ-1.3）。

## In scope
- `SettingsPanel`：HTML/CSS overlay（兩個 `<input type=range>` + 數值顯示）。
- slider `input` 事件 → `CameraController.setSensitivity()/setFov()`。
- 訂閱 `PointerLock.onChange`：locked 隱藏、unlocked 顯示。
- sensitivity/FOV 值供 WP-7 metadata 讀取（暴露 getter）。

## Out of scope
- 持久化（localStorage）為非必要；可留 nice-to-have。
- 其他設定（drill 切換 → WP-8）。

## Design notes
- overlay 用絕對定位 `<div>` 蓋在 canvas 上，`pointer-events` 僅面板區；遊玩（locked）時 `display:none`。
- 即時生效：不需「套用」按鈕，`input` 事件直接呼叫 controller。

## Steps
- [ ] 建 `src/ui/SettingsPanel.ts`：DOM 結構 + CSS（最小樣式）。
- [ ] 綁 slider → `setSensitivity`/`setFov`，即時更新數值標籤。
- [ ] 綁 `onChange`：locked → 隱藏、unlocked → 顯示。
- [ ] 驗：拖動 sensitivity 後視角速度即時改變；FOV 即時改變。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] sensitivity/FOV 可調且即時生效（無需重載）。
- [ ] 面板隨鎖定狀態顯示/隱藏；值可被外部讀取（WP-7 預備）。

## Commit
`feat(wp-1): sensitivity/FOV DOM overlay 設定面板（FR-1.5）`
