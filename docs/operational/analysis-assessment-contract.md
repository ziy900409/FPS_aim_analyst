# Analysis Assessment Contract

> WP-33 T0 draft. Source WP: [`wp-33-assessment-contract`](../exec-plan/active/stage6/wp-33-assessment-contract/README.md). This document freezes the shared Assessment/Practice, metadata, timeline, compatibility, and quality-gate contract for stage6. T1-T3 will add TypeScript implementation locations; T-exit will finalize this document.

---

## 0. T0 讀碼對帳

| # | Contract question | T0 evidence | Frozen decision |
|---|---|---|---|
| 0-1 | `gameMovementProfile` 是否為新 metadata 欄位 | [`src/data/metadata.ts`](../../src/data/metadata.ts) already exports `movementModel: 'cs2-source'`; [`schema.md`](schema.md) documents future movement profiles as new `movementModel` values, not reinterpretation. | Do not add `gameMovementProfile`. In stage6 prose it means existing `meta.movementModel`. |
| 0-2 | `protocolVersion` 能否共用 `meta.protocol` | [`src/data/metadata.ts`](../../src/data/metadata.ts) defines `ProtocolMeta` as `protocolId`/`conditionIndex`/`conditionLabel`; [`pilot-protocol-stage3.md`](pilot-protocol-stage3.md) uses these fields for `resolution_detection_v1` pilot conditions. | `protocolVersion` belongs in a new `meta.assessment` block; `meta.protocol` remains pilot condition grouping. |
| 0-3 | `sessionId` 是否新增儲存欄位 | [`SessionMeta`](../../src/data/metadata.ts) has `participantId` and optional `sessionLabel`, but no `sessionId`; `startedAt` is already required on `Meta`. | Do not store `sessionId`; derive it deterministically from `meta.session.participantId` and `meta.startedAt`. |
| 0-4 | `recommendationVersion` / `qualityGateStatus` 是否進 export meta | Stage6 FR-F14 makes recommendation rules versioned diagnostic output; `qualityGateStatus` depends on compatibility/sample checks run after export. | Do not add either field to `Meta.assessment`; T3 returns quality status, WP-38 owns recommendation output versioning. |
| 0-5 | Assessment/Practice 是否已有可延伸型別 | [`DrillConfig`](../../src/drill/DrillConfig.ts) and [`validateDrill`](../../src/drill/schema.ts) have no mode field; `rg` found no existing `Assessment`/`Practice mode`/`feedbackPolicy` contract in `src/`. | Add a new optional `DrillConfig.mode?: 'assessment' | 'practice'` in T1; omission means Practice semantics. |

Upstream gates were rechecked by reference, not rerun:

| Upstream | Evidence | T0 conclusion |
|---|---|---|
| M4 / schema v2 | [`docs/exec-plan/README.md`](../exec-plan/README.md) records M4 complete on 2026-07-03; [`src/data/metadata.ts`](../../src/data/metadata.ts) fixes `SCHEMA_VERSION = 2`; [`schema.md`](schema.md) is the v2 export schema source. | The schema v2 foundation exists. WP-33 must remain additive. |
| WP-20 | [`wp-20-display-pipeline/progress.md`](../exec-plan/completed/stage3/wp-20-display-pipeline/progress.md) records WP-20 complete; metadata has optional `display`/`frames`/`session`/`protocol` blocks. | WP-33 follows the same optional-block pattern and must not reuse WP-20 protocol semantics for assessment versioning. |

---

## 1. Seven Frozen Contracts

| # | Contract | T1-T3 TS implementation location |
|---|---|---|
| 1 | `Meta.assessment` is independent from `Meta.protocol`. It carries `protocolVersion` and `assessmentFeedbackPolicy` only. | T1: pending |
| 2 | `gameMovementProfile` is an alias in prose for existing `meta.movementModel`; adding a second metadata key with the same meaning is forbidden. | Existing: `Meta.movementModel`; T3 uses it in compatibility key |
| 3 | `sessionId` is derived, not stored. The canonical derivation is `meta.session.participantId + meta.startedAt` or an equivalent stable serialization. | T3: pending |
| 4 | `recommendationVersion` and `qualityGateStatus` are not export metadata. `recommendationVersion` belongs to WP-38 diagnostic output; `qualityGateStatus` is a quality-gate function result. | T3/WP-38: pending |
| 5 | Assessment/Practice mode is declared by config and interpreted along five axes: difficulty, randomness, feedback, history eligibility, and retry semantics. Missing mode means Practice. | T1: pending |
| 6 | Event timeline names are shared semantics. Downstream WPs may add task-specific fields, but must not reinterpret existing names such as `t_visible`, `t_detect`, or `t_first_on_target`. | T2: pending |
| 7 | Compatibility key fields are closed for v1. Adding another field requires a compatibility-key version bump and a decision record. | T3: pending |

These seven contracts are versioned: after T0, downstream work may only change them by recording a versioned contract change and rerunning affected compatibility decisions. They must not be edited in place to fit a later task.

---

## 2. Assessment / Practice 五軸契約

| Axis | Assessment | Practice | v1 landing |
|---|---|---|---|
| Difficulty | Fixed within a block. | May vary between blocks. | Caller/drill-family responsibility; `DrillConfig.mode` does not inspect block internals. |
| Randomness | Seed and schedule are preserved. | May use a fresh seed. | T1 validation checks that assessment configs provide `sequence.seed`; it does not validate schedule content. |
| Live feedback | Minimal, end-of-block. | Unrestricted. | `Meta.assessment.assessmentFeedbackPolicy`. |
| Historical comparison | Eligible for compatible trend/history. | Excluded by default. | WP-38 consumes `mode`; WP-33 does not store history. |
| Retry | Failure does not redraw the formal assessment schedule. | Quick restart/retry allowed. | Caller/drill-runner policy in later WPs; not in WP-33 T0. |

`DrillConfig.mode` omission is defined as Practice semantics so existing drill configs remain byte-for-byte compatible and do not become formal Assessment data by accident.

---

## 3. Acceptance Checklist F Prerequisites

T-exit will complete this section after T1-T3 land. Current T0 preregistration:

| Stage F prerequisite | WP-33 contract hook | Status |
|---|---|---|
| Assessment/Practice do not share a formal baseline | `DrillConfig.mode` + history eligibility contract | T1/T3 pending |
| Incompatible sessions do not produce progress/regression claims | closed `CompatibilityKey` + `checkCompatibility()` | T3 pending |
| Low-quality sessions do not produce prescriptions | `checkQualityGate()` result, not export metadata | T3 pending |
| Pilot parameters and formal parameters stay separate | `Meta.protocol` pilot grouping remains independent from `Meta.assessment.protocolVersion` | T1 pending |
| Shared event names keep the same meaning across task families | `AssessmentTimelinePoint` plus no-reinterpretation rule | T2 pending |
