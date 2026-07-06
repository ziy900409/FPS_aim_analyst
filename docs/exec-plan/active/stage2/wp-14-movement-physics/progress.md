# WP-14 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 complete

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 friction integrator | ⬜ |
| T2 velocity gate | ⬜ |
| T3 指標連續化 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| (無新 OQ;決定性 baseline 重錄授權由 GD-5 涵蓋,T0 驗證其存在) | — | — |

---

## Log

### 2026-07-06 — T0 entry gate PASS(baseline 重錄授權 + 測試盤點)
- **GD-5 證據**:[../../../DECISIONS.md](../../../DECISIONS.md) GD-5「六個決策點」第 4 點明確記錄:
  `WP-14 movement integrator 會改變決定性 baseline,屬預期 breaking change;先重驗 M1 決定性契約再重錄 baseline`。
  因此本 task 無需補寫全域決策。
- **決定性 baseline 需重錄清單**:
  - [../../../../../src/loop/__tests__/determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts):
    `GROUND = canonicalTrajectory(EXPECTED_TICKS)`;斷言形式為每 FPS 序列逐 tick `expect(s.snap).toEqual(GROUND[s.ticks - 1])`、
    最終狀態 `toEqual(expected)`、固定 tick 落點 `GROUND[0/1].vx` 與 `GROUND[1].x`。
  - [../../../../../tests/regression/determinism.test.ts](../../../../../tests/regression/determinism.test.ts):
    `CANON = canonicalRun(EXPECTED_TICKS)` / `GROUND = CANON.samples.map(...)`;斷言形式為逐 tick `toEqual(GROUND[...])`、
    `snapshot`/`phase` 對 `CANON` 深度相等、counter tick 內 `vx=0/stopped=true`、速度極值 `±250` 與 fire `residualSpeed=0`。
- **grep 盤點結果**:
  - 指令:`rg -n "position|\bvx\b|velocity|toEqual|toMatchSnapshot|toBeCloseTo|baseline|snapshot" tests src\loop src\sim -g "*.test.ts"`。
  - 除上述兩個 determinism baseline 外,另有會被 T1 新物理模型同步改寫的相鄰契約測試:
    [../../../../../src/sim/MovementController.test.ts](../../../../../src/sim/MovementController.test.ts)(M1 snap `vx=±250/0`、`x=250`、bit-exact 切分契約、急停 `stopped`),
    [../../../../../src/loop/SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts)(`simStep` 速度/位移、輸入落 tick 的 `vx`、recorder tick row、合成 drill event `residualSpeed`)。
    這兩檔不是 baseline 重錄檔,但 T1 必須改成 Source integrator 的解析契約。
- **MovementController 介面快照**:
  - CodeGraph context 顯示 [../../../../../src/sim/MovementController.ts](../../../../../src/sim/MovementController.ts) 公開介面為
    `step(state: SharedState, dtSec: number): void`;factory 為 `createMovementController(opts?: { vStrafe?: number }): MovementController`。
  - `codegraph_callers` 對 `MovementController.step`、`createMovementController`、`step` 皆回報 no callers(疑似 TS 介面/物件方法解析限制);
    以 CodeGraph context + 精確 grep 補證實 production 呼叫點:
    [../../../../../src/loop/SimLoop.ts](../../../../../src/loop/SimLoop.ts) module-level `defaultMovement = createMovementController()`、
    `simStep(..., movement: MovementController = defaultMovement, ...)` 內 `movement.step(state, dtSec)`、
    `createSimLoop(...)` 內綁定 `const movement = createMovementController()`。
    T1 的呼叫端零 diff DoD 以此清單為基準。
- **乾淨基準**:`npm.cmd test` exit 0;Vitest `38 passed` test files / `289 passed` tests(2026-07-06)。
- **Entry-gate 宣告**:T0 PASS。下一步 T1 可在不改公開 `step(state, dtSec)` 介面的前提下替換 integrator,並預期重錄上述 determinism baseline。
- **Decision Log**:CodeGraph caller 查詢結果不可單獨視為 caller 真相;T0 採「CodeGraph context + grep 精確呼叫點」作為介面快照證據。
- **Surprises & Discoveries**:`src/sim/MovementController.test.ts` 與 `src/loop/SimLoop.test.ts` 雖非 baseline 檔,但含 M1 snap 數值契約;T1 不應只重錄 determinism,還要主動改寫這兩檔的解析單測。
- **Open Questions**:無新增。

### 2026-07-03 — Valorant 接口決策(使用者拍板)
- **Valorant 移動不入本階段,只留接口**:T1 常數收斂為 `MovementProfile` 注入(`CS2_PROFILE` 預設)、
  T2 連續 velocity gate 為未來 Valorant 模式的直接繼承點;匯出斷代標記 `movementModel` 落 WP-16 T1。
- 依據分析:`MovementController` 已是注入式接縫(架構免改);真實成本在資料抽象 / 1D→2D / 單位校準——
  全數延後,WP-14 之後視研究立案另立 WP。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-14 表 + session 補充設計)展開為自足 task 檔(T0–T3 + T-exit)。
- 物理公式權威來源 = 規格附錄 D(Source ground-move:`SV_FRICTION 5.2` / `SV_ACCELERATE 5.6` / `SV_STOPSPEED 75` / vStrafe ≈ 250)。
- 已知 breaking:integrator 會改變逐 tick 軌跡,既有決定性 baseline **預期重錄**(先重驗 M1 契約再重錄,見 T1)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-5 重錄授權確認 + 決定性測試盤點,docs-only。
