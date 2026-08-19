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
| 1 | `Meta.assessment` is independent from `Meta.protocol`. It carries `protocolVersion` and `assessmentFeedbackPolicy` only. | T1: [`src/data/metadata.ts`](../../src/data/metadata.ts) |
| 2 | `gameMovementProfile` is an alias in prose for existing `meta.movementModel`; adding a second metadata key with the same meaning is forbidden. | Existing: `Meta.movementModel`; T3 uses it in compatibility key |
| 3 | `sessionId` is derived, not stored. The canonical derivation is `meta.session.participantId + meta.startedAt` or an equivalent stable serialization. | T3: [`deriveSessionId()`](../../src/metrics/compatibilityKey.ts) |
| 4 | `recommendationVersion` and `qualityGateStatus` are not export metadata. `recommendationVersion` belongs to WP-38 diagnostic output; `qualityGateStatus` is a quality-gate function result. | T3: [`checkQualityGate()`](../../src/metrics/compatibilityKey.ts); WP-38 pending |
| 5 | Assessment/Practice mode is declared by config and interpreted along five axes: difficulty, randomness, feedback, history eligibility, and retry semantics. Missing mode means Practice. | T1: [`src/drill/assessmentContract.ts`](../../src/drill/assessmentContract.ts), [`src/drill/DrillConfig.ts`](../../src/drill/DrillConfig.ts) |
| 6 | Event timeline names are shared semantics. Downstream WPs may add task-specific fields, but must not reinterpret existing names such as `t_visible`, `t_detect`, or `t_first_on_target`. | T2: `src/data/assessmentTimeline.ts` |
| 7 | Compatibility key fields are closed for v1. Adding another field requires a compatibility-key version bump and a decision record. | T3: [`src/metrics/compatibilityKey.ts`](../../src/metrics/compatibilityKey.ts) |

These seven contracts are versioned: after T0, downstream work may only change them by recording a versioned contract change and rerunning affected compatibility decisions. They must not be edited in place to fit a later task.

### 1.1 Event Timeline Field Mapping

T2 adds [`AssessmentTimelinePoint`](../../src/data/assessmentTimeline.ts) as a shared field-shape contract only. It does not compute visibility, detection, acquisition, stopping, or firing times.

| Field / event | Status | Owner / source | Contract meaning |
|---|---|---|---|
| `events.visible.t` / `t_visible` | Existing; do not redefine | WP-21 pop-in target visibility event, recorded by `TargetManager` / `DrillEvent.type === 'visible'` | Binary pop-in visibility timestamp. It anchors current reaction, detection, phase, and tracking windows. |
| `t_detect` | Existing; do not redefine | `src/metrics/detectionDerivation.ts` and `docs/operational/analysis-t-detect.md` | Offline sustained aim-onset proxy derived from eccentricity after `t_visible`. |
| `t_first_on_target` | Existing; do not redefine | `src/metrics/trackingDerivation.ts` and `docs/operational/analysis-tracking.md` | First tick in a presentation window where on-target is true; anchors `t_acquire` and tracking windows. |
| `target_stop` | Existing concept; do not redefine | `src/metrics/compute.ts` / peek-window metrics | Counter-strafe stop timing currently derived from existing counter/fire/velocity semantics. |
| `t_fire` | Existing; do not redefine | `DrillEvent.type === 'fire'`, `src/metrics/compute.ts`, and projectile/recoil tests | Fire timestamp used by first-shot, lead, recoil, and timing metrics. |
| `tFirstVisible` | New WP-33 contract field; calculation deferred | `AssessmentTimelinePoint` | Geometric first visibility under the future continuous visibility model. In pop-in scenarios it may equal `t_visible`, but it is not the same field: pop-in has no gradual visibility fraction. |
| `tMeasurementOnset` | New WP-33 contract field; calculation deferred | `AssessmentTimelinePoint` | Versioned measurement-onset timestamp after the visibility threshold definition is chosen by WP-34. |
| `tFullExposure` | New WP-33 contract field; calculation deferred | `AssessmentTimelinePoint` | Timestamp when full exposure is reached under the future visibility model. |
| `tStop` | New WP-33 contract field; calculation deferred | `AssessmentTimelinePoint` | Assessment timeline stop timestamp. Downstream WPs must define how it maps to a family-specific stop condition before filling it. |

Downstream WPs must import the shared type when they need these new fields, and must keep existing `t_visible` / `t_detect` / `t_first_on_target` semantics intact. A task family may add its own fields, but cannot reuse an existing name with a different meaning.

### 1.2 Compatibility Key and Quality Gate

T3 adds [`CompatibilityKey`](../../src/metrics/compatibilityKey.ts) as the only sanctioned stage6 compatibility comparison surface. Downstream WPs must build keys through `buildCompatibilityKey()` and compare them through `checkCompatibility()`; they must not rewrite partial comparisons in task-family code.

`buildCompatibilityKey(meta, taskId, targetConditionCell, qualityGateStatus)` requires `meta.session`, `meta.assessment`, `meta.fovDeg`, and a non-empty caller-provided `targetConditionCell`. Missing required Assessment provenance throws instead of silently producing a trend-eligible key.

| Field | Source | v1 rule |
|---|---|---|
| `participantId` | `meta.session.participantId` | Trimmed non-empty string; same participant only. |
| `taskId` | Caller argument | Frozen task-family id such as `hold-click-v1`; does not include pilot `conditionIndex`. |
| `protocolVersion` | `meta.assessment.protocolVersion` | Exact string match only. |
| `gameMovementProfile` | `meta.movementModel` | Existing metadata field; do not add `gameMovementProfile` to export meta. |
| `weaponId` | `meta.weaponId` | Exact active weapon id. |
| `weaponMode` | T3 initial derivation from `meta.weaponId` | OQ-S6-10 initial decision: no independent Assessment `weaponMode` field exists yet. Existing weapon ids already encode current hip/ADS BR variants, so v1 uses `weaponId` as the non-lossy placeholder. Split only through a versioned contract change. |
| `sensitivityFovKey` | `meta.sensitivity` + `meta.fovDeg` | Deterministic serialization: `sensitivity=<value>;fovDeg=<value>`. `meta.fovDeg` is required for Assessment compatibility. |
| `targetConditionCell` | Caller argument | OQ-S6-11 initial decision: caller-owned non-empty string. WP-34~37 may choose family-specific formats, but WP-33 does not parse them. |
| `assessmentFeedbackPolicy` | `meta.assessment.assessmentFeedbackPolicy` | Exact string match only. |
| `qualityGateStatus` | `checkQualityGate()` result | Exact string match only; not stored in export meta. |

`checkCompatibility(a, b)` is a closed-field exact comparison. Any one field differing returns `false`; there is no fuzzy matching, defaulting, or field omission.

`checkQualityGate({ n, minN, suspect, compatible })` returns the first matching status in this priority order:

1. `insufficient-n` when `n < minN`.
2. `incompatible-protocol` when `compatible === false`.
3. `suspect-run` when `suspect === true`.
4. `ok` otherwise.

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
| Incompatible sessions do not produce progress/regression claims | closed `CompatibilityKey` + `checkCompatibility()` | T3 implemented |
| Low-quality sessions do not produce prescriptions | `checkQualityGate()` result, not export metadata | T3 implemented |
| Pilot parameters and formal parameters stay separate | `Meta.protocol` pilot grouping remains independent from `Meta.assessment.protocolVersion` | T1 implemented |
| Shared event names keep the same meaning across task families | `AssessmentTimelinePoint` plus no-reinterpretation rule | T2 implemented |
