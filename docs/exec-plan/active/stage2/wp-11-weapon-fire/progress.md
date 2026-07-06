# WP-11 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T2 fire down/up 完成;T3 可開

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 WeaponConfig | ✅ |
| T2 fire down/up | ✅ |
| T3 cycletime 產彈 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-6 彈匣盡行為(於 wp-10 T0 拍板,此處消費) | ✅ resolved | 轉錄自 [wp-10 progress](../wp-10-recoil-core/progress.md#open-questions-ledgert0-解決):2026-07-05 拍板「彈匣盡即停火,stage2 不做 reload;drill 一 peek ≤ 一匣」。WP-11 T3 scheduler 以 `ammo > 0` 為產彈條件,耗盡後停止產彈且不進 reload。 |
| OQ-11.1 單擊(down→up 極短)最少產 1 發的邊界(down 當 tick nextFireT 檢查) | ⬜ open | T3 設計時定案並測試 |

---

## Log

### 2026-07-06 07:32Z — T2 fire down/up PASS
- **修改檔案**:[types.ts](../../../../../src/state/types.ts) 將 input fire event 改為 `{type:'fire',down:boolean,t:number}`;[SharedState.ts](../../../../../src/state/SharedState.ts) 以 `EV_FIRE` 既有 `b` 欄 encode/decode `down` 並新增 `heldFire`;[InputSampler.ts](../../../../../src/input/InputSampler.ts) 新增 mouseup fire-up 與未鎖定 down gate;[SimLoop.ts](../../../../../src/loop/SimLoop.ts) fire-down 沿用既有單發 raycast/record,fire-up 只清 `heldFire`;[main.ts](../../../../../src/main.ts) 在 pointer-lock unlock 直接清 `sharedState.heldFire`。
- **測試補強**:[InputSampler.test.ts](../../../../../src/input/InputSampler.test.ts) 覆蓋 down/up、未鎖定 down 不採計、解鎖後 mouseup 仍送 fire-up;[consume.test.ts](../../../../../src/input/consume.test.ts) 覆蓋 fire down/up 與 key 交錯保序;[SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts) 覆蓋 `heldFire` 翻轉與 fire-up 不 raycast/不記 fire;既有 firstShot/HitDetector/determinism/harness fire fixture 改成 fire-down。
- **行為決策**:Sampler 只在已採計 fire-down 後送 fire-up;fire-up 不受 `isLocked()` gate,避免 Esc/失焦後 mouseup 被擋導致 stuck-fire,同時避免未鎖定 UI 點擊的 mouseup 污染 input ring。main 的 pointer-lock unlock guard 直接清 `heldFire`,不經 ring,符合 T2 task 的 UI 事件防護邊界。
- **Blast radius**:CodeGraph `InputEvent` impact=31 symbols,input/state/loop/sim/render/drill/testharness/tests;`InputRing` impact=22 symbols;`createInputRing` impact=3 symbols(`SharedState.ts` local);`createInputSampler` impact=4 symbols(`InputSampler.ts`/test/`main.ts`);`applyInput` impact=4 symbols(`SimLoop.ts` local through `simStep`/`createSimLoop`)。本切片是跨 input contract 的中等範圍變更,但 shooting behavior 仍維持 T3 前的 fire-down 單發。
- **Verification**:`npm.cmd test -- src/state src/input src/loop src/sim tests/regression/determinism.test.ts` → 12 files / 118 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd test` → 31 files / 222 tests passed;`npm.cmd run build` → pass(第一次 sandbox 內 Vite config resolution 因 access denied 失敗,提權重跑成功;仍有既有 bundle size warning);`graphify update .` → rebuilt 665 nodes / 1327 edges / 42 communities。

### 2026-07-06 07:19Z — T1 WeaponConfig PASS
- **新增檔案**:[WeaponConfig.ts](../../../../../src/weapon/WeaponConfig.ts) 定義 `WeaponConfig` 與 `validateWeapon`;[weapons.ts](../../../../../src/weapon/weapons.ts) 內建 `ak47` / `m4a4` / `m4a1s` 與 `getWeapon(id)`;[WeaponConfig.test.ts](../../../../../src/weapon/WeaponConfig.test.ts) 覆蓋合法 config、選填 `recoveryTransition`、缺欄/零 cycletime/非法 magSize/recoil range/getWeapon 未知 id。
- **資料決策**:三把的 recoil seed/magnitude/variance、angleVariance、cycletime、magSize、InaccuracyFire 使用 [README §2](README.md) 與 stage2 研究計畫表格。AK 的 stand/crouch/move/recovery 沿用研究計畫與 `patternViewer.ts` 既有 baseline。M4A4/M4A1-S 的 stand/crouch/move/recovery 目前 repo 內沒有獨立 vdata 表,先繼承同一 stage2 baseline 並在 `weapons.ts` 註解;WP-15 calibration 應補齊 per-weapon vdata 對照後再調整。
- **Blast radius**:T1 為新增 `src/weapon/` 模組 + WP-11 文件狀態更新;未修改既有 exported symbol,無既有呼叫端行為變更。
- **Verification**:`.\node_modules\.bin\vitest.cmd run src\weapon src\drill` → 5 files / 39 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd test` → 31 files / 218 tests passed;`npm.cmd run build` → pass(既有 bundle size warning);`graphify update .` → rebuilt 665 nodes / 1327 edges / 41 communities。

### 2026-07-06 07:11Z — T0 entry gate PASS
- **上游證據**:[wp-10 task-checklist](../wp-10-recoil-core/task-checklist.md) T1/T2/T3 皆為 ✅;[wp-10 progress](../wp-10-recoil-core/progress.md) 狀態為 M5 golden 全綠。
- **型別/模組證據**:`src/recoil/rng.ts` exports `Rng`;`src/recoil/recoilTable.ts` exports `WeaponRecoilParams`;`src/recoil/punch.ts` exposes `WeaponRecoilLike` with `cycletimeSec` + `inaccuracy.fire/recoveryTimeStand`;`src/recoil/spread.ts` exposes `WeaponInaccuracyLike` with stand/move/crouch shape. `npm.cmd run typecheck` passed (`tsc --noEmit`, exit 0).
- **CodeGraph evidence**:`codegraph_status` = 82 files / 841 nodes / 1336 edges. `codegraph_impact applyInput` affects `src/loop/SimLoop.ts` only (`applyInput`, `simStep`, `createSimLoop`). `codegraph_impact InputEvent` affects 31 symbols across input/state/loop/sim/render/drill/testharness tests. `codegraph_impact pushFire` returned "Symbol not found" because `pushFire` is an object-literal/interface method; fallback `codegraph_impact InputRing` affects 22 symbols and covers the `pushFire` contract surface.
- **EV_FIRE payload evidence**:[SharedState.ts](../../../../../src/state/SharedState.ts) currently encodes `pushFire: (t) => enqueue(EV_FIRE, t, 0, 0)`, so packed `b` is always 0 for fire. Enabling `b = down ? 1 : 0` keeps ring capacity/layout unchanged; T2 must update `dequeueInto` to set `view.down` for fire events.

#### Fire contract impact list for T2

| File | Why affected | T2 change note |
|---|---|---|
| `src/state/types.ts` | Owns `InputEvent`, `InputEventView`, `InputRing.pushFire`. | Change fire variant to `{ type:'fire'; down:boolean; t:number }`; change `pushFire(down,t)` signature and docs. |
| `src/state/SharedState.ts` | Implements packed ring encode/decode. | Encode `down` in `EV_FIRE` `b` slot; decode `view.down = b === 1`; add `heldFire` field/reset in T2. |
| `src/state/inputRingTestUtil.ts` | Test helper encodes/snapshots logical `InputEvent`. | Pass `ev.down` into `pushFire`; snapshots preserve `{down,t}` for fire. |
| `src/state/InputRing.test.ts` | Directly asserts fire ring payload and overflow behavior. | Update `pushFire` calls and expected fire snapshots to include `down:true/false`; add decode assertion for `b` payload. |
| `src/state/SharedState.test.ts` | Uses `pushEvent({type:'fire'})` through helper. | Add `down:true` to fire fixture; add `heldFire` reset assertion if T2 touches reset. |
| `src/input/InputSampler.ts` | Browser event producer currently sends only mousedown fire. | Change mousedown to `pushFire(true,t)`; add mouseup `pushFire(false,t)`; pointer-lock unlock guard emits fire-up if held. |
| `src/input/InputSampler.test.ts` | Existing mousedown assertion expects `{type:'fire',t}`. | Expect `{type:'fire',down:true,t}`; add mouseup and unlock stuck-fire tests. |
| `src/input/consume.ts` | Delivers reusable `InputEventView` to handlers. | No algorithm change expected, but depends on `dequeueInto` setting `down` before callback. |
| `src/input/consume.test.ts` | Contract test around delivered `InputEvent`. | If fire fixtures are present/added, assert `down` survives consume. |
| `src/loop/SimLoop.ts` | `applyInput` currently treats any fire event as immediate shot. | T2 should consume `down/up` into `state.heldFire`; T3 moves repeated shot production into cycletime scheduler. |
| `src/loop/SimLoop.test.ts` | Pushes fire input and asserts recorded fire event. | Update fire fixture to `down:true`; later T3 adjusts immediate-vs-scheduled shot expectations. |
| `src/loop/__tests__/determinism.test.ts` | Synthetic `InputEvent[]` includes fire events. | Add `down:true` for fire-down events; add matching up only if scenario holds fire across ticks. |
| `tests/regression/determinism.test.ts` | Synthetic `InputEvent[]` includes fire events. | Same as loop determinism fixture: update fire event shape, preserve deterministic assertions. |
| `src/sim/firstShot.test.ts` | Directly calls `state.input.pushFire(t)`. | Update to `pushFire(true,t)` for single-shot fixtures; T3 may add fire-up when held behavior matters. |
| `src/sim/HitDetector.test.ts` | Directly calls `state.input.pushFire(t)`. | Update to `pushFire(true,t)` and preserve hit/miss raycast assertions. |
| `src/testharness/fpsTestHarness.ts` | Encodes harness `InputEvent` and `fire` actions. | Pass `ev.down` through; default action-generated fire should become fire-down, with T3 deciding whether action also queues up. |

#### Fire-like output events not part of this InputEvent contract

`src/data/*`, `src/metrics/*`, `tests/e2e/full-drill.spec.ts`, and `tests/validity/reaction-time.test.ts` also contain `type:'fire'`, but those are recorded/exported drill events (`hit`, `firstShot`, `residualSpeed`, target metadata), not input-ring fire events. T2 should not add `down` to those output payloads unless a later WP explicitly changes the export schema.

- **Docs-only verification**:`git diff --stat` for this slice is limited to `docs/exec-plan/active/stage2/wp-11-weapon-fire/`; no `src/` changes.

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;補齊稽核 A5 缺口(無 WeaponConfig、無 cycletime、無 full-auto)。
- 關鍵契約:fire down/up 走 `EV_FIRE` 既有閒置 b 欄;產彈排程累加制;產彈點 = WP-13 recoil 掛點 seam。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。
