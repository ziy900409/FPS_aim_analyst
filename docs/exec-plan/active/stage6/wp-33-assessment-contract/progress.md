# WP-33 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-19 | `analysis-assessment-contract.md` 起稿;D-33.1 T0 覆核;D-33.2 七項契約凍結;`npm.cmd run test:ci` exit 0 |
| T1 metadata extension | ✅ | 2026-08-19 | `AssessmentMode`/`DrillConfig.mode`/`Meta.assessment` additive 型別與 guard;`npm.cmd run test:ci` exit 0 |
| T2 event timeline contract | ✅ | 2026-08-19 | `AssessmentTimelinePoint`/`VisibleFractionSeries` 純型別契約 + smoke test + event timeline 欄位對照表;`npm.cmd run test:ci` exit 0 |
| T3 compatibility + quality gate | ⬜ | — | — |
| T-exit | ⬜ | — | — |

**閘證據**(每 task 完成時貼原始輸出):

| Task | `npm run test:ci` |
|---|---|
| T0 | `npm.cmd run test:ci` exit 0;Vitest 98 files / 810 tests passed;Playwright 21 passed |
| T1 | `npm.cmd run test:ci` exit 0;Vitest 98 files / 818 tests passed;Playwright 21 passed |
| T2 | `npm.cmd run test:ci` exit 0;Vitest 99 files / 820 tests passed;Playwright 21 passed |
| T3 | — |
| T-exit | — |

---

## Decision Log

> 編號 `D-33.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-33.1 — §0.1 讀碼收斂:FR-F2 六個「新」欄位裡只有兩個真的新(2026-08-19,T0 覆核落地)

T0 以 `codegraph_explore` + 直接讀碼覆核 `src/data/metadata.ts`、`src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`docs/operational/schema.md`、`docs/operational/pilot-protocol-stage3.md`;結論與規劃期 §0.1 一致:

- `gameMovementProfile` = 既有 `Meta.movementModel`:`src/data/metadata.ts` 固定 `movementModel: 'cs2-source'`;`docs/operational/schema.md` 已寫未來 profile 用新值而非重新解讀 → **不新增欄位**。
- `meta.protocol.{protocolId,conditionIndex,conditionLabel}`(WP-20)是 stage3 pilot 多條件分組:`pilot-protocol-stage3.md` 的 `resolution_detection_v1` 範例使用 conditionIndex/conditionLabel 表示同一 session 內解析度條件,與 stage6 的 `protocolVersion`(凍結任務協定版本)是不同構念 → 新欄位落獨立區塊 `Meta.assessment`,不共用 `meta.protocol`。
- `sessionId` 未曾存在於 `SessionMeta`;`SessionMeta` 只有 `participantId`/`sessionLabel?`,框架 v1 的「session」可由 `participantId + startedAt` 決定性推導 → 不新增儲存欄位,由 T3 推導函式產生。
- `recommendationVersion`/`qualityGateStatus` 依賴 WP-38 的診斷規則表版本與相容鍵判定**結果**,匯出時尚不存在 → 不進 `Meta.assessment`,落在 WP-38 的診斷輸出型別。

**真正新增的 export meta 欄位只有** `protocolVersion` 與 `assessmentFeedbackPolicy`(封裝於 `Meta.assessment`)。T0 未發現與 README §0.1/§2 契約①~④ 不一致的讀碼出入。

**上游複驗證據**:
- **M4/schema v2**:`docs/exec-plan/README.md` 宣告 M4 ✅(2026-07-03);`src/data/metadata.ts` 固定 `SCHEMA_VERSION = 2`;`Meta`/`CollectMetaArgs` 的 v2 擴充欄位沿用 optional + conditional spread 組裝。
- **WP-20**:`docs/exec-plan/completed/stage3/wp-20-display-pipeline/progress.md` 宣告 WP-20 ✅;`src/data/metadata.ts` 已有 `session?`/`protocol?`/`display?`/`frames?` additive 區塊與 guard;`metadata.test.ts`/`export.test.ts` 已覆蓋 `meta.session`/`meta.protocol` 寫入。

**Alternatives considered**:
- 「`protocolVersion` 直接掛在 `meta.protocol.protocolId` 尾端(如 `'resolution_detection_v1@hold-click-v1'`)」— 否決:會讓 WP-39 pilot 的 `conditionIndex/Label` 語意與任務協定版本糾纏,且既有 `pilot-protocol-stage3.md` 的既定用法會被污染。
- 「`sessionId` 另開儲存欄位以簡化下游查詢」— 否決:違反單一來源原則,`participantId+startedAt` 已經是決定性鍵,多一個儲存欄位只會製造「兩者不一致時信哪個」的新問題。

### D-33.2 — 七項 Assessment 契約凍結為 versioned contract(2026-08-19,T0)

以下七項契約是 WP-33 T0 凍結的共同 contract;事後只能升 version 重跑,不得原地改寫或讓下游 WP 各自重定義:

1. `Meta.assessment` 是獨立區塊,只承載 `protocolVersion` 與 `assessmentFeedbackPolicy`;不得與既有 `Meta.protocol` 的 pilot 條件分組混用。
2. `gameMovementProfile` 是 stage6 文件概念名,TS/export 權威欄位仍是既有 `meta.movementModel`;不得新增第二個同義 metadata key。
3. `sessionId` 是推導值,由 `meta.session.participantId + meta.startedAt` 或等價穩定序列化取得;不得新增儲存欄位。
4. `recommendationVersion` 與 `qualityGateStatus` 不進 export meta;前者屬 WP-38 診斷規則表/輸出版本,後者是 `checkQualityGate()` 回傳值。
5. Assessment/Practice 五軸契約凍結:難度、隨機性、即時回饋、歷史比較、重試語意由 `DrillConfig.mode` 與 `Meta.assessment.assessmentFeedbackPolicy` 宣告;省略 mode = Practice 語意。
6. 事件時間線同名事件禁止跨任務改語意;`AssessmentTimelinePoint` 只定義欄位形狀,不含 WP-34 可見度引擎計算。
7. 相容比較鍵九欄位封閉;新增欄位需升 compatibility key version 並更新本契約,不得原地插入。

**Alternatives considered**:
- 「T1/T2/T3 實作時再各自決定欄位落點」— 否決:會讓三個測試家族與診斷層分裂,重蹈 C-D4 的同名不同義風險。
- 「先把 FR-F2 字面欄位全放入 `Meta.assessment`」— 否決:其中四項已有既有欄位、推導來源或下游診斷歸屬,全放入 export meta 會製造第二來源。

### D-33.3 — T1 僅落 additive 型別/guard,不引入 engine 行為分支(2026-08-19,T1)

T1 實作將 `DrillConfig.mode?: 'assessment' | 'practice'` 與 `Meta.assessment?` 落地為可省略欄位;省略 `mode` 與省略 `assessment` 均保持輸出物件不新增 key,既有 drill/export 行為不變。`validateDrill()` 僅做兩個存在性檢查:mode 值域必須封閉;`mode === 'assessment'` 時必須有 `sequence.seed`。它不檢查 difficulty、schedule 內容、feedback 顯示、history 或 retry 行為,避免把 WP-34~38 的 engine/UI/diagnostic 職責提前塞入 WP-33。

`Meta.assessment` 以獨立 `requireAssessmentMeta()` guard 驗證 `protocolVersion` 與 `assessmentFeedbackPolicy`,並允許它與既有 `Meta.protocol` 同時存在;測試覆蓋兩者互不覆寫。T1 沒有新增 `gameMovementProfile`、`sessionId`、`recommendationVersion`、`qualityGateStatus` 四個被 T0 排除的欄位。

**Alternatives considered**:
- 「在 `mode === 'assessment'` 時預設/自動填入 `assessmentFeedbackPolicy`」— 否決:回饋政策屬 export metadata 的明示 provenance,不可由 drill config 靜默推導,也避免 Practice/Assessment 寫入時機混淆。
- 「將缺 `mode` 的 config 正規化成 `mode: 'practice'` 回傳」— 否決:會讓既有 config round-trip 多出新 key,不符合 T1 的零回溯相容成本;省略即 practice 是語意規則,不是強制序列化規則。

### D-33.4 — T2 事件時間線只凍結欄位形狀,不把可見度算法提前落地(2026-08-19,T2)

T2 新增 `src/data/assessmentTimeline.ts`,只輸出 `AssessmentTimelinePoint` 與 `VisibleFractionSeries` 型別;檔案內容不含函式、不讀 sim/render/scene 狀態,維持 WP-33 的零引擎邏輯邊界。`AssessmentTimelinePoint` 欄位皆為 optional readonly,讓 WP-34~37 可逐家族補齊可取得的時間點,但不能藉由本型別重新解釋既有 `t_visible`/`t_detect`/`t_first_on_target`。

`docs/operational/analysis-assessment-contract.md` 新增事件時間線欄位對照表,明確區分既有欄位與新增契約欄位:`t_visible` 是 WP-21 pop-in 的二元 visible event timestamp;`tFirstVisible` 是 WP-34 連續可見度模型下的幾何首次可見。兩者在 pop-in 場景數值上可能相等,但概念上不是同一欄位。

**Alternatives considered**:
- 「在 T2 順手加入 `visibleFraction(t)` builder 或 helper」— 否決:WP-34 T0 spike 尚未決定可見度計算方案,任何 helper 都會偷渡 engine 假設。
- 「把 `tFirstVisible` 映射成既有 `events.visible.t` 的 camelCase alias」— 否決:會讓 pop-in 二元事件與後續連續可見度門檻混成同義欄位,違反 C-D4。

---

## Surprises

> 編號 `S-33.n`。

### S-33.1 — 既有程式碼完全沒有 Assessment/Practice 概念(T0 覆核)

`rg -n "Assessment|Practice mode|feedbackPolicy" src` 對 `src/` 的相關概念零命中(`SessionSetup`/`Protocol` 命名屬既有 session/protocol 流程,語意不同)。這確認 FR-F1 的五軸契約在本 repo 是**全新**構念,沒有可複用的既有型別可延伸——T1 需要從零定義 `AssessmentMode`,不是擴充既有列舉。

### S-33.2 — T2 首次完整 CI 的 Playwright bootstrap flake 可重跑消失

T2 首次在 sandbox 外跑 `npm.cmd run test:ci` 時,TypeScript/Vitest 已通過,但 Playwright 11 個 E2E 在等待 `__aimDebug`/`__fpsTest` 或 renderer backend console 時 timeout。未改程式碼後重跑 `npx.cmd playwright test` 取得 21 passed,再重跑完整 `npm.cmd run test:ci` 取得 Vitest 99 files / 820 tests passed + Playwright 21 passed。判定為本機 Edge/dev-server bootstrap flake,非 T2 純型別變更造成。

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S6-10** | `weaponMode`(相容鍵欄位)在單武器現狀下如何取值 | 🟡 open,見 [README §7](README.md) | 研究者 | WP-33 T3 |
| **OQ-S6-11** | `targetConditionCell` 序列化格式是否需要三家族各自 cell builder | 🟡 open,見 [README §7](README.md) | 研究者 | WP-33 T3 |
