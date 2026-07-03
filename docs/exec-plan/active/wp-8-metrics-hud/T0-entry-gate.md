# T0 — Entry gate

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-5 ✅、WP-6 ✅、WP-7 ✅（M3） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | 🟡 M3 已宣告（2026-07-03）；T0 待翻 ✅（需先鎖 OQ-8.5 記錄契約） |

## Objective
確認 M3 達成（記錄 + 匯出）、WP-5 即時狀態 + WP-6 drill 控制可用，並**逐指標對照規格 §5** 確定每個指標的輸入欄位與公式（避免誤解）。鎖 OQ-8.1~8.5。

## Steps
- [ ] 確認 WP-7 snapshot/匯出可用、WP-5 velocity/stopped + WP-6 DrillRunner.restart/load 可用。**STOP：WP-7 T6 / M3 尚未完成；不得宣告 T0 PASS。**
- [x] 逐項對照 §5 8 指標 → 輸入欄位（ticks/events）與公式，記 progress.md。
- [x] 鎖 OQ-8.1：用 WP-7 snapshot（與匯出同源）。
- [x] 鎖 OQ-8.2：過衝 = velocity 過零後反向量近似。
- [x] 鎖 OQ-8.3：HUD 即時值集合。
- [x] 鎖 OQ-8.4：結果頁 = 數值卡 + 反應時間分布小圖。
- [ ] 鎖 **OQ-8.5**（準心資料契約，見下）：採 **B + C2**，補 fire 偏移 + 逐 tick 瞄準朝向。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M3 達成 ✅（2026-07-03）+ 8 指標輸入/公式對照 §5 完成 + OQ-8.5 契約鎖定；否則 STOP。
- OQ-8.1~8.5 翻 ✅。

## OQ-8.5 — 準心資料契約（DECISIONS GD-4 落地，採 B + C2）

> **背景**：M3 手動驗證（22,219 ticks 實跑）證實 `ticks[].crosshair` 恆為 `[0,0]`。依 CONTEXT.md:22（權威），準心恆置於螢幕正中央、純裝飾；真正的瞄準訊號是 **camera 正向射線**，「準心對齊偏移」是**開火事件**量（camera ray vs hitbox 中心的角度）。故 per-tick `crosshair:[cx,cy]` 語意為空。使用者拍板 **B + C2**。

**B — 準心對齊偏移記在 `fire` 事件（FR-8.1 直接來源，補 [progress.md](progress.md):44 缺口）**
- 擴充 `DrillEvent.fire`：`+ targetId?: string`、`+ offsetDeg?: number`（fire 當下 camera 正向射線與命中/瞄準 target hitbox 中心的夾角，度）。
- 產出點：[SimLoop.ts](../../../../src/loop/SimLoop.ts) fire 分支既有 `raycastFromCenter(camera, targets)` 已讀 camera + target，於同處算 `offsetDeg` 與帶出 `targetId`（sub-tick 忠實，ADR-8/開火 inline 評估；不新增決定性風險——fire hit 本就依賴 fire 當下 camera）。
- 供指標：**準心對齊偏移**（直接讀 `fire.offsetDeg`）、**切換時間**（`fire.targetId` 歸屬 kill→下一 acquisition）。

**C2 — per-tick 欄位改記 camera 朝向（逐 tick 瞄準軌跡）**
- `SharedState.crosshair:{cx,cy}` → **`aim:{yaw,pitch}`**（radians，對齊 [CameraController](../../../../src/view/CameraController.ts) 內部 yaw/pitch 狀態）。
- **plumbing 守 ADR-2 雙迴圈邊界**：`CameraController.applyDelta` 走 input/render 路徑，把 `yaw/pitch` 寫進 `SharedState.aim`（如同 `held` 由輸入寫、sim 讀）；`RingBuffer.recordState` / `SimLoop.recordTickFromState` **只讀 `SharedState.aim`**，sim 不伸手進 THREE camera 物件圖。
- **決定性不變**：aim 為 input 衍生的觀測量，不參與 movement（只依 held），不影響 tick index 對應狀態；決定性回歸（determinism.test.ts）須重跑確認未漂移。
- `TickRecord`：`crosshair:[number,number]` → `aim:[yaw,pitch]`（或 `{yaw,pitch}`）；`ticks.csv` 欄 `cx,cy` → `yaw,pitch`。

**文件對帳（本 task 或 T1 一併）**
- 更新 [`schema.md`](../../../operational/schema.md)：`fire` 加 `targetId`/`offsetDeg`；tick 欄位 crosshair→aim + 單位（radians）。
- **規格附錄 C** 仍寫 `crosshair` → 標分歧註記並回改附錄 C（CONTEXT 權威覆蓋，比照 GD-2 grill 對帳規則）。
- 落地順序：本 T0 鎖契約 → T1 隨指標計算實作 B+C2 的記錄端改動（動 `DrillEvent`/`SimLoop`/`SharedState`/`CameraController`/`RingBuffer`/`schema.md`）。

## STOP Note → CLEARED（2026-07-03）

- WP-5 ✅：`SharedState.player.stopped` / `vx` 可供 velocity HUD 與分類；fire event 已記 `residualSpeed` / `firstShot` / `hit`。
- WP-6 ✅：`DrillRunner.restart()` 與 `loadDrill()` 可用；開始/換 drill UI 仍屬 WP-8 T4。
- WP-7 ✅（**M3 達成 2026-07-03**）：`DataRecorder.snapshot()` + JSON/CSV export 已實作、文件化並經實機端到端驗證（22,219 ticks / 37 visible·21 counter·39 fire）。
- **先前阻塞已解除**：WP-7 T6 已宣告 M3、頂層索引 WP-7 ✅。**新增前置**：翻 T0 PASS 前先鎖 OQ-8.5（B+C2 記錄契約），使 T1 指標計算有正確輸入欄位。

## Commit
`docs(wp-8): T0 entry gate — 對照 §5 八指標 + 鎖 OQ-8.1~8.5（含 GD-4 準心契約 B+C2）`
