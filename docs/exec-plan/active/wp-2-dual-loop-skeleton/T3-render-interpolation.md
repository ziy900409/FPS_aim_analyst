# T3 — Render alpha 內插

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2（也需 WP-1 camera） |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/loop/RenderLoop.ts`；MODIFY `src/main.ts` |
| **Status** | ⬜ TODO |

## Objective
rAF 渲染迴圈：每幀呼叫 `pump(now)` 推進 sim，取回 `alpha`，用 `lerp(prev, curr, alpha)` 內插 player 狀態後 render，高 render FPS 下畫面不抖（FR-2.3）。接 WP-1 視角。

## In scope
- `RenderLoop.ts`：`createRenderLoop(state, onFrame)`，rAF 驅動。
- `main.ts`：每幀 `const { alpha } = simLoop.pump(now); renderLoop` 用 alpha 內插 player 位置；camera 視角來自 WP-1（不經 sim）。
- 內插：`renderX = lerp(prev.x, curr.x, alpha)`（player 位置）。

## Out of scope
- 改 sim 狀態（render 唯讀）；目標渲染（→ WP-4）。

## Design notes
- **render 唯讀**：只讀 `prev/curr` 算內插值畫面，不寫回 `SharedState`。
- 視角（yaw/pitch）走 WP-1 輸入路徑、不內插（人眼對視角延遲敏感，且視角非 sim 狀態）；只有 player 位移內插。
- 高 FPS 不抖的判準：240 Hz render + 128 Hz sim，畫面平滑無階梯跳動。

## Steps
- [ ] 建 `RenderLoop.ts`（rAF + onFrame(alpha)）。
- [ ] `main.ts` 組合：rAF → `pump` → 內插 player → `SceneManager` render；camera 由 `CameraController`。
- [ ] 手動驗：高 FPS（>sim Hz）下移動佔位 player 物件，畫面平滑不抖。
- [ ] 驗（審查 + 測試）：render 路徑未修改 sim 狀態。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] 雙迴圈整體可空跑；高 render FPS 下內插平滑。
- [ ] render 唯讀（不改 sim 狀態），程式審查通過。

## Commit
`feat(wp-2): RenderLoop rAF + alpha 內插（FR-2.3）`
