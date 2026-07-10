# WP-11 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ 完成 — full-auto 管線決定性驗證 + WP 收斂(2026-07-06)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 WeaponConfig | ✅ |
| T2 fire down/up | ✅ |
| T3 cycletime 產彈 | ✅ |
| T-exit | ✅ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-6 彈匣盡行為(於 wp-10 T0 拍板,此處消費) | ✅ resolved | 轉錄自 [wp-10 progress](../wp-10-recoil-core/progress.md#open-questions-ledgert0-解決):2026-07-05 拍板「彈匣盡即停火,stage2 不做 reload;drill 一 peek ≤ 一匣」。WP-11 T3 scheduler 以 `ammo > 0` 為產彈條件,耗盡後停止產彈且不進 reload。 |
| OQ-11.1 單擊(down→up 極短)最少產 1 發的邊界(down 當 tick nextFireT 檢查) | ✅ resolved | T3 定案:consume 每個 input event 前先排程到 event.t,fire-down 套用後立即排程到同一 event.t,再繼續處理後續事件;因此 down→up 落同 tick 時,down 先產 1 發,up 再清 heldFire。測試:`down→up 落同 tick 仍以 fire-down 時刻產 1 發（OQ-11.1）`。 |
| OQ-11.2 `ammo` 重置邊界(每 peek/spawn vs 整 drill 共用一匣) | ✅ resolved | 2026-07-06 CONTEXT.md grill 拍板:**`ammo` 於每個 peek / 每次目標 spawn 重置回 `magSize`**(每 peek 一整匣、噴射獨立、左右 peek 可對照,不被殘彈污染);「drill 一 peek ≤ 一匣」(OQ-S2-6)由此成立。T3 scheduler 應於 spawn 時 `ammo = weapon.magSize`。理由:整 drill 共用一匣會讓後段 peek 缺彈,污染首發/節奏/左右對稱等量測指標。同步記於 [CONTEXT.md](../../../../../CONTEXT.md) §G 彈匣政策。 |

---

## Log

### 2026-07-06 — T-exit 連發決定性 + 回歸全綠 PASS(WP-11 收斂）

**Outcomes**

- **新增檔案**:[fire-determinism.test.ts](../../../../../src/loop/__tests__/fire-determinism.test.ts) — full-auto 產彈決定性回歸(比照 [loop determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts) 模式,補上 fire 維度)。按住左鍵不放(`FIRE_DOWN_MS=50`,不推 fire-up),由 `scheduleFire` 依 cycletime 累加連發至彈匣盡;不注入 camera/target/drillRunner(彈匣不被 spawn 重置),以 `DataRecorder` 記錄逐發事件。逐發**出彈 tick index**由記錄的 tick 邊界回推(**非計算**,故為實跑結果)。斷言:60/144/240 FPS + 抖動 144 FPS ±50% 序列下,逐發 `{tick index, 排程時刻}` 序列與 canonical(每幀一 tick)**逐位 bit-exact 一致**;三把武器(AK-47 100ms/30、M4A4 90ms/30、M4A1-S 100ms/20)各驗;canonical 斷言彈匣盡即停(shots=magSize、ammo=0、heldFire=false)、首發於按下時刻、累加制 span=(mag−1)·cycletime;重播 bit-exact(無 `Date.now`/`Math.random` 洩漏)。共 17 tests。
- **決定性根源守護**:此測試釘死 README §3 / stage2 §2.6 failure-mode「`nextFireT = now + cycletime` 重設制 → 排程漂移,pattern 全歪」——任何把 frame delta / rAF 幀邊界偷渡進產彈排程的改動會使不同 FPS 的出彈 tick index 序列分歧 → 紅燈擋下。span 斷言為**精確** `(mag−1)·cycletime`(累加制無漂移),較 T3 DoD 的「2900ms ± 1 tick」更緊。
- **Verification**:`npm.cmd test -- src/loop/__tests__/fire-determinism.test.ts` → 17 tests passed;`npm.cmd run typecheck` → exit 0;`npm.cmd test`(全套)→ **32 files / 243 tests passed**(較 T3 的 31/226 +1 file/+17 tests,無回歸紅燈)。
- **手動驗證(dev server)**:本 session 為非互動環境,無法實際驅動瀏覽器 pointer-lock/滑鼠。DoD 的兩項手動目標行為改以**程式碼 + 自動化測試**佐證:①「鎖定後按住左鍵 → 連發至 30 發停」= [fire-determinism.test.ts](../../../../../src/loop/__tests__/fire-determinism.test.ts) canonical(AK 恰 30 發、ammo=0、heldFire 自動解除)+ [SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts)「AK held 3.0s 恰 30 發且 span 2900ms」;②「Esc 解鎖不卡連發」= [main.ts:179-183](../../../../../src/main.ts) pointer-lock unlock 直接清 `heldFire`+`nextFireT=Infinity` + [InputSampler.test.ts:172](../../../../../src/input/InputSampler.test.ts)「已採計 fire-down 後即使解鎖,mouseup 仍送 fire-up(stuck-fire 防護)」。**互動式瀏覽器實跑留待有 GUI 的 session 補做**,不在此宣稱已人工實測。
- **WP 收斂**:[README.md](README.md) 狀態、[task-checklist.md](task-checklist.md) T-exit、[../README.md §3](../../../completed/stage2/README.md) WP-11 皆翻 ✅。

### 2026-07-06 07:42Z — T3 cycletime 產彈 PASS
- **修改檔案**:[SharedState.ts](../../../../../src/state/SharedState.ts) 新增 `weapon:{nextFireT,ammo,magSize}`,create 預設 AK,reset 原地保留目前 `magSize` 並回滿 ammo;[SimLoop.ts](../../../../../src/loop/SimLoop.ts) 抽出 `fireOneShot` 作為唯一產彈點,`applyInput` 僅維護 `heldFire`/首發排程,`scheduleFire` 以 `cycletimeSec*1000` 累加制產彈並在 ammo=0 時停火,`createSimLoop` 依注入武器同步 `magSize`;[TargetManager.ts](../../../../../src/sim/TargetManager.ts) 依 OQ-11.2 在每次 spawn 回滿 `ammo = weapon.magSize`;[main.ts](../../../../../src/main.ts) 注入 `getWeapon('ak47')`,pointer unlock 同步清 `nextFireT`。
- **測試補強**:[SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts) 覆蓋 OQ-11.1 down→up 同 tick 單擊、AK held 3.0s 恰 30 發且 span 2900ms、空彈匣放開再按不補彈、M4A1-S 注入 20 發彈匣;[TargetManager.test.ts](../../../../../src/sim/TargetManager.test.ts) 覆蓋每次 spawn 依當前 `weapon.magSize` 回滿 ammo;[SharedState.test.ts](../../../../../src/state/SharedState.test.ts) 覆蓋 weapon reset 原地重用;[determinism.test.ts](../../../../../tests/regression/determinism.test.ts) 將舊單發 fixture 改成 down→up,避免 full-auto scheduler 把 fire-down 解讀成持續按住。
- **行為決策**:T3 scheduler 不是單純 consume 後一次跑到 tickEnd,而是依 input event 序列切段:事件前補發至 `ev.t`,fire-down 武裝後立刻排程至 `ev.t`,最後再排程到 `tickEndMs`。此設計保留 tick 內 full-auto,同時鎖定 down→up 同 tick 至少 1 發。fire record 的 `t` 改為排程時刻,不是 input event 時刻;已在 `fireOneShot` 註記 WP-16 schema v2 對帳點。
- **Blast radius**:CodeGraph `createSimLoop` impact=2 symbols(`SimLoop.ts` local);`applyInput` impact=4 symbols(`SimLoop.ts` local through `simStep`/`createSimLoop`);`createSharedState` impact=18 symbols(state/tests/main/harness/regression);`createTargetManager` impact=16 symbols(TargetManager/drill runner/main/harness/regression/tests)。本切片跨 state/loop/sim/main/test,但輸入 ring contract 不變;`raycastFromCenter` 在 `SimLoop.ts` 僅剩 `fireOneShot` 內一個呼叫點。
- **Verification**:`npm.cmd test -- src/state src/loop src/sim tests/regression/determinism.test.ts` → 10 files / 101 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd test` → 31 files / 226 tests passed;`npm.cmd run build` → pass(sandbox 內 Vite config resolution 因 access denied 失敗過,提權重跑成功;仍有既有 bundle size warning);`graphify update .` → rebuilt 668 nodes / 1342 edges / 42 communities。

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

- **Docs-only verification**:`git diff --stat` for this slice is limited to `docs/exec-plan/completed/stage2/wp-11-weapon-fire/`; no `src/` changes.

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../../../completed/stage2/README.md))展開;補齊稽核 A5 缺口(無 WeaponConfig、無 cycletime、無 full-auto)。
- 關鍵契約:fire down/up 走 `EV_FIRE` 既有閒置 b 欄;產彈排程累加制;產彈點 = WP-13 recoil 掛點 seam。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。
