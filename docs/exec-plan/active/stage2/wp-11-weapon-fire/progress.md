# WP-11 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 entry gate 完成;T1 可開

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 WeaponConfig | ⬜ |
| T2 fire down/up | ⬜ |
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
