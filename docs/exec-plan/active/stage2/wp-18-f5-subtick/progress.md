# WP-18 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 task 檔已展開,待實作(2026-07-09)

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ 未跑(下一步) |
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
| OQ-18.1 motion 階層 | ⬜ open | 本 WP T1 驅動哪些 motion type(建議 linear/pingpong/sine;`waypoints` 只淺驗形狀不驅動)+ 各自 range/speed 的 `field-low` 走廊相容預設值。T0 定稿記 ledger。 |
| OQ-18.2 presentation 落點 | ⬜ open | timed presentation 時長欄位落點:`timing.presentationMs`(additive optional)vs 複用既有 `peekTimeoutMs` 語意。追蹤 drill 命中不撤除的機制點(DrillRunner running 相位)。T3 前由 T0 定方向。 |
| OQ-18.3 posPrev 快照落點 | ⬜ open | sub-tick 內插基準快照存 `TargetState.posPrev`(每目標)vs SimLoop 側平行結構;GC 紀律(物件重用、不 push)下的最省法。T2 定案。 |
| OQ-S3-5 交付形狀對帳 | 🟡 blocked→本 WP 交付後解 | WP-22 T1 的對帳點:追蹤 drill config 型、motion 欄用法、presentation 時長、target render alpha 內插、`t_acquire`/TOT%/RMS ε 結果頁/匯出欄位。**T-exit 綠燈後回 [WP-22 T0](../../stage3/wp-22-perception-integration/T0-entry-gate.md) 重跑此對帳。** |

---

## Log

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
