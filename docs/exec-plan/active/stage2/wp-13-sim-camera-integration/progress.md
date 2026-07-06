# WP-13 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T1 ✅ 2026-07-06 recoil 進 sim;可開 T2 相機/彈道合成)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-06 |
| T1 simStep 佈線 | ✅ 2026-07-06 |
| T2 相機/彈道合成 | ⬜ |
| T3 彈孔 + overlay | ⬜ |
| T-exit(M6) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-4 `view_recoil_tracking` CS2 值(僅視覺;先做開關 + 可調常數,預設關) | ⬜ open(不阻塞) | — |
| OQ-13.1 spread RNG 的 `DEFAULT_RNG_SEED` 值與 drill seed 分流(drill.sequence.seed 兼用 or 獨立欄) | ✅ 定案(T1) | **drill.sequence.seed 兼用**:`createSimLoop` 新增 `seed = DEFAULT_RNG_SEED` 參數,rng = `createRan1(seed)` 於閉包持有;drill restart 走**重建 loop** 重置 stream。`DEFAULT_RNG_SEED = 1`(定於 [SimLoop.ts](../../../../../src/loop/SimLoop.ts))。**T1 未改 main.ts**(不在 Touches):seed 由 `drill.sequence.seed` 注入的佈線 + 每 run 記錄入 meta 交 T2/WP-16。無需新增 DrillConfig 欄。 |
| OQ-13.2 (新) 整合 golden 容差:雙率離散化使 sim 無法位元重現 WP-10 golden(單一 64Hz 時鐘) | 🟡 已緩解(T1) | 容差 0.01→**0.02°**(rawPunch);殘差為設計固有(見 Surprises)。是否需更緊 fidelity 交 WP-15 校準評估。 |

---

## Log

### 2026-07-06 — T1 PASS(recoil 進 simStep:64Hz 子節奏 + onFire/spread 掛線)

**接線正確性判準達成:sim 內 held 10 發 AK 重現 M5 向量;決定性 + 順序 + 回歸全綠。**

**Progress(切片):**
- **Slice A** [SharedState.ts](../../../../../src/state/SharedState.ts) + [types 註解]:新增 `recoilState: RecoilState`
  (sim 專屬,`resetState` 呼叫 `resetRecoilState` 原地歸零)+ `recoil: { prev, curr, lastSpread }`
  視覺內插快照(比照 position prev/curr)。[SharedState.test.ts](../../../../../src/state/SharedState.test.ts)
  reset 測試擴充涵蓋新欄 + 物件重用(GC 紀律)。
- **Slice B** [SimLoop.ts](../../../../../src/loop/SimLoop.ts):`simStep` 新增 `tickIndex`/`recoilRuntime`
  參數;順序 ①prev←curr(含 recoil 快照)②targets ③**偶數 tick recoilTick(1/64)** ④consume→產彈
  (`fireOneShot` 內先 `sampleSpread` 再 `recoilOnFire`)⑤movement ⑥curr←aimPunch ⑦record。
  `createSimLoop` 新增 `seed` 參數,建 `recoilRuntime = { table: generateRecoilTable(weapon.recoil),
  rng: createRan1(seed) }` + `tickIndex` 計數器。`recoilTick` **僅一處呼叫、帶常數 1/64**。
- 新測 [recoil-wiring.test.ts](../../../../../src/loop/__tests__/recoil-wiring.test.ts) 6 tests:順序
  (decay→kick forward = 手算、≠ reversed)、奇數 tick 不 decay、spread 暫存、整合 golden、決定性 ×2。

**驗證證據:** `npm run typecheck` exit 0;`npm run test` → **34 files / 256 tests passed**(前 250 + T1 6;
SharedState reset 測試就地擴充)。回歸零破壞(recoil 只寫新欄 + 消費 rng,不動 position/fire 排程/命中)。

**Decision Log:**
- **產彈點次序 = decay → sampleSpread → recoilOnFire**(對齊 CS2:spread 用本發 kick 前 inaccuracy)。
  Alternatives:kick 先於 spread(否決:CS2 首發 spread 不含本發 fire inaccuracy);spread 移 T2 取樣
  (否決:破壞 rng 序列位置決定性——序列消費必須在 sim 產彈點,T2 只消費暫存值)。
- **recoil 接線可選(`recoilRuntime` 省略即不接)**:`simStep` 直呼路徑(WP-2 決定性/單元測試)向後相容,
  punch 恆零、既有 250 測試零改動。Alternatives:無條件接(否決:直呼測試未帶 tickIndex/table,且
  `recoilTick` 對非 128Hz 節奏會誤觸)。
- **整合 golden 容差 0.01→0.02°**:見 Surprises;殘差為設計固有,0.02° = 目標 0.2%,仍攔得住真實接線錯誤。
- **OQ-13.1 定案**:`createSimLoop(seed = DEFAULT_RNG_SEED=1)`,drill.sequence.seed 兼用(見 ledger)。

**Surprises & Discoveries:**
- **雙率離散化相位差:sim 無法位元重現 WP-10 golden。** WP-10 golden([punch.test.ts](../../../../../src/recoil/punch.test.ts)
  `simulateAk47TenShot`)以**單一 64Hz 時鐘**跑,產彈於 elapsed 跨越 `k·cycletime` 的**衰減格點**
  (fire times 對齊 64Hz grid,末發 @0.90625s、58 decays)。而 sim 為 **128Hz 產彈排程 + 64Hz(偶數
  tick)衰減**:第 10 發落在**奇數** tick 115(fire tick 序列 0,12,25,38,51,63,76,89,102,115;
  parity E,E,O,E,O,O,E,O,E,O)——奇數 tick 無衰減,末發較 golden 少一次跨越衰減。實測 `rawPunchPitch
  = -10.194`(diff **0.0141°**)、`rawPunchYaw = -1.564`(diff 0.0039°)、recoilIndex=10。
  - **證明非 bug**:表 seed 223、kick 尺度、weapon 參數均與 golden 同源;殘差純為產彈排程離散化差異。
  - **排除的替代**:①奇數 tick 衰減 → **更差**(pitch diff 0.063、yaw 0.045);②末發後多跑 1 衰減 tick
    → 大幅偏離(-10.64)。偶數 tick + 末發即取樣為最接近解。
  - **硬約束鎖死**:GD-5 要求 recoil 衰減恆 1/64 步長(不得代入變動 dt),WP-11 固定產彈排程——兩者皆
    不可改,故相位差為設計固有,非可調參數。→ 容差 0.02°、記 OQ-13.2 交 WP-15 評估是否需更緊 fidelity。

**Open Questions:** OQ-S2-4(view_recoil_tracking,不阻塞)、OQ-13.2(容差/fidelity,已緩解,交 WP-15)。

**Next:** T2([T2-camera-ballistic-compose.md](T2-camera-ballistic-compose.md),High)——adapter 單點 deg→rad
+ pitch 符號翻轉、彈道方向注入(rawPunch=aimPunch×2 + `recoil.lastSpread`)、`setViewPunch` 每幀 compose;
含 main.ts seed 佈線(`drill.sequence.seed`)。

### 2026-07-06 — T0 entry gate PASS(三上游收斂驗證,docs-only)

**閘門結論:三上游全綠,無 blocker → 開放 T1。** `git diff --stat` 本 commit 不含 `src/`(僅本資料夾 docs)。

**1. 三上游 checklist 全 ✅ + exit-gate 證據連結:**

| 上游 | checklist | exit-gate 證據(該 WP progress) |
|---|---|---|
| **WP-10 M5** | [task-checklist.md](../wp-10-recoil-core/task-checklist.md) T0–T4 + T-exit 全 ✅ | **M5 golden 全綠 2026-07-05**:`vitest run` 30 files/208 tests(exit 0)、`src/recoil` 4 files/23 tests、typecheck pass、`Math.random` 於 `src/recoil` grep=0、`recoilTick` 呼叫點 dtSec 恆 1/64、兩份 golden fixture 在 repo。見 [wp-10 progress §Outcomes](../wp-10-recoil-core/progress.md)。 |
| **WP-11 exit** | [task-checklist.md](../wp-11-weapon-fire/task-checklist.md) T0–T3 + T-exit 全 ✅ | **連發決定性 2026-07-06**:[fire-determinism.test.ts](../../../../../src/loop/__tests__/fire-determinism.test.ts) 17 tests——60/144/240 FPS + 抖動序列下逐發 `{tick index, 排程時刻}` bit-exact;三把武器各驗;彈匣盡即停;無 `Date.now`/`Math.random` 洩漏。見 [wp-11 progress §T-exit](../wp-11-weapon-fire/progress.md)。 |
| **WP-12 exit** | [task-checklist.md](../wp-12-input-seams/task-checklist.md) T0/T1/T2 + T-exit 全 ✅ | **回歸全綠 2026-07-06**:typecheck exit 0、`vitest run` 33 files/250 tests(含 `HitDetector.test.ts` 13——raycastWithRay 等價測試、`CameraController.test.ts` 2——CS2 感度換算)。見 [wp-12 progress §T-exit](../wp-12-input-seams/progress.md)。 |

**2. 乾淨基準(接線前):** 本 branch(`wp-13-t0-entry-gate`,base=main d162f42)實跑 `npm run test` → **33 files / 250 tests passed(exit 0)**,3.07s。與 WP-12 exit 狀態一致,無回歸。

**3. 符號抽查(`codegraph_search`,全數存在且形狀正確):**

| 符號 | 位置 | signature |
|---|---|---|
| `recoilTick` | [punch.ts:67](../../../../../src/recoil/punch.ts) | `(s: RecoilState, dtSec: number): void` |
| `recoilOnFire` | [punch.ts:97](../../../../../src/recoil/punch.ts) | `(s, w: WeaponRecoilLike, table): void` |
| `sampleSpread` | [spread.ts:19](../../../../../src/recoil/spread.ts) | `(s, w, speedRatio, rng: Rng): SpreadSample` |
| `createRan1` | [rng.ts:13](../../../../../src/recoil/rng.ts) | `(seed: number): Rng` |
| `fireOneShot` | [SimLoop.ts:58](../../../../../src/loop/SimLoop.ts) | `(state, t, camera?, targetManager?, recorder?): void` |
| `SharedState.weapon` | [SharedState.ts:41](../../../../../src/state/SharedState.ts) | `{ nextFireT: number; ammo: number; magSize: number }` |
| `raycastWithRay` | [HitDetector.ts:45](../../../../../src/sim/HitDetector.ts) | `(origin: Vector3, dirNormalized: Vector3, targets): RaycastResult` |

**4. OQ-13.1 傾向已記 ledger**(drill.sequence.seed 兼用;`sequence.seed?: number` 已於 [DrillConfig.ts:29](../../../../../src/drill/DrillConfig.ts) 存在待消費,T1 定案)。

**Next:** T1([T1-simstep-recoil-wiring.md](T1-simstep-recoil-wiring.md),High risk)——tickIndex + 64Hz 子節奏 + onFire/spread 掛線 + prev/curr 快照。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;整合點承稽核 A2(punch 每幀重組)、
  A6(deg/rad + pitch 符號單點轉換)與研究計畫 Phase 2(視覺≠實際分離)。
- **M5 未過不得開工**(T0 把關);T1/T2 為 High risk,failure modes 見 README §3。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。