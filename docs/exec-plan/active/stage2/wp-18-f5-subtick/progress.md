# WP-18 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 task 檔已展開,待實作(2026-07-09)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ PASS(2026-07-09;基線凍結 + OQ 收斂) |
| T1 motion drive | ✅ PASS(2026-07-09;459 test 全綠、零破壞) |
| T2 sub-tick 命中內插 | ✅ PASS(2026-07-09;466 test 全綠、零破壞) |
| T3 timed presentation + render 內插 | ✅ PASS(2026-07-09;474 test 全綠、零破壞) |
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

### 2026-07-09 — T3 timed presentation 推進 + 目標 render 內插 ✅ PASS(命中不撤除;render-only 內插;零破壞)

**切片**(走 `/incremental-implementation`,三 slice 各自原子 commit):
- **Slice 1/3**(`34df851`):`timing.presentationMs`(additive optional)schema + config 欄位。
- **Slice 2/3**(`b72f9d2`):DrillRunner timed presentation 推進 + persistent 命中 gate(命中不撤除)。
- **Slice 3/3**(本 commit):目標 render alpha 內插(render-only,`posPrev`→`pos`)。

**① 實作**:
- **`timing.presentationMs?`**([DrillConfig.ts](../../../../src/drill/DrillConfig.ts) + [schema.ts](../../../../src/drill/schema.ts)):正有限驗證(比照 `peekTimeoutMs`),spread 條件式保留欄位。additive optional → 既有 detection/counter-strafe drill 零破壞。
- **`TargetState.persistent?: boolean`**([types.ts](../../../../src/state/types.ts)):timed presentation 目標旗標——命中不撤除,只由 DrillRunner 呈現時長到期推進。省略＝命中即撤(既有政策)。
- **spawn 設旗標**([TargetManager.ts](../../../../src/sim/TargetManager.ts)):`config.timing.presentationMs !== undefined` → spawn 目標帶 `persistent: true`(條件式 spread,不設時欄位不存在 → 逐位零破壞)。
- **SimLoop 命中 gate**([SimLoop.ts](../../../../src/loop/SimLoop.ts) `fireOneShot`):命中路徑改為先 `state.targets.find(result.targetId)`,`persistent === true` 時**不** `markKilled`(只記 fire 事件,`hit: true`);非 persistent 維持命中即撤。
- **DrillRunner 呈現時長推進**([DrillRunner.ts](../../../../src/drill/DrillRunner.ts) running 相位):`presentationMs` 提供時,目標可見達 `nowMs − visibleAt >= presentationMs` → `markKilled` 推進下一目標。純時長驅動、時間源 = sim clock `nowMs`(ADR-4),與 `peekTimeoutMs` 並存(語意不同:presentation 是追蹤窗右界,窗內命中不撤除)。
- **目標 render alpha 內插**([TargetView.ts](../../../../src/render/TargetView.ts) `sync`):新增選填 `alpha = 1`;`posPrev` 存在時 mesh 位置取 `lerp(posPrev, pos, alpha)`(reuse [RenderLoop.ts](../../../../src/loop/RenderLoop.ts):24 `lerp`),無 `posPrev` 退回 `pos`。**render-only、不寫 state**(GD-6/GD-10)。[main.ts](../../../../src/main.ts) render frame 傳入 SimLoop `alpha`(比照 player 位置)。

**② 測試**(+8,466→474):
- [schema.test.ts](../../../../src/drill/schema.test.ts)(+1):`presentationMs ≤ 0 / 非有限 → throw` + 合法欄位保留斷言。
- [DrillRunner.test.ts](../../../../src/drill/DrillRunner.test.ts)(+2):`presentationMs` 到期純時長推進並計入 targetCount(spawn 帶 `persistent: true`);未設 `presentationMs` 時目標非 persistent、時間大幅推進不自動撤除(既有政策零破壞)。
- [SimLoop.test.ts](../../../../src/loop/SimLoop.test.ts)(+2):persistent 目標命中記 `hit: true` 事件但**不** `markKilled`、目標仍存活;非 persistent 命中即撤除(零破壞)。
- [TargetView.test.ts](../../../../src/render/TargetView.test.ts)(+3):`alpha` 0→posPrev / 1→pos / 0.5→中點;無 posPrev 退回 pos;`sync` 不寫回 `pos`/`posPrev`(render 唯讀不變式)。

**③ grep 閘**:`src/{sim,loop,drill}/*.ts` 無 `Date.now`/`Math.random` 呼叫(grep 命中皆 doc comment/測試描述禁令的散文)。persistent gate 只加布林判斷,無時鐘/隨機/演進改動。

**④ 收尾**:`tsc --noEmit` exit 0;`npx vitest run` → **59 files / 474 tests passed**,exit 0(baseline 466 + 8 新,零破壞)。

**Decision Log**:
- **⚠️ 外科式 SimLoop gate(擴 scope 超出 T3 原 Touches,user 本 session 確認)**:「命中不撤除」的撤除點是 `SimLoop.fireOneShot` 的 `markKilled`(line 227),**DrillRunner 單獨擋不住**。故採 per-target persistent 布林旗標,擴 scope 到 **SimLoop + TargetManager + types**(T3 原 Touches 只列 DrillRunner/TargetView/main)。Alternatives Considered:(a) DrillRunner 攔截命中事件——否決:DrillRunner 不在命中判定路徑,無從得知本 tick 命中了誰;(b) 在 `markKilled` 內查 persistent——否決:`markKilled` 是 DrillRunner presentation 推進**也**要用的撤除原語(persistent 目標到期仍須被 presentation gate 撤除),在原語內擋會連 presentation 推進一起擋死。**選定**:gate 放呼叫端(SimLoop 命中路徑查 `persistent` 才撤;DrillRunner presentation 路徑無條件撤)——兩條撤除路徑語意分離、`markKilled` 保持單純原語。
- **「命中不撤除」測試落 SimLoop.test.ts 而非 DrillRunner.test.ts**。Alternatives Considered:handoff 原建議用 DrillRunner `killCurrentTarget` helper——否決:該 helper 直呼 `markKilled`(繞過 SimLoop gate,必移除 persistent 目標),無法驗證 gate。**選定**:gate 行為在 SimLoop fire 路徑,故在 [SimLoop.test.ts](../../../../src/loop/SimLoop.test.ts) 以真實 `simStep` 命中 persistent 目標並斷言 `killed` 為空、目標仍存活——測在行為所在層。
- **render lerp reuse `RenderLoop.lerp` 而非 inline / 新 helper**。Alternatives Considered:inline `a+(b-a)*α`——否決:與 player/recoil 內插同一數學,共用具名純函式語意一致、單一真相源;`RenderLoop.lerp` 為 tree-shakeable 具名 export,無循環依賴(RenderLoop 不 import TargetView)。

**Surprises & Discoveries**:
- **`alpha` 預設 1 天然涵蓋零破壞**:`lerp(posPrev, pos, 1) = pos` 代數恆等,故靜止/直接注入目標(`sync` 省略 alpha 或無 posPrev)逐位讀 `pos`,既有 5 個 TargetView 測試零改動通過。
- **`TargetView.test.ts` 的 `target()` helper 顯式列欄、丟棄 `posPrev`**:helper 不 spread `over` 而逐欄複製,新增 `posPrev` 內插測試須先在 helper 補 `posPrev: over.posPrev`,否則旗標被靜默丟棄(內插測試會假綠退回 pos 分支)。

**Open Questions / Next**:
- **Next**:T4 [T4-tracking-drill-metrics-spec.md](T4-tracking-drill-metrics-spec.md)(Med)——`tracking_v1` drill config(移動目標 + timed presentation)+ 追蹤指標離線推導 spec(`t_acquire`/TOT%/RMS ε)+ round-trip fixture。相依 T2+T3 皆 ✅。
- OQ-S3-5 仍 blocked,待 T-exit 綠燈後回 WP-22 T0 重跑。

### 2026-07-09 — T2 sub-tick 命中內插 ✅ PASS(FR-B17;fire 時間戳對齊;靜止目標零破壞)

**切片**:命中判定由「讀 tick 末 `target.pos`」改為「fire 時間戳對齊的內插位置 `lerp(posPrev, posCurr, subAlpha)`」(FR-B17)。四檔垂直切片 + 單元/整合測試。

**① 改動前基準**(T2 零破壞閘):T0 凍結的 10 檔既有命中/決定性回歸 → **137 test 全綠**(改動後重跑仍 137 全綠,逐位零破壞)。

**② 實作**:
- **型別**([types.ts](../../../../src/state/types.ts)):`TargetState.posPrev?: Vec3`——tick 起始位置快照(motion drive 之前);sub-tick 內插基準。optional → 直接注入的既有測試目標無此欄,命中判定退回讀 `pos`(向後相容)。
- **posPrev spawn init**([TargetManager.ts](../../../../src/sim/TargetManager.ts):spawn):目標各持一份重用 `posPrev` Vec3(spawn 時 = spawn 位置;GC 紀律,不 push 額外物件)。
- **posPrev tick 快照**([SimLoop.ts](../../../../src/loop/SimLoop.ts) simStep):在 `targetManager.tick`/`drillRunner.tick`(motion drive)**之前**,就地 `posPrev ← pos`——與上方 player/recoil `prev←curr` 快照**同時點、同紀律**(tick 起始)。drive 後 `pos` 即 `posCurr`(tick 末)。無 `posPrev` 的目標略過(向後相容)。
- **subAlpha 計算**([SimLoop.ts](../../../../src/loop/SimLoop.ts) `fireOneShot`):`subAlpha = (t − tickStartMs) / tickMs`,`tickMs = dtSec·1000`、`tickStartMs = tickEndMs − tickMs`。clamp `[0,1]`(半開窗防護;`t=tickEnd` boundary → subAlpha=1 → posCurr,逐位等價舊「讀 pos」)。純函式、無隨機/時鐘。經 `scheduleFire`→`fireOneShot`→`ballisticRaycast` 傳入(私有函式簽章擴充;`simStep` 對外簽章不變)。
- **HitDetector 注入**([HitDetector.ts](../../../../src/sim/HitDetector.ts) `raycastWithRay`):新增選填 `subAlpha` 參數。有 `subAlpha` + `posPrev` 時 hitbox 中心取 `lerp(posPrev, pos, subAlpha)`(純 scalar 暫存,零配置);否則讀 `pos`。**簽章向後相容**(`raycastFromCenter` 等既有呼叫不變)。

**③ 測試**(+7,459→466):
- [HitDetector.test.ts](../../../../src/sim/HitDetector.test.ts) sub-tick 內插 geometry(+5):靜止(posPrev==pos)任意 subAlpha 逐位等價現行判定(含 hitPointOut)、無 posPrev 退回讀 pos、移動目標中點命中中心 ≈ 兩 tick 中點(瞄準 x=0.4 只在內插中心 ~0 時命中)、邊界(α=0→posPrev/α=1→posCurr)、**翻轉案例**(目標本 tick 移 0→2,α=0.1 內插命中 vs 讀 pos=2 脫靶)。
- [HitDetector.test.ts](../../../../src/sim/HitDetector.test.ts) simStep 端到端(+2):fire 時間戳落 tick 前段(α≈0.1)→ markKilled 擊殺;中段(α≈0.5,內插中心 x=1.0)→ 脫靶不擊殺——證明 `fireOneShot` 由 fire 時間戳算 subAlpha 的接線正確。

**④ grep 閘**:`HitDetector.ts`/`TargetManager.ts`/`types.ts` 無 `Date.now`/`performance.now`/`Math.random` 呼叫(grep 命中 4 處皆 doc comment 描述禁令的散文)。`architecture.test.ts`(GD-6)綠。

**⑤ 收尾**:`tsc --noEmit` exit 0;`npx vitest run` → **59 files / 466 tests passed**,exit 0(baseline 459 + 7 新,零破壞)。

**Decision Log**:
- **posPrev 快照落點採 simStep(motion drive 之前)+ spawn init 雙寫**,對齊 T0 OQ-18.3。Alternatives Considered:(a) 快照放 `TargetManager.tick` step ③ 內對所有目標——否決:step ③ 只在有 driven motion 時跑迴圈,且會與「靜止目標也需 posPrev==pos」的零破壞不變式打架(要在 isDrivenMotion 早退之前處理),邏輯較繞;(b) SimLoop 側 id→pos 平行 map——OQ-18.3 已否決(額外配置 + 生命週期雙寫)。**選定**:simStep 在既有 player/recoil `prev←curr` 快照旁加一段 `posPrev←pos`(同時點語意最自然、天然位於 drive 之前),搭配 spawn init 涵蓋「本 tick 新 spawn 目標」(該目標此迴圈時尚不在陣列,由 spawn 補上 posPrev=spawnPos)——兩者合璧使 posPrev 恆 = 該 tick drive 之前的位置。
- **subAlpha clamp `[0,1]` 而非嚴格 `[0,1)`**。Alternatives Considered:硬性 `< 1`(如 `Math.min(subAlpha, 1 − ε)`)——否決:boundary `t = tickEnd`(`scheduleFire` 的 `nextFireT <= untilMs` 允許 `== tickEnd`)時 subAlpha=1 → `lerp` 取 posCurr = `pos`,**恰等於舊「讀 tick 末 pos」行為**,無需特例;clamp 上界 1 語意乾淨且與零破壞相容。

**Surprises & Discoveries**:
- **零破壞不變式落在「內插中心 == pos」的代數恆等**:靜止目標 posPrev==pos → `lerp(posPrev,pos,α) = pos` 對任意 α 逐位成立(浮點無誤差,因 `a+(a−a)·α = a`);故靜止/直接注入目標的命中判定與彈著回填 byte-for-byte 不變,無需容差測試。
- **subAlpha 接線可不動 simStep 對外簽章**:`tickMs`/`tickStartMs` 由 simStep 既有的 `dtSec`+`tickEndMs` 就地導出(`tickMs = dtSec·1000`),只擴充私有 `scheduleFire`/`fireOneShot`/`ballisticRaycast` 簽章——既有直呼 `simStep` 的測試零改動。

**Open Questions / Next**:
- **Next**:T3 [T3-timed-presentation-render-interp.md](T3-timed-presentation-render-interp.md)(Med)——timed presentation 推進政策(`timing.presentationMs`,命中不撤除)+ 目標 render alpha 內插(render-only,比照玩家/recoil prev→curr)。
- OQ-S3-5 仍 blocked,待 T-exit 綠燈後回 WP-22 T0 重跑。

### 2026-07-09 — T1 motion drive ✅ PASS(移動目標每 tick 驅動 pos;static 零破壞)

**切片**:`TargetManager.tick` 由「motion 寫入未驅動」接活為每 tick 以 `age` 純函式驅動 `pos`。抽出純函式 motion 模組。**未動 `src/loop/SimLoop.ts`**(見下 Decision)。

**① 改動前基準**(T1 零破壞閘):`tsc --noEmit` exit 0;既有命中/決定性回歸清單(T0 凍結的 10 檔)→ **128 test 全綠**。

**② 實作**:
- **新增純函式模組** [targetMotion.ts](../../../../src/sim/targetMotion.ts):`motionOffset(motion, age, out)` 算相對 spawn 原點的位移——`linear`(`speed·age`)/`pingpong`(三角波,恆速率,值域 `[−range,+range]`)/`sine`(`range·sin(ω·age)`,`ω=speed/range` 使峰值速率=speed)。所有 type `offset(_,0)=0`(spawn 位置=原點)。`static`/`waypoints`/省略 → 位移 0。`isDrivenMotion` type guard 篩驅動集。
- **TargetManager.tick 加 ③ motion drive step**([TargetManager.ts](../../../../src/sim/TargetManager.ts)):在 t_visible 蓋戳後(命中判定之前,simStep 順序)每 tick `age += TICK_SEC`(=`1/SIM_HZ` **常數**),以**位移差** `offset(age)−offset(age−TICK_SEC)` **就地**更新 `pos.x/y/z`——免存 spawn 原點、模組層級重用 `offsetPrev/offsetCurr`(GC 紀律)。spawn 設 `age: 0`。
- **REUSE 型別**:未改 `src/state/types.ts`(`age`/`motion`/`Vec3` 既有,不改型別;posPrev 留 T2)。

**③ 測試**(+21,438→459):
- [targetMotion.test.ts](../../../../src/sim/targetMotion.test.ts)(12):原點語意(offset(_,0)=0)、linear/pingpong 逐位 golden(`toBe`,exact binary)、sine 峰值(`toBeCloseTo`)、pingpong/sine 包絡 `[−range,+range]` 觸兩端、`isDrivenMotion` 篩選。
- [TargetManager.test.ts](../../../../src/sim/TargetManager.test.ts)(+9):spawn age=0 且累加 TICK_SEC、**static/無 motion pos 逐位不變**(零破壞)、linear horizontal/vertical 128-tick(age=1s)逐位 golden(`pos.x` exact 4)、pingpong ±range 往返 golden、sine 峰值、**決定性(異 nowMs 序列同 tick 數 → per-tick pos `toEqual`)**、config.motion 不回寫。

**④ grep 閘**:`targetMotion.ts` runtime 僅用 `Math.sin`(決定性),無 `Date.now`/`performance.now`/`Math.random`(grep 命中 2 處為 doc comment 描述禁令的散文,非呼叫)。`architecture.test.ts`(GD-6)掃 `src/sim/**` 僅查 scene import,本檔只 import `state/types` → 綠。

**⑤ 收尾**:`tsc --noEmit` exit 0;`npx vitest run` → **59 files / 459 tests passed**,exit 0(baseline 438 + 21 新,零破壞)。

**Decision Log**:
- **motion drive 採「位移差增量」而非「存 spawn 原點 + 絕對重算」**。Alternatives Considered:(a) 加 `TargetState.spawnPos` 存原點——否決:T1「不改型別」(型別改動屬 T2 的 posPrev);(b) TargetManager 閉包 `Map<id, origin>`——否決:額外配置 + 與目標生命週期雙寫不同步(同 OQ-18.3 對 posPrev 的否決理由)。增量式 `pos += offset(age)−offset(age−dt)` 等價 `pos=原點+offset(age)`(因 `offset(_,0)=0` 電報式相消),就地更新、零原點儲存、零型別改動、跨 FPS 逐位一致。代價:與絕對值有極小 FP 漂移(每 tick ~1e-16 級),presentation 短時長內可忽略,且**決定性不受影響**(同運算序列)。
- **未改 `src/loop/SimLoop.ts`(T1 Touches 標「僅必要」)**。Alternatives Considered:把 `tickSec` 經 `tick(state,nowMs,tickSec)` 注入——否決:會連帶改 `DrillRunner.tick`(非 T1 touch)介面 + SimLoop 兩呼叫點,放大 blast radius。改用**模組常數 `TICK_SEC = 1/SIM_HZ`**(與既有 `recoilTick(state, 1/64)` 硬編 sim 子速率同紀律,SimLoop.ts:345);motion drive 完全落在 `TargetManager.tick`,天然位於命中判定之前(simStep:338-339 早於 consume/scheduleFire),故兩條驅動路徑(SimLoop 直驅 / DrillRunner 相位機)零改動即正確。

**Surprises & Discoveries**:
- **linear 128-tick 位移可 exact `toBe`**:`speed=2` → 每 tick 位移 `2/128 = 1/64 = 0.015625`(exact binary),128 次累加 = `2.0` 精確,故 `pos.x` golden 用 `toBe(4)` 而非容差。pingpong 上/下坡段同理(整段同號 delta),peak/原點亦 exact。sine 因 `Math.sin` 非精確,用 `toBeCloseTo`。
- **決定性可在 TargetManager 層直證**(免 SimLoop):motion drive 以 `TICK_SEC` 常數累加 age、與 `nowMs` 完全解耦(非 seeded spawn 下 `nowMs` 只影響 `t_visible` 戳值,不影響 pos/spawn)——故「同 tick 數、亂序 nowMs → per-tick pos `toEqual`」即為異 FPS 不變性的單元版(完整 SimLoop 跨 FPS 回歸收編在 T5)。

**Open Questions / Next**:
- **Next**:T2 [T2-subtick-hit-interpolation.md](T2-subtick-hit-interpolation.md)(High risk)——`TargetState.posPrev` 快照(型別改動落此)+ fire 時間戳 `subAlpha` → `lerp(posPrev, posCurr, α)` 內插命中位置(FR-B17)。**先跑既有命中/決定性回歸全綠再改**;posPrev 快照時點 = motion drive 之前(見 OQ-18.3)。
- OQ-S3-5 仍 blocked,待 T-exit 綠燈後回 WP-22 T0 重跑。

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
