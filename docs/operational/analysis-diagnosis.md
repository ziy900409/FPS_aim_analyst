# Diagnosis rules

> WP-38 T-exit final. Source WP: [`wp-38-diagnosis-recommendation`](../exec-plan/active/stage6/wp-38-diagnosis-recommendation/README.md) (T0–T3 + T-exit all ✅, 2026-08-25). Freezes the seven-mode evidence table and its precedence, threshold versioning discipline, the `recommendationVersion`/`protocolVersion` relationship, and the personal session history contract for stage6. WP-39 may enter on this contract; threshold value changes still require a new `DiagnosisThresholds.version` (§Quality and version contract), not an in-place edit.

`src/metrics/diagnosisRules.ts` turns already-derived Assessment metrics into at most one
training diagnosis. It does not calculate geometry, timing, or a cross-construct score.

## Quality and version contract

`evaluateDiagnosis()` accepts a `QualityGateStatus` and immediately returns
`insufficient-data` unless it is `ok`. A non-OK session must never receive a diagnosis.

Every caller supplies `DiagnosisThresholds`. The exported
`PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` is explicitly a pilot-before candidate, not a frozen
athlete-facing standard. Threshold changes require a new `version`; consumers preserve the
version returned with the original result rather than re-evaluating old sessions with new values.

## Placement decision (OQ-S6-8, OQ-S6-23)

Single-session diagnosis stays in TS, wired into `ResultScreen`'s existing optional
promoted-metrics render seam (D-38.1): every diagnosis input is already produced by a TS metrics
module, and this keeps the diagnosis available the moment a drill ends without adding a Python
dependency or a second rule implementation. Personal history is a new capability rather than an
extension of an existing one — no export before WP-38 carries a TS diagnosis result, and neither
`ResultScreen.ts` nor `research/src/report/coach_report.py` had any multi-file or cross-session
aggregation entry point (`ExportPayload` only carries `meta`, `ticks`, `events`). History therefore
uses a manual multi-file `<input type=file multiple>` loader living in TS (D-38.2), not a Python
directory-scan tool: `research/fixtures/exports/` is a controlled test fixture corpus rather than a
coach folder workflow, and a Python path would still need a new diagnosis sidecar contract plus a
second presentation surface. The trade-off is explicit: there is no cross-device persistence,
which stays out of this WP's scope.

## Recommendation versioning vs protocol versioning (OQ-S6-25)

`recommendationVersion` and `protocolVersion` vary independently and are never combined into one
version string. `protocolVersion` (`meta.assessment`, WP-33) freezes the Assessment task protocol
itself — the geometry, timing, and feedback rules a session was run under. `recommendationVersion`
(this document) freezes only the diagnosis rule table's thresholds and evidence chain — how an
already-recorded session's metrics are interpreted. A session's raw metrics do not change when the
rule table is revised; only which label, if any, that session would receive under the new
thresholds can change. A stored `DiagnosisResult.recommendationVersion` is never rewritten in place
to reflect a newer rule table: old sessions may be re-evaluated with a newer `DiagnosisThresholds`
for research purposes, but the diagnosis label recorded against a session's own history entry is
not retroactively altered by a later rule-table version bump.

## Evidence table and precedence

Rules are evaluated in the framework-v1 order below. The first complete evidence chain becomes
the sole `primary` finding; it excludes every later rule and leaves `secondary` absent. This makes
overlapping evidence deterministic and prevents two labels for one limiting pattern.

| Order | Label | Evidence sources | Training direction |
| --- | --- | --- | --- |
| 1 | `preaim-placement` | hold-click pre-aim eccentricity high; detection latency normal | 架槍線與弱側位置校準 |
| 2 | `visual-motor-onset` | hold-click pre-aim eccentricity normal; detection latency slow | 隨機 foreperiod 出現偵測 |
| 3 | `flick-control` | normal onset plus slow acquisition and high Spider Shot overshoot; onset/acquisition may use Spider Shot-only reaction/movement values when hold-click is absent | 降速 Spider Shot、一次乾淨停止 |
| 4 | `click-timing` | acquisition normal; first shot after on-target slow | 首次進靶後開火控制 |
| 5 | `tracking-maintenance` | acquisition normal; hold-track TOT low (drop count is retained as context) | 固定速度持續控制 |
| 6 | `counterstrafe-braking` | counter-strafe over-reversal speed high | 反向制動，不提高瞄準難度 |
| 7 | `fire-commitment` | counter-strafe braking normal, accuracy gate reached promptly, but counter-to-fire slow | gate 後快速首發 |

The present counter-strafe summary exposes no per-shot residual-speed aggregate. Until a dedicated
aggregate is added by a later scoped task, the versioned residual-speed threshold is applied to the
available `overReversalUPerS` braking proxy and is labelled as such in the evidence metric ID.

## Evidence provenance

Each evidence item carries its closed metric ID, finite-sample mean, `n`, and any source flags.
Hold-click and Spider Shot per-target values are aggregated across every finite sample, rather than
choosing a best result. Counter-strafe left/right means are pooled with their original sample counts.

## Personal session history

`buildSessionHistory()` uses the current session only as a compatibility reference. It selects the
newest compatible prior sessions up to the configured fixed window, returns them oldest-to-newest
for presentation, and reports their median plus population standard deviation. It does not produce
a delta or an up/down arrow. A current non-`ok` quality gate, fewer than `minN` eligible sessions,
or a different speed/accuracy metric ID returns `insufficient-data` instead.

Assessment eligibility is deliberately strict: the multi-file loader accepts only exports containing
`meta.assessment`. `DrillConfig.mode` is not serialized into export metadata; therefore missing
`meta.assessment` is treated as Practice (including legacy exports) and excluded from formal history.
The loader parses files and applies this guard only. Family-specific metric reconstruction remains
with its caller because raw exports do not persist every scene and condition input needed to rebuild
diagnosis metrics.

| Test family | Speed metric | Accuracy metric |
| --- | --- | --- |
| Hold-click | mean `acquisitionFromDetectMs` | first-shot-hit rate |
| Hold-track | mean acquisition time | TOT percent |
| Spider Shot | `rhythm.medianMs` | first-shot-hit rate |
| Counter-strafe | mean `counterToFireMs` | `firstShotHitRate` |
