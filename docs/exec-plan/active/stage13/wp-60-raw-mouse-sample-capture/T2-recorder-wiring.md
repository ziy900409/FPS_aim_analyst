# WP-60 T2 — SimLoop 接線與決定性證明

## Objective

把 T1 的契約接上真正的資料來源：在 `SimLoop` 消費輸入 ring 的**同一個點**逐筆錄製，並以逐位一致的證據證明它**沒有改變任何既有行為**。這是本 WP 唯一動到 sim 熱路徑的 task。

## Inputs to read

- [README.md](README.md) §2.2 Data flow（為何錄在消費點而非 `InputSampler`）、§2.5 決定性契約衝擊、§2.6 F1/F3/F6。
- [`SimLoop.ts:96-99`](../../../../../src/loop/SimLoop.ts#L96-L99)（既有 `accumulateMouse` 呼叫點）。
- `src/input/consume.ts` 與 `consume.test.ts`（半開窗 `[.., untilT)`、升冪無遺漏，GD-3 —— 這是 FR-60.7 結構性成立的依據）。
- 既有四 FPS parity harness：`tests/regression/spiderWideDeterminismFixture.ts` 與同族 determinism fixtures。
- D-57.T2-4（`Array.prototype.push` 計數手法）與其在 `spider-wide-schedule-invariants.test.ts` 的落地。

## Steps

1. 在 `SimLoop` 的 mouse 分支加**一行**：既有 `recorder?.accumulateMouse(...)` 之後呼叫 `recorder?.recordMouseSample(ev.dx, ev.dy, ev.t)`。**不改**既有呼叫的順序或參數，不改事件消費順序。
2. 依 OQ-60.3 在 Pointer Lock 狀態轉態時記錄事件（`PointerLock` 的 `pointerlockchange` → `main.ts` → `recorder.recordEvent()`）；drill 未進行時不記。
3. 接上容量：`DataRecorder` 建構時以 `mouseSampleCapacityForDrill(maxDrillSeconds)` 配置 arena。
4. **NFR-60.1 決定性**：既有四 FPS parity fixture 各跑「錄製開／關」兩組，斷言逐 tick `replayTargetId` + `tx/ty/tz` + `dYaw`/`dPitch` + spawn 序列**逐位一致**。
5. **FR-60.7 對齊**：斷言每個 tick 的 `dYaw` 等於「落在該 tick 窗內的原始樣本經 `resolveMouseGain()` 換算後的總和」—— 由同一批事件產生，故應逐位相符（浮點加總順序相同）。這條同時證明兩個資料流沒有分歧。
6. **NFR-60.2 零額外配置**：以 `Array.prototype.push` 計數包住 `tick()`，斷言開啟錄製後計數與關閉時**相同**。
7. **F3 溢位**：以極小容量建 recorder，驗證溢位時旗標為 true、`recorded === capacity`、tick 資料仍完整、`meta.suspect` 不變。
8. **F6 熱路徑**：以既有 frame log 對照「開／關」兩組的 p50/p95/p99 與掉 tick 數，記入 `progress.md`。
9. 跑全量 Vitest、typecheck ×2、`vite build`。

## Invariants

- 錄製為**唯寫旁路**：不回傳值給 sim、不讀 `state`、不改 `state`。
- 三迴圈邊界不變（ADR-2）：資料方向仍是 input loop 寫 ring → sim loop 讀 ring → sim loop 寫 recorder。**不新增跨迴圈通道**。
- `src/input/**` 不得 import `mouseSampleArena`；render 層不得讀它。
- 未 Pointer Lock 的移動仍**不採計**（KI-005 / A，FR-A-8）—— 本 task 不放寬。
- sim 內不新增任何時鐘讀取；時間戳一律沿用事件自帶的 `event.timeStamp`。

## Definition of Done

- [ ] 四 FPS parity fixture 的「開／關」兩組逐 tick trace **逐位一致**（測試檔名 + 案例名記入 `progress.md`；斷言用 `Object.is` 級比對，非 `toBeCloseTo`）。
- [ ] FR-60.7 對齊斷言通過：至少一組真實 run 的每個 tick，`dYaw` 與該 tick 窗內原始樣本的換算總和逐位相符。
- [ ] `Array.prototype.push` 計數在錄製開／關兩組**相同**（NFR-60.2）。
- [ ] 溢位情境：旗標 true、`recorded === capacity`、tick 數不變、`meta.suspect` 不變 —— 四條各一個斷言。
- [ ] Pointer Lock 轉態事件在真實載入路徑上被記錄（E2E 或 harness 證據，非只有單元測試）。
- [ ] frame-time p50/p95/p99 與掉 tick 數的「開／關」對照表記入 `progress.md`；差值符合 T0 定的門檻。
- [ ] 架構掃描：`src/input/**` 與 render 層對 `mouseSampleArena` 的 import 命中數為 **0**。
- [ ] 全量 Vitest 綠（數字記入 `progress.md`，並逐項歸屬與平行 session 的差額）；typecheck ×2 與 `vite build` exit 0。

## Commit

```text
feat(data): capture raw mouse samples on the sim consumption seam
```
