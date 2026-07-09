# WP-18 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 task 檔已展開,待實作(2026-07-09)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ PASS(2026-07-09;基線凍結 + OQ 收斂) |
| T1 motion drive | ⬜ |
| T2 sub-tick 命中內插 | ⬜ |
| T3 timed presentation + render 內插 | ⬜ |
| T4 tracking drill + 指標推導 spec | ⬜ |
| T5 決定性回歸 + 掛線 | ⬜ |
| T-exit(交付) | ⬜ |

---

## Open Questions ledger(T0 收斂)

| ID | 狀態 | 議題 / 起點 |
|----|------|-------------|
| OQ-18.1 motion 階層 | ✅ resolved (T0, 2026-07-09) | **T1 驅動集 = `linear` / `pingpong` / `sine`**(以 `age` 純函式演進)。`waypoints` **只淺驗形狀、不驅動**(schema 既有 `validateMotion`;點數下限/速度配套隨真實需求另立)。`static`/省略 motion 逐位不變(既有 drill 零破壞)。**`field-low` 走廊相容預設包絡**(單元界定,WP-22 T1 實戰對帳):`axis: 'horizontal'`、`range ∈ [0.5, 1.5] u`(擺盪半幅;pingpong/sine)、`speed ∈ [1, 4] u/s`;linear 行程 ≤ `range`。包絡極值已由 WP-19 `deriveTargetEnvelopes`→`expandForMotion`(range/axis)涵蓋(見下 WP-19 對帳),故淨空由既有驗證器把關,本 WP 不新增驗證碼。 |
| OQ-18.2 presentation 落點 | ✅ resolved (T0, 2026-07-09) | **新增 `timing.presentationMs`(additive optional),不複用 `peekTimeoutMs`**。理由:`peekTimeoutMs` 是 detection 的「peek→撤除」窗語意(目標到期消失);tracking 的 presentation 是「持續呈現移動、到期推進下一目標」的連續控制構念——語意不同,共用欄位會製造雙重語意。**命中不撤除機制**:追蹤 drill 於 DrillRunner **running 相位**推進純由 `presentationMs` 到期驅動;命中只記事件(不呼叫 `markKilled`、不 advance),目標在 presentation 窗內持續存活移動。落地細節在 T3。 |
| OQ-18.3 posPrev 快照落點 | ✅ resolved (T0, 2026-07-09) | **存 `TargetState.posPrev`(每目標,GC 紀律下物件重用)**,不另立 SimLoop 側平行結構。理由:motion drive 發生在 `TargetManager.tick`(擁有 `TargetState`),posPrev 與目標同置可避免額外 id→pos map、複用既有 preallocated 目標物件(不 push)。**快照時點 = motion drive 之前**(`simStep` line 338 `drillRunner.tick`/`targetManager.tick` 呼叫前);`posCurr` = drive 後 = tick 末位置。落案細節在 T2。 |
| OQ-S3-5 交付形狀對帳 | 🟡 blocked→本 WP 交付後解 | WP-22 T1 的對帳點:追蹤 drill config 型、motion 欄用法、presentation 時長、target render alpha 內插、`t_acquire`/TOT%/RMS ε 結果頁/匯出欄位。**T-exit 綠燈後回 [WP-22 T0](../../stage3/wp-22-perception-integration/T0-entry-gate.md) 重跑此對帳。**(形狀×task 對應表見下方 Log。) |

---

## Log

### 2026-07-09 — T0 entry gate ✅ PASS(上游 exit 驗證 + F5 seam 基線凍結 + OQ 收斂)

**Docs-only 切片**(唯一非 docs 觸點 = CLAUDE.md §4 硬約束回寫)。`git diff --stat` 不含 `src/`。

**① 上游 exit 可追溯**:
- WP-17(M8)✅ — 本 WP `README.md` 相依欄記 entry 兩條件皆達成 2026-07-07,門控解除。
- GD-7 拍板 ✅ — 追蹤指標定義 / 獲取-追隨分離 / raw-over-derived(見 [DECISIONS.md](../../../DECISIONS.md) GD-7)。
- **乾淨基準 exit 0**(T1 零破壞基線):
  - `npm run typecheck`(`tsc --noEmit`)→ **exit 0**。
  - `npx vitest run` → **58 test files / 438 tests passed**,exit 0。
  - `npx playwright test` → **11 tests(edge)passed**,exit 0。

**② F5 seam 現況基線凍結**(讀碼證據,T1/T2 零破壞參照;行號本次核對無誤):
- `TargetManager`:motion 於 spawn 寫入目標但**不驅動移動**([TargetManager.ts](../../../../src/sim/TargetManager.ts):33 註「階段 A 不驅動移動」;:117 `...(motion ? { motion: { ...motion } } : {})`);`age` **未累加**(spawn 時未設 `age`)。→ T1 把 seam 接活(每 tick 依 `age` 純函式更新 `pos`)。
- `HitDetector.raycastWithRay`:直接讀 `t.pos` 建 hitbox AABB([HitDetector.ts](../../../../src/sim/HitDetector.ts):84-85 `boxMin/boxMax.set(t.pos…)`),**無 sub-tick**。→ T2 內插注入點。
- `simStep`:目標系統步(`drillRunner.tick`/`targetManager.tick`)於 [SimLoop.ts](../../../../src/loop/SimLoop.ts):338-339,**位於命中判定(`scheduleFire`,:350-355)之前**(:335 註)。→ **motion drive 在此;posPrev 快照須在此呼叫之前擷取**。
- **既有命中/決定性回歸測試清單**(T1/T2 零破壞閘先跑對象):`src/sim/HitDetector.test.ts`、`src/sim/TargetManager.test.ts`、`src/sim/firstShot.test.ts`、`src/loop/SimLoop.test.ts`、`src/loop/__tests__/fire-determinism.test.ts`、`src/loop/__tests__/ballistic-compose.test.ts`、`src/loop/__tests__/recoil-wiring.test.ts`、`src/drill/DrillRunner.test.ts`、`tests/regression/determinism.test.ts`(16)、`tests/regression/spray-determinism.test.ts`(6)。

**③ 三條 OQ 收斂**:見上方 OQ ledger(OQ-18.1/18.2/18.3 皆 ✅ resolved,含明確集合/數值/落點)。

**④ WP-19 淨空包絡對帳結論**:移動目標運動包絡**已被 `deriveTargetEnvelopes` 涵蓋**——[clearance.ts](../../../../src/scene/clearance.ts):162 `expandForMotion` 依 `motion.range`+`motion.axis`(horizontal→x / vertical→y)向兩側擴張包絡,並處理 `waypoints`(:168);spawnArea 路徑另有 `expandSpawnAreaForMotion`(:179)。非有限邊界(NaN/±Inf)由 `assertFiniteEnvelope`(:86)擋下。**結論:WP-18 T1 選定的 range-based motion(pingpong/sine/linear via range+axis)之空間極值淨空由既有驗證器把關,本 WP 不新增驗證碼;WP-22 T1 首跑 `field-low` 實戰對帳**。互記:WP-19 側無待辦(motion 涵蓋已在 clearance 交付內)。

**⑤ OQ-S3-5 交付形狀 × task 對應表**(供 T-exit 回填 [WP-22 T0](../../stage3/wp-22-perception-integration/T0-entry-gate.md)):

| WP-22 T1 需要的交付形狀 | 交付 task | 形狀摘要 |
|---|---|---|
| 移動 target `pos` 每 tick 驅動 | **T1** | `age` 純函式驅動 `linear/pingpong/sine`;tick 決定性 |
| sub-tick 命中內插(FR-B17) | **T2** | `TargetState.posPrev` + fire 時間戳 `subAlpha` → `lerp(posPrev, posCurr, α)` |
| timed presentation 推進政策 | **T3** | `timing.presentationMs`(additive optional);命中不撤除 |
| target render alpha 內插 | **T3** | render-only,比照玩家/recoil `prev→curr` + SimLoop `alpha` |
| 追蹤 drill config 型 | **T4** | `src/drill/tracking_v1.ts`(移動目標 + timed presentation) |
| `t_acquire`/TOT%/RMS ε 欄位語意 | **T4** | `docs/operational/analysis-tracking.md` spec + round-trip fixture(離線推導,引擎零計算) |

**⑥ CLAUDE.md §4 回寫**:新增硬約束「移動目標位置一律以 `age`(sim tick 累加)驅動的純函式演進,不代入變動 dt、不讀時鐘」([CLAUDE.md](../../../../CLAUDE.md) §4,緊接 determinism bullet 之後)。

**Decision Log**:
- **OQ-18.2 新增 `timing.presentationMs` 而非複用 `peekTimeoutMs`**。Alternatives Considered:複用 `peekTimeoutMs`——否決:detection 的 peek 語意是「到期撤除目標」,tracking 是「到期推進但目標持續存活移動」,語意衝突會使 DrillRunner 相位機分支混亂並製造雙重語意;additive optional 新欄零破壞既有 detection/counter-strafe。
- **OQ-18.3 posPrev 存 `TargetState` 而非 SimLoop 平行結構**。Alternatives Considered:SimLoop 側 id→pos map——否決:額外配置 + 與 TargetState 生命週期不同步(spawn/kill 需雙寫),違反 GC 紀律(物件重用/不 push);posPrev 與目標同置由 TargetManager 單點維護。

**Surprises & Discoveries**:
- **WP-19 已預先涵蓋移動目標淨空**:原以為運動包絡對帳可能產生 WP-19 待辦,實測 `clearance.ts` 早已含 `expandForMotion`/`expandSpawnAreaForMotion`,range/axis/waypoints 三路皆處理且有 `assertFiniteEnvelope` 邊界防護——WP-18 T1 不需回頭補 WP-19 驗證碼,只需在單元界定 range 數值。
- **`age` 欄在型別已立但 spawn 未初始化**:`TargetState.age?` 為 optional 且 spawn 未寫入([types.ts](../../../../src/state/types.ts):171),T1 須在 spawn 設 `age: 0` 並每 tick 累加 `tickSec`,否則 `age` 為 `undefined` 導致 motion drive NaN。

**Open Questions / Next**:
- **Next**:T1 [T1-motion-drive.md](T1-motion-drive.md)(High risk)——把 `TargetManager.tick` 由「不驅動」接為每 tick `age` 純函式驅動 `pos`。**先跑上列既有命中/決定性回歸全綠再改**。改 `src/` 前先 `graphify update .` / `codegraph sync .`。
- OQ-S3-5 仍 blocked,待 T-exit 綠燈後回 WP-22 T0 重跑。

### 2026-07-09 — WP-18 展開(task 檔規劃;無程式碼)

**觸發**:stage3 [WP-22 T0](../../stage3/wp-22-perception-integration/progress.md) 因 WP-18 未交付而 blocked(OQ-S3-5 無交付形狀可對帳)。依「Deliver WP-18 first」決策,先展開並交付本 WP,再回 WP-22 重跑對帳。

**本切片產出(docs-only)**:由 stub 展開為自足 task 檔集——full [README.md](README.md)(範圍/契約/failure modes/task 索引)、[task-checklist.md](task-checklist.md)、本 progress、T0–T5 + T-exit 七個 task 檔。**未動 `src/`**。

**現況勘查(展開前讀碼證據,供 T0 正式凍結)**:
- **F5 seam 已備妥**:`TargetMotion` 型別在位([src/state/types.ts](../../../../src/state/types.ts) `TargetMotion`/`TargetState.motion`/`age`);`DrillConfig.targets.motion?` + `validateMotion` 已淺驗形狀([src/drill/schema.ts](../../../../src/drill/schema.ts))。`TargetManager` **已把 motion 寫入目標但不驅動移動**([src/sim/TargetManager.ts](../../../../src/sim/TargetManager.ts):33「階段 A 不驅動移動」;spawn 時 `...(motion ? { motion: {...} } : {})`)。→ T1 = 把 seam 接活。
- **sub-tick 尚未存在**:`raycastWithRay` 直接讀 `t.pos`([src/sim/HitDetector.ts](../../../../src/sim/HitDetector.ts):84),fire 於 `state.weapon.nextFireT` 時刻在 tick 窗內產彈但用 tick 末目標位置。→ T2 = FR-B17 的內插注入點。
- **schema v2 欄位已交付(WP-16)**:`TickRecord` 已含 `tx/ty/tz`(目標)+`px/pz`(玩家)+`aim`([src/data/RingBuffer.ts](../../../../src/data/RingBuffer.ts):12)。→ T4 追蹤指標推導輸入齊備,零 schema 斷代。
- **render 內插機制已存在**:玩家/recoil 走 `prev/curr` + SimLoop `alpha`([src/loop/SimLoop.ts](../../../../src/loop/SimLoop.ts):329/445)。→ T3 目標比照即可。
- **匯出 meta 已帶 motion**:[src/main.ts](../../../../src/main.ts):289 匯出 metadata 已含 `motion`/`seed`/`spawnArea`。→ drill 重現 metadata 免補。
- **drill registry**:[src/main.ts](../../../../src/main.ts):82-83 `drills` 陣列(counterstrafe JSON + detection TS const)。→ T5 掛 `tracking_v1`。

**Decision Log**:
- **任務切分(6 task + 兩 gate)**:T1 motion drive / T2 sub-tick 內插 / T3 timed presentation + render 內插 / T4 drill+指標 spec / T5 決定性回歸+掛線。Alternatives Considered:(a) 把 T1+T2 併為單一「移動目標 sim」task——否決:motion drive 與 sub-tick 內插各自是獨立高風險垂直切片,合併違反「一 task 一原子 commit」且放大 blast radius;(b) 把追蹤指標做成 sim 內線上計算——否決:GD-7 明列離線推導、零 sim 改動,線上會增 GC/延遲並製造第二真相源。
- **追蹤指標循 WP-21 T3 模式**:spec(`docs/operational/analysis-tracking.md`)+ `src/metrics` round-trip fixture,不進熱路徑。理由:GD-7 raw-over-derived + WP-21 已驗證此模式(detectionDerivation)。
- **WP-18 留在 stage2 folder 展開**(不搬 stage3):FR-B17/§1.3 階段 B 血統屬 stage2,且 WP-22 既有相對路徑 `../../stage2/wp-18-f5-subtick/` 指向此處;就地展開保留所有交叉引用。

**Surprises & Discoveries**:
- WP-18 的引擎交付面比字面小:schema v2 欄位(T4 輸入)與 render prev/curr 機制(T3)皆 WP-16/既有已備,motion 型別也已立——真正的新 sim 程式碼集中在 T1(驅動)+ T2(內插);T4 幾乎是 docs + 測試(對齊 WP-21 T3)。
- `graphify-out/GRAPH_REPORT.md` build commit 停在 `fe8aae2`,早於 `074da04`;本切片未改程式碼,後續 code task(T1 起)應先 `graphify update .` / `codegraph sync .` 再依 graph 導航。

**Open Questions / Next**:
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))——上游 exit 驗證 + F5 seam 基線正式凍結 + OQ-18.1/18.2/18.3 收斂,docs-only。⚠️ 本次展開只規劃 task 檔,未跑 T0 驗證、未動 `src/`(依「just plan the docs」範圍)。
