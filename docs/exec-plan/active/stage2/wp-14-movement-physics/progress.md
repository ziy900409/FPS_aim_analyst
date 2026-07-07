# WP-14 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ WP complete(2026-07-06,T-exit 過門)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 friction integrator | ✅ |
| T2 velocity gate | ✅ |
| T3 指標連續化 | ✅ |
| T-exit | ✅ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| (無新 OQ;決定性 baseline 重錄授權由 GD-5 涵蓋,T0 驗證其存在) | — | — |

---

## Log

### 2026-07-07 — 下游對帳回填(WP-16 T-exit 收斂殘速連續欄)

- T3「帶著走的決定」(真殘速連續欄/停火時序對齊排 WP-16 schema v2 對帳)已於下游收斂:
  [WP-16 T-exit](../wp-16-metrics-export-v2/progress.md)(§4)確認 fire 事件 `residualSpeed: number`(連續 u/s)為 schema v2 必填欄,
  匯出/CSV/JSON 全鏈路齊,本 WP T3 的連續殘速統計(mean/p50/SD)即讀此欄。**殘速連續欄落位確認,對帳點收斂。**
- 仍延後(非 WP-16 交付):獨立 `t_velocity_zero` 事件欄未入 v2(v2 fire 鎖 8 具名欄);若研究需要屬 additive 擴欄,不再 bump。

### 2026-07-06 — T-exit gate PASS(真急停物理上線)
- **`npm run test:ci` exit 0**:`tsc --noEmit` 通過;Vitest `40 passed` test files / `298 passed` tests;Playwright `9 passed`(Edge,dev+preview isolation / backend / input-sampler / full-drill / overlay 全綠)。
- **baseline 重錄對帳**:T0 盤點清單 4 檔已於 T1 全數改寫(commit `112d6a6`)——
  [determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts)、[regression determinism](../../../../../tests/regression/determinism.test.ts)(baseline 重錄),
  [MovementController.test.ts](../../../../../src/sim/MovementController.test.ts)、[SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts)(相鄰解析契約改寫);
  T2(`6be8d59`)/T3(`417fb5e`)未再動 baseline。重錄理由已補記 [DECISIONS.md GD-5](../../../DECISIONS.md)「WP-14 T-exit 補記」列。
- **手感驗證(真 Edge,dev 5173)**:以 Playwright(`channel: msedge`)驅動 trusted 鍵盤事件,經 `__aimDebug` dev 縫逐 rAF 取樣 vx/stopped/HUD(probe 腳本臨時,未入 repo)。三觀察點:
  - ① **A/D 起步平滑升至 250**:111 筆中間態樣本(5<vx<245)單調不減,序列 `10.94 → 18.83 → 26.72 → 34.61 → …`(首 tick 與解析契約 10.9375 一致);t+505ms 首達 vx=250(accelerate 對 maxSpeed 截頂,~64 tick 收斂,與解析一致)。**非瞬跳**。
  - ② **反向鍵急停自然衰減穿越 88**:放 D 按 A 後 `228.91 → 208.67 → 189.25 → 170.63 → 152.76 → …`,17 筆 88–245 中間態;穿越點 `88.25(t+1377ms)→ 73.73(t+1381ms)`,距反向鍵 ~75ms ≈ 10 tick(73.73 與 T1 解析值 73.7299… 一致)。**非瞬停**。
  - ③ **HUD stopped 燈**:|vx|<88 樣本 142 筆全為 `STOP`/`stopped=true`、燈色 `rgb(126,231,135)`(#7ee787 綠);|vx|≥88 樣本 311 筆全為 `MOVING`/`stopped=false`。
- **規格 §5 回寫**:規格已為 v1.2 → 走「補節」:§5 分層註記後新增「階段 B(1)(2) 部分解除(WP-14)」——速度歸零誤差/過衝連續化解除、停火時序對齊仍以 `t_counter` 為代理(真 `t_velocity_zero` 隨 WP-16 schema v2 對帳)。
- **索引翻綠**:[../README.md §3](../README.md) WP-14 ✅;[task-checklist.md](task-checklist.md) 全 ✅(含 T0/T-exit 檔內狀態欄補翻)。
- **T-exit 附帶 code review(五軸,T1–T3 全 diff)**:Approve。發現(皆不擋線):
  - *Nit*:[main.ts](../../../../../src/main.ts) dev-only 急停 readout 的閂鎖註解仍描述 M1「stopped 只存活 1 tick」語意;連續模型下 `stopped` 為持續態(靜止恆 true),閂鎖已退化為恆亮。dev-only、production 剝除,建議後續順手改。
  - *Consider*:[ResultScreen.ts](../../../../../src/ui/ResultScreen.ts)(UI 層)直接 import `CS2_PROFILE`(sim 層)取 gate 門檻——單一來源正確;若未來 profile 可切換(Valorant),門檻應改經 metrics 層傳遞,避免 UI 綁死單一 profile。
  - *FYI*:velocity gate 擋下的 fire(幾何相交但 `accurate=false`)仍於目標近面寫彈孔——T2 Decision Log 已載明之設計(彈著回饋與擊殺判定分離),與 `hit=false` 並存為預期行為。
- **Outcomes(WP-14 交付了什麼)**:
  - Source friction/accelerate integrator(`MovementProfile` 注入、`CS2_PROFILE` 單一常數來源)取代 M1 snap,`step(state, dtSec)` 介面零 diff;
  - 開火精準 gate 升級連續速度模型(`accurate = |vx| < 88`,產彈點直讀 threshold 不依賴 stale `stopped`);spread movement term 接真速度;
  - 殘速/過衝指標連續 u/s(`Stat.p50` 進 metrics 層,結果頁連續數值 + gate 對照);
  - determinism baseline 重錄完成且證據可追(GD-5 補記 + T0 盤點對帳);
  - **M7 前置就緒**:WP-15 T1 可直接以本 WP 速度曲線對 `cl_showpos`。
- **Surprises**:Edge 實測觀測值與解析單測 bit-level 一致(10.94/73.73),probe 未發現 sim–render–HUD 鏈上任何偏差;達 250 實際 ~64 tick(截頂收斂)而非直覺的 128 tick,兩者與 T1 契約(128 tick 斷言 vx=250)相容。
- **帶著走的決定**:真 `t_velocity_zero` 事件(連續模型下有意義)的記錄與停火時序對齊語意升級,統一排 WP-16 schema v2 對帳,不在本 WP 提前擴欄。

### 2026-07-06 — T3 殘速/過衝指標連續化 PASS
- **實作**:
  - [../../../../../src/metrics/compute.ts](../../../../../src/metrics/compute.ts):`Stat` 新增 `p50`;`stat()` 仍保留原始 `values` 作為分布輸入,並以連續 fire `residualSpeed` 計算 mean / p50 / SD / n。
  - [../../../../../src/ui/ResultScreen.ts](../../../../../src/ui/ResultScreen.ts):殘速卡由 Phase-A 分類 headline 改為連續 `u/s` 數值;detail 顯示 `p50`、`SD`、`n` 與由 `CS2_PROFILE.accuracyThreshold=88` 衍生的 gate 對照。
  - 本 task 未修改 [../../../../../src/data/DataRecorder.ts](../../../../../src/data/DataRecorder.ts) 或匯出 schema;現有 fire event `residualSpeed` 已足夠支援 T3。WP-16 T1 仍負責 schema v2 對帳與欄位擴充。
- **測試**:
  - [../../../../../src/metrics/compute.test.ts](../../../../../src/metrics/compute.test.ts):新增 residualSpeed p50 / SD 解析對照與通用 `stat()` p50 測試。
  - [../../../../../src/ui/ResultScreen.test.ts](../../../../../src/ui/ResultScreen.test.ts):更新結果卡斷言,確認畫面摘要含 `62.5 u/s` 與 `p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate`。
- **驗證**:
  - 指令:`npm.cmd test -- src/metrics/compute.test.ts src/ui/ResultScreen.test.ts src/metrics/MetricsDashboard.test.ts` → Vitest `3 passed` test files / `9 passed` tests。
  - 指令:`npm.cmd test` → Vitest `40 passed` test files / `298 passed` tests。
- **Decision Log**:
  - 將 `p50` 放進通用 `Stat` 而非只為 `residualSpeed` 增加專用欄位。Alternatives Considered:只在 ResultScreen 內從 `values` 即時計算 p50,但 metrics 層才是 §5 指標統計的單一計算點,讓 p50 進 `Stat` 可避免 UI 重複計算。
  - ResultScreen 仍顯示 gate 對照,但只作為連續數值的 detail。Alternatives Considered:完全移除分類資訊;保留 gate count 有助於 T2 velocity gate 與 T3 連續 u/s 呈現對帳,且不回退成分類 headline。
- **Surprises & Discoveries**:
  - T2 後 DataRecorder 的 fire event `residualSpeed` 已足夠支援 T3;不需提前做 WP-16 schema v2 擴欄。
- **Open Questions**:規格 §5「指標分層解除」文字回寫仍依 task 註記排 T-exit,本 task 已在 progress 對帳。

### 2026-07-06 — T2 velocity gate 連續模型 PASS
- **相依確認**:[../wp-11-weapon-fire/T3-cycletime-scheduler.md](../wp-11-weapon-fire/T3-cycletime-scheduler.md) 狀態為 ✅；`fireOneShot` 已是唯一產彈點。
- **實作**:
  - [../../../../../src/loop/SimLoop.ts](../../../../../src/loop/SimLoop.ts):`fireOneShot` 改為以 `residualSpeed = |vx|` 與 `accurate = residualSpeed < CS2_PROFILE.accuracyThreshold` 判定 velocity gate；`state.player.stopped` 不再是產彈點權威來源。
  - `hit = accurate && result.hit`;移動超過 88 u/s 時，即使彈道中心射線幾何相交也不 `markKilled`，fire event 記 `hit=false` 且保留連續 `residualSpeed`。
  - spread movement term 改用同一 profile 來源:`speedRatio = residualSpeed / CS2_PROFILE.maxSpeed`。
  - [../../../../../src/state/SharedState.ts](../../../../../src/state/SharedState.ts):更新 `player.stopped` 註解，明確其為 HUD/相容觀察欄位，fire gate 直接讀同源 threshold + 即時速度。
- **測試**:
  - [../../../../../src/loop/SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts):新增 88 u/s 成對邊界測試，刻意讓 `stopped` 為 stale 反值，確認 fire gate 仍由即時 `|vx|` 決定。
  - 新增 spread 統計斷言:固定 seed 下 max-speed spread 半徑均值 / stopped spread 半徑均值 `> 3.5`。
  - 新增同 seed / 同速度序列重播測試，fire event(`hit` + `residualSpeed`)與 spread sample 完全一致。
  - 合成 drill 測試重錄:速度 `239.84375 u/s` 的中心射線開火改為 `hit=false`、不再擊殺目標，符合 gate。
- **驗證**:
  - 指令:`npm.cmd test -- src/loop/SimLoop.test.ts src/loop/__tests__/recoil-wiring.test.ts src/loop/__tests__/ballistic-compose.test.ts tests/regression/determinism.test.ts` → Vitest `4 passed` test files / `42 passed` tests。
  - 指令:`npm.cmd test` → Vitest `38 passed` test files / `287 passed` tests。
- **Decision Log**:
  - 產彈點直接讀 `CS2_PROFILE.accuracyThreshold`，而非 `state.player.stopped`。Alternatives Considered:`stopped` 已由 MovementController 同源寫入，但 fire 在 movement.step 之前讀上一 tick 末狀態，且 reset/test 可形成 stale flag；直接讀 `|vx|` 讓 gate 權威來源與 T2 定義一致。
  - T2 不新增 `accurate` 匯出欄位；現階段以 velocity gate 影響 `hit`，`residualSpeed` 仍是連續 u/s 欄位。Alternatives Considered:擴 `DrillEvent`/CSV 加 `accurate`，但 T2 明確把匯出擴欄留給 WP-16，避免本切片擴大 schema blast radius。
- **Surprises & Discoveries**:
  - T1 之後 `residualSpeed` 已是連續值，但 `accurate` 仍只計算後丟棄；T2 將其接入 `hit` gate 才讓 velocity gate 成為可觀察行為。
- **Open Questions**:無新增。

### 2026-07-06 — T1 friction/accelerate integrator PASS(baseline 重錄)
- **實作**:
  - [../../../../../src/sim/MovementController.ts](../../../../../src/sim/MovementController.ts):新增 `MovementProfile` / `CS2_PROFILE`，`createMovementController(profile = CS2_PROFILE)`，`step(state, dtSec)` 公開介面不變；每 tick 固定順序為 friction → accelerate → position。
  - `CS2_PROFILE = { friction: 5.2, accelerate: 5.6, stopSpeed: 75, maxSpeed: 250, accuracyThreshold: 88 }` 為 movement 物理常數單一來源；[../../../../../src/loop/SimLoop.ts](../../../../../src/loop/SimLoop.ts) 的 spread speed normalization 改讀 `CS2_PROFILE.maxSpeed`。
  - `player.stopped` 已改為 `|vx| < profile.accuracyThreshold`；反向鍵不再瞬停，改由物理自然減速穿越門檻。
- **解析對照單測**:
  - [../../../../../src/sim/MovementController.test.ts](../../../../../src/sim/MovementController.test.ts) 重寫為 T1 契約:起步第 1 tick `10.9375 u/s`、第 2 tick `18.828125 u/s`、128 tick 後 `vx=250` / `x≈211.33841717272932`、250 u/s 反向第 10 tick `vx≈73.72995854812224` 且 `stopped=true`。
- **baseline 重錄**:
  - [../../../../../src/loop/SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts):`simStep` 首 tick、輸入落 tick、recorder tick row 從 snap `250` 改為 ramp `10.9375`;合成 drill fire residualSpeed 重錄為 `239.84375`。
  - [../../../../../src/loop/__tests__/determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts):仍以 canonical per-tick 軌跡守 render-FPS 無關;顯式落點從 tick2 `vx=250/x=1.953125` 改為 `vx=10.9375/x=10.9375/128`。
  - [../../../../../tests/regression/determinism.test.ts](../../../../../tests/regression/determinism.test.ts):完整 sim baseline 改為連續速度;`stopped` 驗證改為 `|vx| < CS2_PROFILE.accuracyThreshold`;fire residualSpeed 改驗連續正值。
- **GD-5 對帳**:本次重錄依 [../../../DECISIONS.md](../../../DECISIONS.md) GD-5 第 4 點「WP-14 movement integrator 會改變決定性 baseline,屬預期 breaking change;先重驗 M1 決定性契約再重錄 baseline」執行。重驗結果:determinism targeted 測試通過。
- **驗證**:
  - 指令:`npm.cmd test -- src/sim/MovementController.test.ts src/loop/SimLoop.test.ts src/loop/__tests__/determinism.test.ts tests/regression/determinism.test.ts` → Vitest `4 passed` test files / `45 passed` tests。
  - 指令:`npm.cmd test` → Vitest `38 passed` test files / `284 passed` tests。
- **Decision Log**:
  - 保留 `step(state, dtSec)` 呼叫端零 diff；factory 改成 profile 注入是 T1 明定接口,呼叫端仍用預設 `CS2_PROFILE`。
  - `fireOneShot` 的 `accurate = state.player.stopped` 暫不改為直接讀 threshold，因 T2 明確負責 fire 側 accurate/residualSpeed 連續模型；T1 僅改 `stopped` 的寫入語意並讓 residualSpeed 自然反映真速度。
- **Surprises & Discoveries**:
  - 完整 sim regression 中，連續物理造成 `counter` 事件序列由 `A,D` 變成 `A,A,D`:第一次反向後殘速尚未過零，之後再次按 A 仍是合法 counter。已重錄 baseline 並在測試註解明確化。
- **Open Questions**:無新增。

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
