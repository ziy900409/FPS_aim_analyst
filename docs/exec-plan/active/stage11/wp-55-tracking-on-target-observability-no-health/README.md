# WP-55 — Tracking On-target Observability without Health

> Stage spec：[../README.md](../README.md) · checklist：[task-checklist.md](task-checklist.md) · progress：[progress.md](progress.md)
>
> Source proposal：[../wp-55-tracking-on-target-observability-no-health-plan.md](../wp-55-tracking-on-target-observability-no-health-plan.md)。本文件依 `.claude/skills/engineering-planning/SKILL.md`、`references/design_standards.md`、`assets/tech_spec_template.md` 與 WP-51 的 work-package 格式整理。
>
> **狀態：已正式納入 stage11，M21 entry gate / T0 已完成（2026-09-03）。** T1 之後才能開始實作 contact derivation；T0 evidence 見 [progress.md](progress.md)。

| | |
|---|---|
| **目標** | 讓所有 tracking 項目都能用同一套 exact-hitbox on-target 觀測，確認準心是否跟隨目標，並支援 export/replay/report 重建 |
| **主要使用者** | 研究者、教練、測試操作員；受測者為 FPS 選手 |
| **交付定位** | Researcher/pilot evidence；不新增血條、不新增 HP、不把 damage 或擊殺數當 tracking 主指標 |
| **上游基線** | `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`、schema v2、`deriveTrackingMetrics()`、Replay |
| **里程碑** | 暫定 M21：tracking on-target observability 在 live export、offline artifact 與 replay 對表成立 |
| **估時** | 5-8 dev-days；若 T4 不做產品 Replay UI、只做離線 replay artifact，可降為 3-5 dev-days |
| **風險** | High：hit geometry、export schema、derived metrics 與 replay frame alignment 都可能造成研究語意錯配 |

---

## 0. Repository-grounded discovery

1. 既有 tracking 構念已由 raw tick telemetry、target state 與 hit geometry 推導；WP-55 不需要也不得引入 health/damage lifecycle。
2. graphify report 顯示 `createSharedState()`、`createDataRecorder()`、`createSimLoop()`、`loadDrill()`、`createTargetManager()` 是高連結核心節點；WP-55 應把 contact 推導放在 export 後分析層，避免污染 sim/render hot path。
3. 既有 target 狀態流為 `TargetManager -> SharedState.targets -> TargetView`，輸出資料流為 `DataRecorder -> ExportPayload -> metrics/report`；WP-55 必須沿用這個責任切分。
4. `tracking_br_v1` 同時涉及 ADS、hitscan/projectile 與 lead 語意；WP-55 可呈現 aim-ray on-target，但不得把 ballistic hit 寫回 pure tracking 主結論。
5. WP-54 若後續新增 `tracking_core_pr_pilot_v1` 或 `tracking_reversal_pilot_v1`，應接入同一 contact artifact contract；WP-55 本身先覆蓋現有三個 tracking drill。

### 0.1 Planning-time blast radius

- T0 開工前必須對 `TargetState`、`TargetManager`、`DataRecorder`、export schema/parser、`deriveTrackingMetrics()`、Replay sampling/view 與 report consumers 執行 CodeGraph impact。
- 若實際 implementation target 與本計畫命名不同，以 T0 讀碼後的 actual symbols 為準更新本文件與 [progress.md](progress.md)。
- 本次文件整理未修改 production code，因此不執行 graphify update。

---

## 1. 需求壓縮 (Requirements)

### 1.1 Functional Requirements

| ID | Requirement | 驗收摘要 | Task |
|---|---|---|---|
| FR-55-1 | 系統**必須**明確排除血條、HP、damage 與擊殺數作為 tracking 跟隨判定來源 | `DrillConfig`、`TargetState`、hit path、export schema 不新增 health/damage contract | T0/T6/T-exit |
| FR-55-2 | 系統**必須**對所有 tracking drill 以同一 exact-hitbox geometry 推導每 tick `onTarget` | `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1` fixtures 均能輸出逐 tick contact samples | T1/T3 |
| FR-55-3 | 系統**必須**輸出可重建的 per-tick 觀測 artifact，至少包含 `t`、`targetId`、target center、aim、`onTarget`、`epsilonDeg` | JSON artifact 與 `deriveTrackingMetrics()` 的 TOT/RMS/acquisition 對表 | T2/T3 |
| FR-55-4 | 系統**必須**在 replay 中可觀測準心是否跟隨目標 | replay 同一 frame 的 target/aim/contact state 與 artifact row 對表 | T4 |
| FR-55-5 | 系統**必須**保留既有 tracking drill lifecycle；HP 歸零 respawn 語意不得引入 | `presentationMs`、`visible` event、target id window 切分維持既有語意 | T0/T5/T-exit |
| FR-55-6 | 系統**必須**把 pure tracking 與 BR/projectile transfer tracking 分層報告 | BR projectile/hitscan 條件可呈現 on-target，但不回寫成 pure tracking 主結論 | T3/T5 |
| FR-55-7 | 系統**必須**在資料不足或不相容時輸出 reason-coded blocked result，而不是輸出錯誤的 0 或空白 | missing target、missing hitbox、eye origin 不可解、schema mismatch 均有封閉原因 | T2/T3/T5 |

### 1.2 Non-functional Requirements

| ID | Requirement | 量化判準 | Task |
|---|---|---|---|
| NFR-55-1 決定性 | contact artifact 不得依 render FPS 或 wall clock 漂移 | 同 export 重跑 artifact byte-equivalent；同 seed/input 在既有 60/120/240 pump gate 中 metrics deep-equal | T2/T5 |
| NFR-55-2 幾何一致性 | `onTarget` 必須與 engine hit geometry 使用同一 hitbox 來源 | synthetic ray-hitbox fixture 中 on-target 與 known hit/miss oracle 逐列一致 | T1 |
| NFR-55-3 相容性 | 舊 export 可用既有 fallback，新 export 使用 `meta.targets.hitbox` | legacy/default hitbox fixture 與 hitbox metadata fixture 均通過；不可解析時 blocked | T2 |
| NFR-55-4 效能 | artifact generation 不得進 sim/render hot path | 30 秒 tracking export 的 artifact generation reference runtime < 500 ms；live sim 無新增 per tick allocation contract | T2/T4 |
| NFR-55-5 可追溯性 | 每份報告都可追到原始 run 與分析版本 | artifact 含 drillId、schemaVersion、simHz、target hitbox、analysisVersion、sourceRunId 或 export basename | T2/T5 |

### 1.3 Constraints

- 不新增血條、不新增 HP、不新增 damage event、不改 `TargetManager.markKilled()` 為扣血模型。
- 不用「有沒有射中」替代「準心是否跟隨」。射擊只是一個瞬間事件；tracking 觀測必須來自逐 tick aim/target/hitbox。
- 不把 `tracking_br_v1` 的 ADS、projectile、weapon spread 或 lead 結果混入 pure tracking 主分數。
- 不把 derived `onTarget` 寫回 sim state；engine 仍只匯出 raw ticks/events，衍生觀測在 export 後生成。
- 不修改既有 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1` drill id 或凍結參數。

### 1.4 Open Questions

| ID | Question | Recommended default | Owner | Deadline | Impact if unresolved |
|---|---|---|---|---|---|
| OQ-55-1 | Replay 可觀測性要做到產品 UI，還是先產出離線 HTML/JSON replay artifact？ | 先做離線 artifact；產品 Replay overlay 作 T4 可選切片 | 使用者 | T0 | T4 scope/估時 |
| OQ-55-2 | 「tracking 項目」是否只包含現有三類，或也包含 WP-54 候選 `tracking_core_pr_pilot_v1`/`tracking_reversal_pilot_v1`？ | 現有三類先全覆蓋；WP-54 新 drill 以同一 contract 接入 | 使用者 + 研究者 | T0 | T3/T5 fixture matrix |
| OQ-55-3 | Export 支援是指 raw export 足以重建，還是要另存 derived contact JSON/CSV？ | 另產 derived artifact，不改 raw schema v2 | 使用者 | T0 | T2 output format |
| OQ-55-4 | BR projectile 條件中是否同時顯示 ballistic hit 與 aim-ray on-target？ | 顯示兩者但分欄；tracking contact 仍以 aim-ray exact hitbox 定義 | 研究者 | T1 | T3 metric semantics |

---

## 2. 系統架構與設計 (Technical Design)

### 2.1 System Boundary

**In scope**

- 共用 on-target sample derivation：從 `ExportPayload` 的 `ticks[]`、`events[]`、`meta.targets.hitbox` 與 eye origin metadata 推導逐 tick contact。
- Derived artifact：JSON/CSV 或 self-contained HTML，能讓研究者檢查準心是否跟隨目標。
- Replay 對表：同一 replay frame 可找到對應 observation row，並能呈現 contact state。
- 所有現有 tracking drill 的 fixtures、quality guard 與 regression gate。
- 文件更新：operational tracking spec、stage11 progress/checklist（正式採納時）。

**Out of scope**

- 血條、HP、damage、armor、weapon damage falloff、HP 歸零 respawn。
- 正式 Assessment 發布、history/trend registry、常模與 composite score。
- Scored block 內 adaptive difficulty。
- 把射擊 hit rate、projectile lead、ADS 表現合併為 pure tracking 分數。
- 重寫 WP-54 的 trajectory generator；本 WP 只規範所有 tracking drill 如何觀測 contact。

### 2.2 Planning-time targets

下列路徑是候選落點，T0 讀碼與 CodeGraph impact 後可調整；責任邊界不可遺失。

```text
src/metrics/trackingContact.ts                         NEW deriveTrackingContactSamples contract
src/metrics/trackingContact.test.ts                    NEW ray-hitbox/contact/blocked fixtures
src/metrics/trackingDerivation.test.ts                 MODIFY parity with contact artifact if needed
src/data/exportPayloadSchema.ts                        MODIFY only if metadata parser needs additive hitbox/eye origin validation
src/replay/replayContact.ts                            NEW sampleReplayContact pure helper
src/replay/replayContact.test.ts                       NEW frame alignment and seek/playback tests
src/render/replay/*                                    OPTIONAL Replay overlay if OQ-55-1 chooses product UI
src/pilot/trackingContactEvidence.ts                   NEW JSON/HTML evidence model if offline artifact path chosen
docs/operational/analysis-tracking.md                  MODIFY no-health/contact formula/version contract
docs/operational/tracking-on-target-observability.md   NEW operator/researcher artifact contract
```

### 2.3 Data Flow

```mermaid
flowchart LR
  Drill[tracking drill] --> Sim[SimLoop / TargetManager]
  Sim --> Raw[schema v2 export: ticks + events + meta]
  Raw --> Contact[deriveTrackingContactSamples]
  Contact --> Metrics[deriveTrackingMetrics parity]
  Contact --> Artifact[contact JSON/CSV/HTML]
  Contact --> Replay[Replay contact alignment]
  Metrics --> Report[tracking evidence report]
  Artifact --> Report
```

資料從 sim 產生 raw telemetry，經 export 後由分析層推導 contact samples；Replay 與報告只讀 derived artifact，不回寫 sim，也不改變 target lifecycle。

### 2.4 Interface Contracts

```ts
export interface TrackingContactSample {
  readonly t: number;
  readonly targetId: string;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly aim: { readonly yaw: number; readonly pitch: number };
  readonly onTarget: boolean;
  readonly epsilonDeg: number;
  readonly presentationIndex: number;
  readonly trackingWindow: 'pre-acquire' | 'pursuit' | 'none';
}

export type TrackingContactBlockedReason =
  | 'schema-version-unsupported'
  | 'missing-visible-event'
  | 'missing-target-telemetry'
  | 'missing-eye-origin'
  | 'invalid-hitbox'
  | 'no-tracking-drill'
  | 'protocol-incompatible';

export type TrackingContactDerivationResult =
  | {
      readonly status: 'ok';
      readonly analysisVersion: 'tracking-contact-v1';
      readonly drillId: string;
      readonly samples: readonly TrackingContactSample[];
    }
  | {
      readonly status: 'blocked';
      readonly analysisVersion: 'tracking-contact-v1';
      readonly reasons: readonly TrackingContactBlockedReason[];
    };

export function deriveTrackingContactSamples(payload: ExportPayload): TrackingContactDerivationResult;
```

Output contract：

- `samples[]` 只包含有 active target telemetry 的 scored ticks。
- `onTarget` 使用 same geometry as tracking metrics：eye ray intersects H1 hitbox。
- `epsilonDeg` 與 `deriveTrackingMetrics()` 的 angular center error 同源。
- `trackingWindow` 必須與 acquisition rule 對齊：首次 on-target 前是 `pre-acquire`，之後到 presentation end 是 `pursuit`。
- `blocked` 結果不得輸出空 samples 假裝成功。

Replay contract：

```ts
export interface ReplayContactFrame {
  readonly t: number;
  readonly targetId: string | null;
  readonly onTarget: boolean | null;
  readonly epsilonDeg: number | null;
}

export function sampleReplayContact(
  samples: readonly TrackingContactSample[],
  replayTimeMs: number,
): ReplayContactFrame;
```

Error 情境：

- export 沒有可解析 eye origin：blocked `missing-eye-origin`。
- tick 有 target center 但找不到 matching visible/presentation window：blocked `missing-visible-event`，避免跨 presentation 污染。
- hitbox 非正有限或 shape unsupported：blocked `invalid-hitbox`。
- BR projectile 條件有 hit event 但 aim ray off target：保留兩者差異，不把其中之一覆寫另一個。

### 2.5 Artifact and report contract

| Layer | Field / metric | Rule |
|---|---|---|
| Identity | `analysisVersion`、`sourceRunId`、`drillId`、`schemaVersion`、`simHz` | 每份 artifact 必填；缺少可追溯 identity 時 blocked |
| Geometry | hitbox source、eye origin source、target center | 顯示 metadata/fallback 來源；不可混用 multiple hitbox definitions |
| Contact timeline | per tick `onTarget`、`epsilonDeg`、`trackingWindow` | 可與 export ticks 依 `t` 對表 |
| P0 summary | acquisition、TOT%、RMS/median/P95 `epsilon` | 與 `deriveTrackingMetrics()` parity；不讀 hit count |
| BR companion | `aimRayOnTarget` vs projectile/hitscan hit | 分欄呈現；pure tracking summary 不讀 ballistic hit |
| Blocked result | closed reason vocabulary | 不顯示 0 或空圖表取代 blocked |

### 2.6 Concurrency model

本 WP 不新增 worker、thread、channel 或共享 mutable concurrency。所有 derived contact 在 export/replay 載入後同步計算。若 T4 benchmark 顯示 30 秒 export 生成時間 >= 500 ms，再另立 worker spike；不得在本 WP 未量先改 concurrency。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Level | Failure mode | Mitigation/evidence |
|---|---|---|---|
| Health model scope creep | High | 把血條/HP 又帶回設計，或用 hit count 取代 contact | T0 freeze 明列 no-health/no-damage；T6/T-exit 稽核 schema/state/hit path 無 HP 改動 |
| Contact geometry 不一致 | High | `onTarget` 與 engine hitbox 或 existing `deriveTrackingMetrics()` 不一致 | T1 建 same-fixture parity；metadata/fallback path 共用 |
| Replay alignment 錯誤 | High | 操作員看到錯誤 frame 的 contact state | T4 deterministic replay fixture 對表 `t`、target id、position、contact |
| BR 語意混用 | Med/High | ballistic lead 或 travel time 被誤判為跟槍 | T3/T5 分欄報告 `aimRayOnTarget` 與 ballistic `hit` |
| Legacy export 不完整 | Med | 舊 export 缺少 hitbox 或 eye origin metadata | 可證明 fallback 才啟用；否則 reason-coded blocked |
| Artifact 太大或太慢 | Med | replay/report 開啟延遲，或 export 後分析阻塞操作 | 只輸出 scored target ticks；30 秒 reference benchmark < 500 ms；必要時另立 worker spike |
| Sim/render hot path 污染 | High | derived contact 被寫進 sim state 或 render allocation | T0 impact review；T2/T4 確認 export 後同步計算；legacy determinism gate |

### Conscious technical debt

1. 第一版若只做離線 artifact 而不做產品 Replay overlay，是有意識的切範圍。觸發後續工作的條件是研究者需要在正式操作 UI 逐 frame 檢視 contact，而不是只審核 exported report。
2. Legacy export fallback 只支援能由既有資料可靠重建的案例；不可重建的舊資料保留 blocked 結果，不做推測補值。
3. WP-55 不把 tracking contact 直接晉升為正式 Assessment/history/trend 指標；正式發布應另立 release WP 或由 WP-54/WP-53 後續里程碑承接。

---

## 4. 任務拆解 (Task Breakdown)

| Task | Objective | Dependencies | Risk | Complexity | Definition of Done |
|---|---|---|---|---|---|
| **T0** | Scope freeze and no-health audit | 使用者確認 WP-55 是否納入 stage11 | High | 0.5-1d | stage scope 決議、OQ-55-1~4、CodeGraph impact、baseline、no-health/no-damage audit 與 actual target paths 全部記錄 |
| **T1** | Contact geometry contract | T0 | High | 1-1.5d | `deriveTrackingContactSamples()` 介面凍結；perfect on-target、known miss、legacy hitbox、metadata hitbox fixtures 通過；與 `deriveTrackingMetrics()` on-target/TOT/RMS 對表 |
| **T2** | Export-derived artifact | T1 | Med/High | 1-1.5d | deterministic contact JSON/CSV 或 HTML artifact；含 analysisVersion、drillId、hitbox、samples；blocked reason vocabulary 有測試；30 秒 generation < 500 ms |
| **T3** | All tracking drill coverage | T2 | High | 1-1.5d | `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1` 每類至少一份 fixture；BR 分開呈現 `aimRayOnTarget` 與 projectile/hitscan hit；pure summary 不讀 hit count |
| **T4** | Replay observability | T2/T3 | Med/High | 1-2d | `sampleReplayContact()` 與 replay sample 對表；seek/playback 下 targetId、time、onTarget 不漂移；若 OQ-55-1 不做 UI，則 self-contained HTML replay trace 取代 |
| **T5** | Report and quality integration | T3/T4 | Med | 1-1.5d | report 顯示 acquisition、pursuit、TOT、RMS epsilon、contact timeline、blocked reasons；每個數值帶 n/duration/condition；protocol-incompatible run 不進 aggregate |
| **T6** | Exit gate and documentation | T1-T5 | Med | 0.5-1d | operational spec 更新；stage11 progress/checklist 更新；focused tests 與 `npm test` 綠；確認未新增 HP/damage/health bar schema/state/render contract |
| **T-exit** | M21 evidence audit and handoff | T1-T6 | Med | 0.5d | §6 exit gate 全部成立，或以 blocked/revise 結案；handoff 明確指出 WP-54/new tracking drills 如何接入 contact contract |

Task 詳細步驟與 local DoD 見同資料夾 `T*.md`。

### 4.1 Requirements traceability

| Requirement | Tasks | Verification |
|---|---|---|
| FR-55-1/5 | T0/T6/T-exit | no-health/no-damage schema/state/render audit、legacy lifecycle tests |
| FR-55-2 | T1/T3 | ray-hitbox truth fixtures、all tracking drill fixtures |
| FR-55-3/7 | T2/T3/T5 | artifact parity、blocked reason fixtures、no fake zero output |
| FR-55-4 | T4 | replay frame alignment, seek/playback determinism |
| FR-55-6 | T3/T5 | BR split-column report and pure tracking aggregation tests |
| NFR-55-1/4 | T2/T4/T6 | deterministic artifact rerun, pump gate, generation benchmark |
| NFR-55-2/3 | T1/T2 | geometry oracle, metadata/fallback compatibility fixtures |
| NFR-55-5 | T2/T5/T-exit | artifact identity/version/source fields and report traceability |

---

## 5. Execution rules

- 一個 task = 一個可驗收垂直切片 = 一個原子 commit；完成後同步 [task-checklist.md](task-checklist.md)、[progress.md](progress.md) 與 stage11 master 文件。
- T0 不得把 planned contract 當 delivered evidence；所有 interface/path 以 actual codebase 為準。
- 修改既有 symbol 前執行 CodeGraph impact，記錄 affected files/symbols 與 local/cross-module 判斷。
- Contact derivation 必須留在 export 後分析層；不得寫回 sim state 或把 health/damage 加進 target lifecycle。
- BR projectile/hitscan evidence 可並列顯示，但 pure tracking summary 不得讀 hit count、damage 或 kill。
- Data-insufficient case 必須 fail closed with reason code；不得用 0、空 samples 或空 chart 偽裝成功。
- production code 修改後執行 `graphify update .`；純 docs/test-plan 整理不需更新 source graph。
- T-exit 前檢查 `git status --short`、staged stat/names 與 artifact scan，確保無真實 participant payload 進 git。

---

## 6. M21 Exit Gate

- [ ] WP-55 已正式被 stage11 接受，或文件移到明確 future proposal；stage scope 不矛盾。
- [ ] 血條、HP、damage、擊殺數均未成為 tracking 跟隨判定來源。
- [ ] 所有現有 tracking drill 都能從 export 重建逐 tick `onTarget` 與 `epsilonDeg`。
- [ ] Contact artifact 與 `deriveTrackingMetrics()` 的 acquisition/TOT/RMS epsilon 對表成立。
- [ ] Replay 或離線 replay artifact 能逐 frame 檢視 contact state。
- [ ] BR/projectile tracking 的 ballistic hit 與 aim-ray contact 分欄呈現，未混入 pure tracking 主結論。
- [ ] 資料不足、不相容或舊 export 無法可靠重建時，輸出封閉 reason code。
- [ ] Existing target lifecycle、`presentationMs`、drill id 與 legacy tests 無 semantic regression。
- [ ] 文件同步說明：tracking 是否跟隨目標以 exact-hitbox on-target/TOT/RMS epsilon 判定，不需要血條。
- [ ] Focused unit/replay/report tests、full CI 與必要 manual/researcher artifact review 全綠或有明確 blocker owner。
- [ ] `CONTEXT.md`、`DECISIONS.md`、operational spec、stage progress/checklist 與 `graphify-out`（若有 code change）同步。

---

## 7. Handoff to adjacent work

1. 若 WP-54 新增 `tracking_core_pr_pilot_v1` 或 `tracking_reversal_pilot_v1`，直接接入本 WP 的 contact artifact contract。
2. 若研究者需要 live practice feedback，可另立 render-only contact indicator，但不得進 sim state 或 scored block strategy feedback。
3. 正式 Assessment、history/trend registry、教練式診斷規則與 composite score 需另立 WP，且必須引用 M21 evidence。
