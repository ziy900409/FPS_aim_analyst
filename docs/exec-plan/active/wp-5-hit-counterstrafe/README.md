# WP-5 — 命中判定 + 簡化急停（F3）★M2

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-5（PLAN §5）— *命中判定 + 簡化急停（F3）* |
| **里程碑** | **M2 — 核心玩法成立**：能橫移、急停、開火、命中。 |
| **相依** | WP-3（輸入事件）、WP-4（目標 + hitbox） |
| **Type** | 模擬（F3）：橫移 movement + 簡化 counter-strafe + Raycaster 命中 + 首發判定 |
| **Module / 觸及路徑** | NEW `src/sim/MovementController.ts`、`src/sim/HitDetector.ts`、`src/sim/firstShot.ts`；MODIFY `src/loop/SimLoop.ts`、`src/state/SharedState.ts` |
| **必讀** | 規格 §5（速度歸零誤差 / 停火時序 / 首發命中率）· §2 ADR-3（sub-tick）· 附錄 D（階段 B physics 常數，本 WP 不實作）· §1.2 F3 · [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 2–3 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

F3：第一人稱 + CS 風格反向急停。階段 A 用**簡化「立即停止」判定**——反向鍵觸發即把速度視為歸零，以「停止」狀態 gate 開火精準。`MovementController` 處理 A/D 橫移（固定步長），`HitDetector` 用 Raycaster 從 camera 中心判命中，首發判定確保每循環只計第一發（不被掃射稀釋）。架構上 `MovementController` 介面須讓階段 B 能無痛替換為 friction + acceleration integrator（附錄 D）。完成即達 **M2：核心玩法成立**。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-5.1** | `HitDetector`：Raycaster 從 camera 中心開火命中判定（命中/未命中；**階段 A 單一 hitbox（H1）**、`part` 選填保留）。 | T1 |
| **FR-5.2** | 首發判定：每循環（peek）只計第一發為「首發命中率」分子來源。 | T2 |
| **FR-5.3** | `MovementController`：A/D 橫移（速度 + 位移，固定步長 sim）。 | T3 |
| **FR-5.4** | 簡化急停：反向鍵 = 立即「停止」flag；以停止 gate 開火精準（停止狀態下開火才算精準射擊）。 | T4 |

### Non-functional Requirements

- **固定步長 movement**：velocity/位移在 sim tick 推進（決定性，與 WP-2 相容），不依 render FPS。
- **介面跨階段不變**：`MovementController` 公開介面在階段 B 替換內部 physics 時不變（附錄 D 註）。
- **判定時間源**：開火/命中/急停的時間戳沿用輸入事件 `timeStamp` 與 sim tick 時間（ADR-4）。

### Constraints

- 簡化急停 = 反向鍵按下當 tick 即 velocity→0（立即停止 flag），非真實摩擦衰減（階段 A 範圍）。
- 開火命中走 **camera 中心射線**（準心固定螢幕中心，WP-4 T4）。
- 首發 = 每個 peek（一個目標可見週期）內第一個 fire 事件；後續 fire 不計入首發統計。
- movement 在 sim 內推進，消費 WP-3 的鍵盤事件（held 狀態）。

### Out of scope
- 真 CS2 physics（friction/accelerate/stopspeed，附錄 D）→ 階段 B。
- 速度 gate 精準度模型（v≈0 才精準的連續模型）→ 階段 B。
- 指標數值計算/呈現（→ WP-8，消費本 WP 產生的事件）。
- 資料記錄（→ WP-7）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-5.1** | 「停止 gate 開火精準」具體判定？ | 階段 A 布林：開火事件點若 `stopped===true`→`accurate=true`、`residualSpeed=0`；否則 `accurate=false`、`residualSpeed=|v|`。**velocity 二元 {0,±v} → 結果頁分類呈現**（grill）；連續精準度模型留階段 B。 | T4 |
| **OQ-5.2** | 橫移速度上限 / 加速？ | **已定（grill）**：瞬間 snap 到固定 `v_strafe`（無加速曲線）；反向鍵穿越 tick 歸零。`v_strafe` config 預設 **~250 u/s**（source unit）。附錄 D friction/accel 留階段 B。 | T3 |
| **OQ-5.3** | peek 邊界（首發歸零點）？ | **P2 推進（grill）**：`t_visible` 為 peek 起點、**第一次命中=kill** 為終點（未命中不推進、可補槍）；首發旗標每次新目標可見 reset。`peekTimeoutMs` 逾時未 kill→記 timeout、推進。`t_next_acquisition`=準心射線首次命中下一目標 hitbox。 | T2 |
| **OQ-5.4** | 命中即擊殺？ | 階段 A（P2）：**第一次命中即 kill** → 觸發 WP-4 `markKilled` → 生成對側（`spawnDelayMs` 預設 0）。 | T1 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/sim/MovementController.ts ← NEW (A/D 橫移 velocity/位移；急停 flag；介面預留階段 B)   [FR-5.3/5.4]
src/sim/HitDetector.ts        ← NEW (Raycaster camera 中心 → hitbox；命中+部位)          [FR-5.1]
src/sim/firstShot.ts          ← NEW (每 peek 首發旗標)                                    [FR-5.2]
src/loop/SimLoop.ts           ← MODIFY (simStep 串：consume 輸入 → movement → 急停 → 命中)
src/state/SharedState.ts      ← MODIFY (player velocity/stopped；peek/firstShot 狀態)
```

### Data flow（sim tick 內，ADR-2/3）

```
simStep(state, dt):
  consume 輸入(WP-3) → 更新 held(A/D) + 反向鍵事件 + fire 事件
  事件依 timeStamp 排序逐一處理（輸入分桶，WP-3）：
  MovementController.step（M1）：依 held(A/D) 定目標 velocity；**穿越方向那一 tick**（反向鍵新壓、與當前移動反向）→ vx **snap 0** + stopped=true（立即停止）；續按反向鍵 → 次 tick vx=∓v_strafe（反向/過衝）。x += vx*dt（瞬間 snap、無 accel）  (FR-5.3/5.4)
  開火事件**在串流該點 inline 評估**（準心/velocity 為 t_fire 當下值，sub-tick 忠實、零內插）：
      HitDetector.raycast(camera 正向射線, target.hitbox) → {hit}            (FR-5.1, H1 單一 hitbox)
      accurate = stopped；residualSpeed = |velocity|（階段 A 二元 {0,±v}）    (OQ-5.1)
      firstShot = firstShotGate(state, currentPeekId)                       (FR-5.2)
      若 hit → **第一次命中=kill** → TargetManager.markKilled (WP-4) → 生成對側（spawnDelay 預設 0）+ 新 peek/firstShot reset  (P2)
      產出 fire 結果事件（供 WP-7 記錄 / WP-8 統計）
```

### Interface contracts

```ts
// src/sim/MovementController.ts (FR-5.3/5.4) — 介面跨階段不變（附錄 D 註）
export interface MovementController {
  step(state: SharedState, dtSec: number): void;   // 階段A: 立即停止; 階段B: friction integrator（同介面）
}
export function createMovementController(opts?: { vStrafe?: number }): MovementController;  // 預設 ~250 u/s

// src/sim/HitDetector.ts (FR-5.1)
export interface FireResult { hit: boolean; part?: 'head' | 'body'; targetId?: string;
  accurate: boolean; residualSpeed: number; firstShot: boolean; t: number; }
export function raycastFromCenter(camera: THREE.Camera, targets: TargetState[]): { hit: boolean; part?: 'head'|'body'; targetId?: string };

// src/sim/firstShot.ts (FR-5.2)
export function firstShotGate(state: SharedState, peekId: string): boolean;  // 每 peek 第一次 true，其後 false
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| frame-dependent movement | 用 frame delta 推位移 | 只用固定 `dt`（sim tick）；回歸 WP-2 決定性 |
| 首發被掃射稀釋 | 連續 fire 都計首發 | `firstShotGate` 每 peek 只回 true 一次；T2 測試 |
| 急停判定漏接反向鍵 | held 狀態錯 | 反向鍵 = 與當前移動方向相反的鍵；以 held + 事件判定；T4 測 |
| 射線未命中近 hitbox | 射線/幾何不一致 | hitbox 與 mesh 同來源（WP-4 T1）；近距正對測試 |
| 階段 B 替換破介面 | 內部耦合外洩 | `MovementController.step` 為唯一公開點；命中/急停讀 `state.player.stopped/velocity` 抽象欄位 |

### Concurrency model
全部在 sim tick 內同步執行（consume → movement → 急停 → 命中）。無 worker。決定性沿用 WP-2。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **急停語意與階段 B 不一致導致介面要改** | Med | High | `MovementController` 公開介面只有 `step`；`stopped`/`velocity` 為抽象欄位；附錄 D 替換只動內部 |
| 首發統計錯誤 | Med | High | `firstShotGate` 綁 peek 生命週期（OQ-5.3）；T2 單元測試覆蓋多發/多 peek |
| movement 破壞決定性 | Med | High | 固定 dt；回歸 WP-2 + WP-3 決定性測試 |
| 命中判定誤差 | Med | Med | camera 中心射線 + 同來源 hitbox；正對/偏移案例測試 |

### Technical debt（自覺取捨）
- **立即停止**取代真摩擦（FR-5.4）；**瞬時 `v_strafe`**無加速（OQ-5.2）；**布林精準 gate** → 殘速二元、結果頁分類（OQ-5.1）。*Trigger*：階段 B 換 friction + acceleration integrator + 連續速度 gate（附錄 D），介面不變。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 WP-3/WP-4 exit ✅；鎖 OQ-5.1~5.4（急停/首發語意）。 | WP-3, WP-4 | Low | Low |
| **T1** HitDetector | [T1-hit-detector.md](T1-hit-detector.md) | Raycaster camera 中心命中 + 部位 + 命中即擊殺（FR-5.1）。 | T0 | Med | Med |
| **T2** 首發判定 | [T2-first-shot.md](T2-first-shot.md) | 每 peek 首發旗標，不被掃射稀釋（FR-5.2）。 | T1 | Med | Low |
| **T3** 橫移 movement | [T3-strafe-movement.md](T3-strafe-movement.md) | A/D 橫移（固定步長 velocity/位移）（FR-5.3）。 | T0 | Med | Med |
| **T4** 簡化急停 | [T4-simplified-counterstrafe.md](T4-simplified-counterstrafe.md) | 反向鍵立即停止 flag + gate 開火精準（FR-5.4）。 | T3 | Med | High |
| **T5 / T-exit** Exit gate（M2） | [T5-exit-gate.md](T5-exit-gate.md) | 橫移/急停/開火/命中/首發全綠；宣告 **M2**；交棒 WP-6/WP-7。 | T1–T4 | Med | Low |

### Acceptance criteria（PLAN WP-5 / F3 / M2）→ task map
- [ ] Raycaster 命中判定 + 部位 → **T1**
- [ ] 首發判定不被掃射稀釋 → **T2**
- [ ] A/D 橫移正確（固定步長）→ **T3**
- [ ] 急停停止狀態正確 gate 開火 → **T4**

## Assumptions
- **A1**：WP-3 輸入事件 + WP-4 目標/hitbox 可用。
- **A2**：階段 A 簡化急停（立即停止）+ 布林精準 gate；真 physics 為階段 B（介面不變）。
- **A3**：命中即擊殺 → 觸發 WP-4 對側生成（OQ-5.4）。
