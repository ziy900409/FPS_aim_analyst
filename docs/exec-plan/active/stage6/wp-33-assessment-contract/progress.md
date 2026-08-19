# WP-33 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ⬜ | — | — |
| T1 metadata extension | ⬜ | — | — |
| T2 event timeline contract | ⬜ | — | — |
| T3 compatibility + quality gate | ⬜ | — | — |
| T-exit | ⬜ | — | — |

**閘證據**(每 task 完成時貼原始輸出):

| Task | `npm run test:ci` |
|---|---|
| T0 | — |
| T1 | — |
| T2 | — |
| T3 | — |
| T-exit | — |

---

## Decision Log

> 編號 `D-33.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-33.1 — §0.1 讀碼收斂:FR-F2 六個「新」欄位裡只有兩個真的新(2026-08-19,規劃期讀碼;T0 待覆核落地)

`grep`/`codegraph_explore` 對 `src/data/metadata.ts`、`src/drill/DrillConfig.ts`、`docs/operational/schema.md`、`docs/operational/pilot-protocol-stage3.md` 的讀碼發現:

- `gameMovementProfile` = 既有 `Meta.movementModel`(`schema.md` 早已預告未來 profile 用新值而非重新解讀同一欄位)→ **不新增欄位**。
- `meta.protocol.{protocolId,conditionIndex,conditionLabel}`(WP-20)是 stage3 pilot 多條件分組,與 stage6 的 `protocolVersion`(凍結任務協定版本)是不同構念 → 新欄位落獨立區塊 `Meta.assessment`,不共用 `meta.protocol`。
- `sessionId` 未曾存在於 `SessionMeta`;框架 v1 的「session」本來就可由 `participantId + startedAt` 決定性推導 → 不新增儲存欄位,由 T3 推導函式產生。
- `recommendationVersion`/`qualityGateStatus` 依賴 WP-38 的診斷規則表版本與相容鍵判定**結果**,匯出時尚不存在 → 不進 `Meta.assessment`,落在 WP-38 的診斷輸出型別。

**真正新增的 export meta 欄位只有** `protocolVersion` 與 `assessmentFeedbackPolicy`(封裝於 `Meta.assessment`)。此收斂於本 WP T0 覆核並落地為 README §0.1/§2 契約①~④;若 T0 執行時發現讀碼有誤,於此處更新並記新的 `D-33.n`。

**Alternatives considered**:
- 「`protocolVersion` 直接掛在 `meta.protocol.protocolId` 尾端(如 `'resolution_detection_v1@hold-click-v1'`)」— 否決:會讓 WP-39 pilot 的 `conditionIndex/Label` 語意與任務協定版本糾纏,且既有 `pilot-protocol-stage3.md` 的既定用法會被污染。
- 「`sessionId` 另開儲存欄位以簡化下游查詢」— 否決:違反單一來源原則,`participantId+startedAt` 已經是決定性鍵,多一個儲存欄位只會製造「兩者不一致時信哪個」的新問題。

---

## Surprises

> 編號 `S-33.n`。

### S-33.1 — 既有程式碼完全沒有 Assessment/Practice 概念(規劃期讀碼)

`grep -rniE "Assessment|Practice mode|feedbackPolicy" src/` 對 `src/` 零命中(`SessionSetup.ts` 命中是既有 session 設定面板,語意不同)。這確認 FR-F1 的五軸契約在本 repo 是**全新**構念,沒有可複用的既有型別可延伸——T1 需要從零定義 `AssessmentMode`,不是擴充既有列舉。

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S6-10** | `weaponMode`(相容鍵欄位)在單武器現狀下如何取值 | 🟡 open,見 [README §7](README.md) | 研究者 | WP-33 T3 |
| **OQ-S6-11** | `targetConditionCell` 序列化格式是否需要三家族各自 cell builder | 🟡 open,見 [README §7](README.md) | 研究者 | WP-33 T3 |
