# Diagnosis rules

`src/metrics/diagnosisRules.ts` turns already-derived Assessment metrics into at most one
training diagnosis. It does not calculate geometry, timing, or a cross-construct score.

## Quality and version contract

`evaluateDiagnosis()` accepts a `QualityGateStatus` and immediately returns
`insufficient-data` unless it is `ok`. A non-OK session must never receive a diagnosis.

Every caller supplies `DiagnosisThresholds`. The exported
`PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` is explicitly a pilot-before candidate, not a frozen
athlete-facing standard. Threshold changes require a new `version`; consumers preserve the
version returned with the original result rather than re-evaluating old sessions with new values.

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
