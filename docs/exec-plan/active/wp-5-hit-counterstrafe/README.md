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
| **FR-5.1** | `HitDetector`：Raycaster 從 camera 中心開火命中判定（命中/未命中 + 部位 head/body）。 | T1 |
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
| **OQ-5.1** | 「停止 gate 開火精準」具體判定？ | 階段 A 布林：開火當 tick 若 `stopped===true`（速度歸零 flag）→ 標記 `accurate=true` 並記 `residualSpeed≈0`；否則 `accurate=false` 記當下殘速。連續精準度模型留階段 B。 | T4 |
| **OQ-5.2** | 橫移速度上限 / 加速？ | 階段 A 簡化：按住 A/D 即達固定 `maxStrafe`（瞬時，無加速曲線）；反向鍵立即歸零。數值佔位，pilot 校準。附錄 D 常數留階段 B。 | T3 |
| **OQ-5.3** | peek 邊界（首發歸零點）？ | 以 WP-4 的 `t_visible`（新目標可見）為 peek 起點、擊殺/消失為終點；首發旗標在每次新目標可見時 reset。 | T2 |
| **OQ-5.4** | 命中即擊殺？ | 階段 A：命中 body/head 即擊殺 → 觸發 WP-4 `markKilled` → 生成對側。 | T1 |

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
  MovementController.step(state, dt):
      if 反向鍵觸發 → state.player.stopped=true; vx=0   (簡化急停, FR-5.4)
      else 依 held(A/D) 設 vx=±maxStrafe; x += vx*dt    (FR-5.3)
  若有 fire 事件：
      HitDetector.raycast(camera 中心, targets.hitboxes) → {hit, part}     (FR-5.1)
      accurate = state.player.stopped                                       (OQ-5.1)
      residualSpeed = |velocity| (停止則≈0)
      firstShot = firstShotGate(state, currentPeekId)                       (FR-5.2)
      若 hit → TargetManager.markKilled (WP-4) → 生成對側 + 新 peek/firstShot reset
      產出 fire 結果事件（供 WP-7 記錄 / WP-8 統計）
```

### Interface contracts

```ts
// src/sim/MovementController.ts (FR-5.3/5.4) — 介面跨階段不變（附錄 D 註）
export interface MovementController {
  step(state: SharedState, dtSec: number): void;   // 階段A: 立即停止; 階段B: friction integrator（同介面）
}
export function createMovementController(opts?: { maxStrafe?: number }): MovementController;

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
- **立即停止**取代真摩擦（FR-5.4）；**瞬時 maxStrafe**無加速（OQ-5.2）；**布林精準 gate**（OQ-5.1）。*Trigger*：階段 B 換 friction + acceleration integrator + 連續速度 gate（附錄 D），介面不變。

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
