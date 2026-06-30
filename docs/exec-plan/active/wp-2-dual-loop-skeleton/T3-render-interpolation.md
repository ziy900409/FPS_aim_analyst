# T3 — Render alpha 內插

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2（也需 WP-1 camera） |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/loop/RenderLoop.ts`、`src/loop/RenderLoop.test.ts`；MODIFY `src/main.ts` |
| **Status** | ✅ DONE（2026-06-30）— tsc 0 + vitest 18 passed + vite build ✓ |

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
- [x] 建 `RenderLoop.ts`（純 rAF 排程器 + `lerp`；onFrame 收 nowMs，pump 編排在 main）。
- [x] `main.ts` 組合：rAF → `pump` → 唯讀內插 player → 套 camera 位置 → `SceneManager` render；camera 朝向由 `CameraController`。
- [~] 手動驗：高 FPS 下移動佔位 player 平滑不抖 → **需真鍵盤驅動位移（WP-3）**；延到 T5 exit-gate / WP-3 接上後補（見 progress Spot-check）。內插數學已單元測試。
- [x] 驗（審查 + 測試）：render 路徑只讀 `prev/curr`、不寫回 sharedState（程式審查 + 設計鎖定）。
- [x] `tsc` 乾淨（+ vitest 18 passed + vite build ✓）。

## Definition of Done
- [x] 雙迴圈整體可空跑（boot 無 error、閒置 player 在原點、render 唯讀內插 + camera 朝向跟手）。
- [x] render 唯讀（不改 sim 狀態），程式審查通過。
- [~] 高 render FPS 下內插平滑：路徑就緒、數學已測；**移動下的真人平滑度 spot-check 延至 WP-3 鍵盤就緒**（不靜默放行）。

## Commit
`feat(wp-2): RenderLoop rAF + alpha 內插（FR-2.3）`
