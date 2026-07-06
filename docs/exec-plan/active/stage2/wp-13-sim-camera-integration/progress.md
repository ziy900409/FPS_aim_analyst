# WP-13 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T0 entry gate ✅ PASS 2026-07-06;三上游收斂,可開 T1)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-06 |
| T1 simStep 佈線 | ⬜ |
| T2 相機/彈道合成 | ⬜ |
| T3 彈孔 + overlay | ⬜ |
| T-exit(M6) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-4 `view_recoil_tracking` CS2 值(僅視覺;先做開關 + 可調常數,預設關) | ⬜ open(不阻塞) | — |
| OQ-13.1 spread RNG 的 `DEFAULT_RNG_SEED` 值與 drill seed 分流(drill.sequence.seed 兼用 or 獨立欄) | 🟡 傾向(T0) | **傾向 drill.sequence.seed 兼用**:單一 seed 同管 spawn 序列與 spread,匯出只記一值(對齊 README §2 契約 `createRan1(drill.sequence.seed ?? DEFAULT_RNG_SEED)`)。依據:`sequence.seed?: number` 已存在於 [DrillConfig.ts:29](../../../../../src/drill/DrillConfig.ts) 且註記「供未來隨機化」、目前未消費——WP-13 正是其消費者,無需新增欄。**T1 設計時定案**,`DEFAULT_RNG_SEED` 具體值 + seed 記錄交 WP-16 入 meta。 |

---

## Log

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