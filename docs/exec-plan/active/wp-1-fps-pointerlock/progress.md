# WP-1 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T0 通過（2026-06-30）— WP-0 地基確認 + OQ 鎖定，待執行 T1

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SceneManager | ⬜ 待執行 |
| T2 Pointer Lock | ⬜ 待執行 |
| T3 原始輸入 + fallback | ⬜ 待執行 |
| T4 yaw/pitch | ⬜ 待執行 |
| T5 設定面板 | ⬜ 待執行 |
| T6 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-1.1 sensitivity 換算 | ✅ 鎖定（T0, 2026-06-30）| `yaw += dx × sensitivity × k`，`k` = 固定 counts→radians 線性係數；sensitivity 使用者可調，數值校準延到 pilot。Blocks T4/T5。 |
| OQ-1.2 房間/距離 | ✅ 鎖定（T0, 2026-06-30）| 佔位常數 10×10×3 m、目標距離 ~8 m；正式值由 WP-6 drill config 取代（debt，trigger=WP-6 載入器就緒）。Blocks T1。 |
| OQ-1.3 設定面板可見時機 | ✅ 鎖定（T0, 2026-06-30）| 鎖定中隱藏、解除（Esc/失焦）時顯示，避免遊玩中誤觸。Blocks T5。 |

---

## Log

### 2026-06-30 — T0 Entry gate（確認 WP-0 地基 + 鎖 OQ-1.1/1.2/1.3）✅ PASS

**職責：** read-only 驗證 + docs。確認 WP-0 exit 綠燈、WP-1 bootstrap 所需 seam 存在、鎖定三個 OQ。**未碰任何 `src/` 程式。**

**PASS 條件逐項證據：**

| 檢查 | 方法 | 結果 |
|------|------|------|
| WP-0 exit 綠燈 | [WP-0/T6-exit-gate](../wp-0-environment-setup/T6-exit-gate.md) 狀態 | ✅ DONE（2026-06-30）；4/4 附錄 E 驗收勾選並有證據（WP-0 progress.md）|
| `createRenderer` seam 存在 | [src/render/createRenderer.ts](../../../../src/render/createRenderer.ts) | 存在；`createRenderer(canvas) → { renderer, backend }`，已被 [src/main.ts](../../../../src/main.ts) bootstrap 消費（L14）✅ |
| 空場景可跑 + console backend | WP-0/T6 e2e（真實 Edge） | `npx playwright test` **3 passed**：dev/preview `crossOriginIsolated===true` + 實際 backend=**webgpu** ✅ |
| 地基仍可編譯（本 session 重驗） | `npx tsc --noEmit` | **exit 0** ✅ |
| `src/` 自 WP-0 exit 未變動 | `git status --short` | 無 `src/` 條目（僅 docs/graphify-out）；綠燈狀態保持 ✅ |

**PASS 條件全成立**：WP-0 場景可跑 + `createRenderer` seam 存在 → 不需 STOP 回 WP-0，WP-1 可進入 T1。

**OQ 鎖定（見上方 ledger）：**
- **OQ-1.1**：sensitivity = `yaw += dx × sensitivity × k`，`k` 固定 counts→radians 係數，sensitivity 可調，數值待 pilot 校準。
- **OQ-1.2**：房間 10×10×3 m、目標距離 ~8 m（佔位常數，WP-6 drill config 取代 — 列為 technical debt）。
- **OQ-1.3**：設定面板鎖定中隱藏、解除時顯示。

**承接 WP-0 帶入的 WP-1 待決（OQ-T5.a/b/c，於後續 task 拍板，非 T0 範圍）：**
- OQ-T5.a pitch clamp 明確上下界（→ T4）；OQ-T5.b mouse event source（`mousemove` vs `pointermove`+coalesced，建議 app-owned adapter 隔離，→ T2/T3）；OQ-T5.c unlock 後鍵盤 latch 清除政策（→ T2，本 WP 滑鼠只驅動視角故影響小）。

**Next**：執行 **T1**（[T1-scene.md](T1-scene.md)）— `SceneManager` room/floor/walls/light/camera 可見封閉房間（FR-1.1），沿用 `createRenderer` bootstrap。

### （規劃）— WP-1 計畫產出
- 依 PLAN WP-1（1.1–1.5）+ 規格 ADR-5 + 附錄 B 展開為 T0–T6。
- 邊界釐清：視角走輸入/render 路徑，**不入 sim**（sim 屬 WP-2）；高頻採樣入緩衝屬 WP-3，本 WP 滑鼠只驅動視角。
- **Next**：WP-0 exit 綠燈後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
