# WP-1 — FPS 控制 + Pointer Lock

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-1（PLAN §5）— *FPS 控制 + Pointer Lock* |
| **里程碑** | 通往 **M1**（WP-2 需要 1.4 視角做 render 內插驗證） |
| **相依** | WP-0（exit-gate 綠燈） |
| **Type** | 前端互動（F3 的視角部分）：第一人稱視角 + 原始滑鼠輸入 |
| **Module / 觸及路徑** | NEW `src/render/SceneManager.ts`、`src/input/PointerLock.ts`、`src/view/CameraController.ts`、`src/ui/SettingsPanel.ts` |
| **必讀** | 規格 §2 ADR-5（Pointer Lock + 原始輸入 + coalesced）· 附錄 B（Pointer Lock 骨架）· [WP-0/T5 學習筆記](../wp-0-environment-setup/T5-reference-notes.md)（若已產出）· [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 2–3 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

提供可環顧四周的第一人稱視角，並確保滑鼠輸入是**原始、可重現**的（關 OS 加速）——這是後續量測 sensitivity 一致性的前提（ADR-5）。本 WP 只做「視角 + 控制 + 設定」，不碰急停 movement（屬 sim，WP-5），也不碰高頻採樣入緩衝（WP-3）。視角更新走 render/輸入路徑，與 sim 解耦。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-1.1** | `SceneManager` 建出可見封閉房間：地板、牆、光源、`PerspectiveCamera`。 | T1 |
| **FR-1.2** | Pointer Lock 整合：使用者手勢（click）觸發鎖定；Esc / 失焦自動解除並可重取。 | T2 |
| **FR-1.3** | `requestPointerLock({ unadjustedMovement: true })` 關 OS 加速；catch `NotSupportedError` 後 fallback 到一般 Pointer Lock。 | T3 |
| **FR-1.4** | yaw/pitch 視角：滑鼠 `movementX/Y` 累積到 camera 旋轉；pitch 夾角（±~89°）避免翻轉。 | T4 |
| **FR-1.5** | sensitivity / FOV 設定面板（DOM overlay，D1）：可調且即時生效。 | T5 |

### Non-functional Requirements

- **原始輸入可重現**：`unadjustedMovement` 成功時，相同物理滑鼠位移在不同 OS 加速設定下產生相同視角變化。
- **視角不抖**：本 WP 直接在 render/輸入更新視角即可；與 sim 內插（WP-2.3）邊界清楚——視角不經 sim accumulator。
- **UI = DOM overlay（D1）**：設定面板為純 TS + HTML/CSS，不引框架。

### Constraints

- **手勢限制**：Pointer Lock 必須由使用者手勢啟動（瀏覽器安全限制）。
- **`unadjustedMovement` 僅 Chromium**：須 catch `NotSupportedError`（ADR-5）。
- sensitivity 為設定值，不寫死（規格 §6 可維護性）。
- 不在 sim loop 內更新視角（雙迴圈邊界；sim 屬 WP-2）。

### Out of scope
- 急停 / A-D 橫移 movement（→ WP-5）。
- 高頻 `getCoalescedEvents` 採樣入 `SharedState` 緩衝（→ WP-3；本 WP 的滑鼠只驅動視角）。
- 目標 / 準心（→ WP-4）。

### Open Questions

> 全部於 **T0 鎖定（2026-06-30）**；ledger 見 [progress.md](progress.md)。

| ID | Question | 鎖定解法（T0 ✅） | Blocks |
|----|----------|---------|--------|
| **OQ-1.1** | sensitivity 單位／換算？ | ✅ 採 counts→radians 線性係數（`yaw += dx × sensitivity × k`），`k` 固定常數，sensitivity 使用者可調；數值校準延到 pilot。 | T4, T5 |
| **OQ-1.2** | 房間尺寸 / peek 距離？ | ✅ 佔位常數 10×10×3 m、目標距離 ~8 m；正式值由 WP-6 drill config 取代（technical debt）。 | T1 |
| **OQ-1.3** | 設定面板何時可見？ | ✅ 鎖定中隱藏、解除（Esc/失焦）時顯示；避免遊玩中誤觸。 | T5 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/render/SceneManager.ts     ← NEW (room/floor/walls/light/camera)                 [FR-1.1]
src/input/PointerLock.ts       ← NEW (requestPointerLock + unadjustedMovement + fallback + Esc/blur) [FR-1.2/1.3]
src/view/CameraController.ts   ← NEW (yaw/pitch 累積 + pitch clamp + sensitivity/FOV apply)          [FR-1.4]
src/ui/SettingsPanel.ts        ← NEW (DOM overlay: sensitivity/FOV sliders)            [FR-1.5]
src/main.ts                    ← MODIFY (接上述模組)
```

### Data flow

```
click on canvas → PointerLock.request() ──(success)──> pointerlockchange: locked
   try unadjustedMovement:true → catch NotSupportedError → 一般 requestPointerLock()   [FR-1.3]
locked 中：
   pointermove → CameraController.applyDelta(dx, dy)  → yaw/pitch 累積 + pitch clamp → camera.quaternion
   SettingsPanel slider → CameraController.setSensitivity()/setFov()  即時生效
Esc / blur → pointerlockchange: unlocked → 顯示 SettingsPanel，等待重取
```

### Interface contracts

```ts
// src/input/PointerLock.ts (FR-1.2/1.3)
export interface PointerLockHandle {
  request(): Promise<void>;           // 試 unadjustedMovement，失敗 fallback
  readonly locked: boolean;
  onChange(cb: (locked: boolean) => void): void;
  onMove(cb: (dx: number, dy: number) => void): void;  // 鎖定中的 movementX/Y
}

// src/view/CameraController.ts (FR-1.4/1.5)
export class CameraController {
  applyDelta(dx: number, dy: number): void;  // yaw += dx*sens*k; pitch = clamp(pitch - dy*sens*k, ±maxPitch)
  setSensitivity(s: number): void;
  setFov(deg: number): void;
}
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| `NotSupportedError` | 非 Chromium 或不支援 `unadjustedMovement` | catch → 一般 `requestPointerLock()`；progress.md 記降級（影響可重現性，需在 metadata 註記，WP-7） |
| Pointer Lock 被拒 | 無使用者手勢 | 只在 click handler 內呼叫；UI 提示「點擊以鎖定」 |
| pitch 翻轉 | 未夾角 | `clamp(pitch, -maxPitch, +maxPitch)`，maxPitch ≈ 89° |
| 失焦未解鎖殘留 delta | alt-tab | 監聽 `blur` / `pointerlockchange`，unlocked 時停止套用 delta |

### Concurrency model

無。視角更新為事件驅動（`pointermove`），同步套用到 camera。不涉 sim loop / worker。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `unadjustedMovement` 跨環境不一致 | Med | High（可重現性） | catch fallback；WP-7 metadata 記錄是否啟用原始輸入 |
| 視角與未來 sim 內插衝突 | Low | Med | 明確邊界：視角走輸入路徑、不入 sim；WP-2 內插只處理 player 位置 |
| sensitivity 數值無依據 | Med | Low | OQ-1.1 線性係數佔位，pilot 校準；設定可調 |
| Esc/失焦重取流程卡死 | Low | Med | 完整監聽 `pointerlockchange` + `blur`；T2 涵蓋 Esc 與重取 |

### Technical debt
- 房間/距離為佔位常數（OQ-1.2），正式值由 WP-6 drill config 取代。*Trigger*：WP-6 載入器就緒。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 WP-0 exit 綠燈（場景可跑 + isolation + backend）；鎖 OQ-1.1/1.2/1.3。 | WP-0 | Low | Low |
| **T1** SceneManager | [T1-scene.md](T1-scene.md) | room/floor/walls/light/camera 可見封閉房間（FR-1.1）。 | T0 | Low | Low |
| **T2** Pointer Lock 整合 | [T2-pointerlock.md](T2-pointerlock.md) | 手勢鎖定 + Esc/失焦解除/重取（FR-1.2）。 | T1 | Med | Med |
| **T3** 原始輸入 + fallback | [T3-raw-input-fallback.md](T3-raw-input-fallback.md) | `unadjustedMovement` + `NotSupportedError` fallback（FR-1.3）。 | T2 | Med | Low |
| **T4** yaw/pitch 視角 | [T4-yaw-pitch.md](T4-yaw-pitch.md) | 視角累積 + pitch 夾角（FR-1.4）。 | T3 | Low | Med |
| **T5** 設定面板 | [T5-settings-panel.md](T5-settings-panel.md) | sensitivity/FOV DOM overlay 即時生效（FR-1.5）。 | T4 | Low | Low |
| **T6 / T-exit** Exit gate | [T6-exit-gate.md](T6-exit-gate.md) | 點擊鎖定/Esc 解除/無 OS 加速/可調 sensitivity 全綠；交棒 WP-2/4。 | T1–T5 | Low | Low |

### Acceptance criteria（PLAN WP-1）→ task map
- [ ] 點擊鎖定、Esc 解除 → **T2**
- [ ] 無 OS 加速的視角（或 fallback 並記錄）→ **T3**
- [ ] 可環顧四周（yaw/pitch + 夾角）→ **T4**
- [ ] sensitivity/FOV 可調並即時生效 → **T5**

## Assumptions
- **A1**：WP-0 exit 綠燈，`createRenderer` seam 可用。
- **A2**：階段 A 鎖 Chrome/Edge，`unadjustedMovement` 多數情況可用；fallback 為例外路徑。
- **A3**：房間/距離佔位常數，正式值待 WP-6。
