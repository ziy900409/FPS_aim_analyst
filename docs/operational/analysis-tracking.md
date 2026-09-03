# Tracking Metrics Offline Derivation

> WP-18 T4 operational spec. This is the analysis-side interface for tracking drills
> (`tracking_v1`: single moving target + timed presentation, player aiming from a static position).
> The engine records raw v2 ticks/events only; `t_acquire`, TOT%, and RMS ε are derived offline
> (GD-7: raw-over-derived, zero new sim computation, zero new threshold parameter).

## Inputs

Use schema v2 JSON exports:

- `meta.schemaVersion === 2`
- `meta.simHz`, normally `128`
- `ticks[].t`, `ticks[].aim.yaw`, `ticks[].aim.pitch`
- `ticks[].px`, `ticks[].pz`
- `ticks[].tx`, `ticks[].ty`, `ticks[].tz` while a target is active (the moving target center trajectory)
- `events[]` rows with `type:"visible"`, `t`, `targetId`, and `targetX/targetY/targetZ`
- `meta.targets.hitbox` when present: `{ widthU, heightU, depthU }`

Time fields are milliseconds in the same `performance.now()` basis. Angles are radians in export
rows unless this spec explicitly says degrees. Target/player positions are source units.

The H1 hitbox dimensions are **not** exported per tick. New v2 exports snapshot the resolved target
hitbox once in `meta.targets.hitbox`; older exports omit that block and fall back to the default H1
(`width 1, height 2, depth 1` source units). The derivation consumes that snapshot so the on-target
geometry is identical to the engine hit detector; this is not a tuning knob.

## Coordinate Convention

For each tick, reconstruct the player aim forward vector from exported yaw/pitch:

```text
f_aim = (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch))
```

For the target vector, use the tick target center when present (the target moves, so use the
per-tick center, not the spawn center):

```text
p_eye = eyeBase + (px, 0, pz) * simToWorld
p_target = (tx, ty, tz)
```

`p_eye` is in **world domain** (the same domain as `p_target`, hitbox, and scene geometry);
`(px, pz)` are **source units** (sim domain) and must be scaled by `simToWorld` before combining
with `eyeBase` — mixing the two domains without the scale factor was KI-004's root cause (D2a/D2b).

`eyeBase` (world) and `simToWorld` (world unit per source unit) come from the export's
`meta.scene.eye` and `meta.simToWorld` (present on S1-and-later exports; TS reference
implementation: `resolveEyeOrigin` in `src/metrics/eyeOrigin.ts`). Pre-S1 exports lack both fields;
callers must then supply an explicit eye base (source = `'explicit'`) or accept the
`'legacy-default'` fallback `eyeBase = (0, 1.6, 0)` (still scaled by `simToWorld`) — `'explicit'`
and `'legacy-default'` are the only two safety nets, and `'legacy-default'` cannot recover a
scene's true `eyeBase.z`. When a tick has no target center (gap before the first active tick),
fall back to the `visible.targetX/targetY/targetZ` center.

<!-- TODO(S3): CONTEXT.md's "positions are source units" convention still needs a global rewrite
     to state which fields are world domain (geometry/eyeBase/target) vs source domain
     (px/pz/vx/vStrafe); out of scope for this section's origin-definition fix. -->

## on-target (per-tick binary)

`on-target(t)` is true when the aim ray intersects the H1 hitbox centered at the target. The
geometry follows `meta.targets.hitbox.shape` — omitted or `'box'` gives the axis-aligned box,
`'sphere'` gives a ball of radius `w/2` (the shape requires all three axes equal):

```text
box    = [tx - w/2, tx + w/2] x [ty - h/2, ty + h/2] x [tz - d/2, tz + d/2]
sphere = { p : |p - (tx,ty,tz)| <= w/2 }
on-target(t) = ray(p_eye, f_aim) intersects that solid at some parameter s >= 0
```

This is the **same geometry as the engine hit detection** (`THREE.Ray.intersectBox` /
`intersectSphere`), evaluated with a ray/box slab test or the analytic ray/sphere test. There is
**no new threshold parameter** (CONTEXT §A / GD-7): on-target is exactly "would a shot along the
aim ray hit the target this tick".

> Until KI-021 (2026-09-03) the derivation ran the slab test unconditionally and dropped `shape`,
> so a sphere target was scored against its **bounding cube** — up to sqrt(2)x too permissive on
> the diagonal. Exports produced before that fix carry the cube reading for any sphere drill
> (`spider-shot-v2`); see [KI-021](../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md).

## Tracking Error ε(t)

ε(t) is the unsigned angular distance between the aim ray and the target center, in degrees — the
same math as the fire-time aim-alignment offset, generalized to every tick (CONTEXT §A):

```text
epsilon(t) = acos(clamp(dot(normalize(f_aim), normalize(p_target - p_eye)), -1, 1))
```

Report ε in degrees. It aligns with `targetCenterOffsetDeg` (unsigned `angleTo`).

## t_acquire and the Tracking Window

```text
t_first_on_target = first tick t in [t_visible, presentation_end) with on-target(t) = true
t_acquire         = t_first_on_target - t_visible
tracking_window   = [t_first_on_target, presentation_end)
```

`presentation_end` is the next `visible.t` (the drill advanced to the next target), or the end of
the export for the last presentation. A presentation window must not leak samples into the next
presentation.

If **no** tick in the presentation is on-target, the presentation is an **acquisition failure**:
`t_acquire` is undefined, the presentation counts toward the acquisition failure rate, and it is
**excluded from TOT / ε aggregation**. Acquisition failure is a valid observed outcome, not
missing data (GD-7).

`t_acquire` measures the flick/acquisition construct and is separated from pursuit so that
acquisition ability does not contaminate the pursuit measurement.

## TOT% and RMS ε (pursuit)

Both are computed **only inside the tracking window**, so acquisition does not pollute pursuit:

```text
TOT%     = 100 * (on-target ticks in tracking_window) / (ticks in tracking_window)
RMS(eps) = sqrt( mean( epsilon(t)^2 for t in tracking_window ) )   <- pre-registered primary stat
```

RMS(ε) is the pre-registered primary statistic because it is quadratically sensitive to the moment
of losing the target. `median(ε)`, `P95(ε)`, and on-target streak length are offline secondary
metrics.

## Boundary Cases

- **No acquisition** (whole presentation off-target): `acquisitionFailure = true`; report no
  `t_acquire` / TOT% / RMS ε; count toward the acquisition failure rate.
- **Very short presentation** (window shorter than `k` ticks): compute over the available ticks;
  TOT% and RMS ε are still defined but statistically thin. Downstream analysis should note small
  `trackingWindowTickCount`.
- **Multiple presentations**: end each presentation window at the next `visible.t`; aggregate
  `acquisitionFailureRate = failures / total presentations`.
- **Missing `visible.targetX/targetY/targetZ` and missing tick target center at spawn**: invalid
  for this derivation.

## Sensitivity Analysis

The metric definitions have no free threshold (on-target reuses the hit geometry; ε and RMS are
parameter-free). The tuning that matters is at the **drill** layer, not the derivation:

- motion `speed` (`1`, `2`, `4` u/s) and `range` (`0.5`, `1.0`, `1.5` u) — pursuit difficulty
- `presentationMs` — tracking window length and t_acquire ceiling

Report how median t_acquire, acquisition failure rate, TOT%, and RMS ε change across the drill
sweep. The speed/clutter experiment matrix is WP-22 T3.

## Result Page / Export Field Semantics

These derived fields are presented on the result page (implementation is WP-22 consumer side /
later UI WP); they are **not** written by the engine export:

| Field | Unit | Meaning |
|---|---|---|
| `t_acquire` | ms | `t_first_on_target − t_visible`; undefined on acquisition failure. |
| `acquisition_failure_rate` | ratio [0,1] | failed presentations / total presentations. |
| `TOT%` | percent [0,100] | on-target fraction inside the tracking window. |
| `RMS(ε)` | deg | primary pursuit statistic over the tracking window. |
| `median(ε)`, `P95(ε)` | deg | offline secondary pursuit statistics. |

## Reference Implementation

The TypeScript dev verifier in `src/metrics/trackingDerivation.ts` implements this spec against the
production `ExportPayload` JSON shape. Its tests synthesize aim trajectories over a moving target,
round-trip them through `DataRecorder` and `buildExportPayload()`, then assert: perfect tracking
(TOT% = 100, RMS ε ≈ 0, t_acquire ≈ 0), acquisition failure (aim never covers the target), and a
known acquisition onset recovered within one 128 Hz tick.

## WP-55 Contact Artifact, Coverage, Replay, and Report

WP-55 makes the P0 tracking observability contract explicit without adding a health model. The
researcher-facing chain is:

```text
ExportPayload -> tracking-contact-artifact-v1 -> coverage -> replay trace/report
```

`tracking-contact-artifact-v1` is produced by `buildTrackingContactArtifact()` from the raw export
and the canonical contact derivation. It records `analysisVersion = tracking-contact-v1`, source
identity, drill id, schema/simHz, hitbox/eye-origin provenance, and per-tick contact rows (`t`,
`targetId`, target center, aim yaw/pitch, `onTarget`, `epsilonDeg`, presentation index, and tracking
window). The artifact is the source of truth for downstream coverage, replay trace, and report
projections; those consumers must consume the contact artifact and must not redefine contact or use
shooting outcome as a substitute.

The primary answer to "was the player following the target?" is exact-hitbox aim-ray `onTarget`,
TOT%, and RMS/median/P95 ε. A blood bar is not required and must not be introduced for this
construct: HP, damage, hit count, and kill count are shooting/lifecycle outcomes, not per-tick
tracking contact evidence.

Blocked or incompatible runs stay reason-coded. A report must show the closed WP-55 reason
vocabulary (`schema-version-unsupported`, `missing-visible-event`, `missing-target-telemetry`,
`missing-eye-origin`, `invalid-hitbox`, `no-tracking-drill`, `protocol-incompatible`) instead of
displaying a fake `0` TOT/RMS value or an empty contact timeline. Legacy/incompatible/protocol
mismatch runs are excluded from aggregates, with excluded source ids and reason counts retained.

For `tracking_br_v1`, BR/projectile evidence is companion-only. Reports may show ballistic
hitscan/projectile hit counts beside aim-ray on-target evidence, but those columns must not be mixed
into the pure tracking summary or used to overwrite exact-hitbox contact.

---

## P1 — Tracking Pilot Dynamics (WP-54 / T3)

> Metric version `tracking-dynamics-v1` (D-54.10). Reference implementation:
> `src/metrics/trackingDynamics.ts` (`deriveTrackingDynamics()`, `deriveTrackingReversalWindows()`),
> tested in `src/metrics/trackingDynamics.test.ts`. This section covers the tracking-pilot-specific
> P1 layer (FR-54-6~9); the P0 layer above (`deriveTrackingMetrics()`) is unchanged and reused
> as-is — this module never modifies `trackingDerivation.ts`.

### Scored-window adapter (P0 reuse, no change to the canonical derivation)

WP-54 pilot blocks insert a `timing.trackingPrepMs` centering window between `visible` and
`scored_start` (T2). Pursuit aggregation must start at `scored_start`, not `visible`, so this
module builds a shallow `ExportPayload` copy — `adaptPayloadForScoredWindow()` — that replaces each
`visible` event's `t` (and target position) with the matching `scored_start` event's `t`/position
for the same `targetId`, then calls the unmodified `deriveTrackingMetrics()`/`deriveTrackingSamples()`
on that copy. A payload with no `scored_start` events at all (e.g. a legacy tracking export) passes
through unchanged and P1 falls back to plain `visible`-windowed P0 — permissive, not an error. This
keeps the blast radius on the 11-caller canonical derivation at zero (D-54.13).

All P1 metrics below operate on the **post-acquisition** window `[t_first_on_target, window_end)` —
the same tracking window P0 already defines — so acquisition ability never contaminates pursuit
dynamics (same rationale as P0's own `t_acquire`/TOT/RMS ε separation).

### Target/aim angular kinematics (signed, tick-integral, wraparound-safe)

Aim angular velocity reads `ticks[].dYaw`/`dPitch` (KI-005 tick-window mouse integration) directly,
never a difference of `ticks[].aim.yaw/pitch` — the same render/sim beat-aliasing avoidance as
`angularKinematics.ts`'s `omegaDegPerSec()`. Target angular velocity is derived by inverting
`aimForward()` against the tick's target position — `yaw = atan2(-dx, -dz)`, `pitch = asin(dy)`,
where `(dx,dy,dz)` is the (target − eye) vector — then tick-differenced with the delta wrapped into
`[-180°, 180°]` before dividing by `dt` (a band-limited/reversal trajectory can cross the ±180° seam
depending on config bounds). Both series are indexed by consecutive tick pairs — the first tick in a
window produces no sample (same contract as `omegaDegPerSec`).

A tick is missing required telemetry (`missing-target-telemetry`, see below) when its target
position is `null`, or when `dYaw`/`dPitch` are undefined at an index that needs them.

### Offline fixed-coefficient smoothing (`smoothingVersion`, D-54.5)

`TrackingDynamicsOptions.smoothingVersion` selects a **fixed-coefficient FIR kernel** applied to the
four omega component series before lag search — never to the position/bias values. Recognized
versions:

| `smoothingVersion` | Kernel | Notes |
|---|---|---|
| `tracking-dynamics-smoothing-v1-none` | `[1]` (identity) | Default for truth-fixture verification — keeps recovered lag/gain exactly traceable to the synthetic construction. |
| `tracking-dynamics-smoothing-v1-tri3` | `[0.25, 0.5, 0.25]` | Symmetric 3-tap triangular FIR; edge taps renormalize against available neighbors. |

An unrecognized `smoothingVersion` fails fast (same discipline as `trackingTrajectory.ts`'s unknown
`kind` guard) — this is a config/version error, not one of the five closed blocked-result reasons.

### Lag sign contract, velocity gain, velocity residual (FR-54-7, D-54.5/OQ-54-4)

```text
corr(omega_target(t), omega_aim(t + tau))  maximized over tau in options.lagSearchMs (frozen [0,250]ms)
tau > 0  =>  aim lags target

velocity_gain =
  sum(dot(omega_target(t), omega_aim(t + tau_hat))) /
  sum(dot(omega_target(t), omega_target(t)))
```

`tau` is quantized to whole sim ticks (`tau_hat = k_hat * (1000/simHz)` for integer `k_hat`) — this
assumes the fixed-step sim's uniform tick spacing, not a generic irregularly-sampled algorithm. Peak
selection uses the **mean** dot product per candidate `k` (fair across the slightly different
overlap length near the search boundary, since the overlap shrinks by `k` ticks); `velocity_gain`
and `velocity_rmse_deg_per_sec` are then computed from the **sum** dot products at the chosen
`k_hat`, matching the formula above exactly — sum and mean over an identical index range are
proportional, so mean-based peak selection and sum-based gain/RMSE are consistent.
`velocity_rmse_deg_per_sec` is the RMS magnitude of the residual vector
`omega_aim(t+tau_hat) - gain * omega_target(t)` over the same overlap.

### Lag ambiguity (`lag-peak-ambiguous`)

Local peaks of the mean-correlation-vs-`tau` curve are collected (a point is a local peak when it is
`>=` both neighbors, boundary points compared only against their one neighbor). If a 2nd-best peak
exists whose value exceeds `1 / options.correlationAmbiguityRatio` times the best peak's value, the
result is `blocked, reason: 'lag-peak-ambiguous'` — a periodic/multi-peak signal must never resolve
to one silently-chosen lag/gain (§3 risk register: "系統品質污染能力指標" / "Lag 多峰仍回傳單值").
`correlationAmbiguityRatio = 2` (best peak must be at least 2x the second-best) is the value used by
the truth-fixture suite; it is a default subject to T6/T7 empirical calibration, not a D-54.5 frozen
number (only the `[0,250]ms` search range and the existence of this gate are frozen).

### Directional bias (signed, unnormalized — §2.5 "P1 directional")

```text
signed_yaw_bias_deg   = mean over the post-acquisition window of wrap(aim_yaw_deg(t) - target_yaw_deg(t))
signed_pitch_bias_deg = mean over the post-acquisition window of wrap(aim_pitch_deg(t) - target_pitch_deg(t))
```

Reported as two independent signed numbers (positive yaw = aim right of target; positive pitch =
aim above target) — never normalized into one scalar, and never combined with lag/gain into a
composite score.

### Recovery aggregation (FR-54-8: drop/sec, completed vs. terminal-censored, longest off-target)

Reuses `deriveTrackingTransitions()` unmodified (shared with spider-shot) over the presentation's
full sample array (same window P0 itself scans for on-target transitions):

- `dropRatePerSec = dropCount / pursuitDurationSec`, where `pursuitDurationSec` is the elapsed time
  from `t_first_on_target` to the last recorded sample.
- `completedReacquireCount = reacquireMs.length` (unchanged semantics).
- `terminalDropCount = dropCount - reacquireMs.length` — `deriveTrackingTransitions()`'s `dropCount`
  already counts a final unrecovered drop that `reacquireMs` deliberately excludes, so this recovers
  the terminal count for free, with **no risk of double-counting or leaking a terminal drop's
  remaining time into a "completed" duration** (§1.3 constraint).
- `longestOffTargetMs` is computed independently by scanning the same on-target/off-target
  transitions for the longest contiguous off-target run, including an open (never-reacquired)
  terminal run extending to the end of the observed window. It is its own field, never merged into
  `reacquireMs`/`completedReacquireCount`.

### Reversal event windows (FR-54-9 — `deriveTrackingReversalWindows()`, a separate function)

README §2.4's `TrackingDynamicsResult` contract has no reversal-specific fields (by design — it is
copied verbatim from the frozen interface). Response latency / peak error / overshoot / settling
time are additive, computed by a second exported function windowed on `target_motion_change` event
boundaries (T2's precomputed reversal leg schedule). A pursuit (core matrix) block legitimately
produces **zero** `target_motion_change` events — `deriveTrackingReversalWindows()` then returns
`{ windows: [] }`, which is normal/empty, **not** a blocked state.

For each `target_motion_change` event at `changeTMs`, using the scored-window ε(t) series:

- `baselineErrorDeg` = ε(t) at (or just before) `changeTMs` — the steady pursuit error level right
  before the reversal.
- `peakErrorDeg` = max ε(t) over the usable window after `changeTMs`.
- `overshootDeg` = `max(peakErrorDeg - baselineErrorDeg, 0)`.
- `responseLatencyMs` = elapsed time until ε(t) first exceeds `baselineErrorDeg` by a small fixed
  margin (the moment the reversal starts to visibly disturb tracking).
- `settlingTimeMs` = elapsed time until ε(t) returns to within `baselineErrorDeg +
  options.settlingToleranceDeg` **and stays there** for the remainder of the usable window.

The usable window after a change is bounded by whichever is soonest: the next `target_motion_change`
event, `options.maxWindowMs` past the change, or the actual end of recorded scored-window samples
(never the possibly-`Infinity` nominal presentation window end — a run with no subsequent `visible`
event must still be bounded by its last real tick). A change is **excluded, not silently dropped**,
and counted with a reason:

- `'insufficient-window-data'` — the usable window is shorter than `options.minWindowMs` (not enough
  room to observe peak/settling before the next reversal or the run ends).
- `'overlap'` — the change is less than `options.minBaselineMs` after the previous change (not
  enough steady-state time to get a clean baseline reading before this reversal).

### Blocked-reason precedence (`deriveTrackingDynamics`)

Checked in this order — a data problem earlier in the list always wins over a later one:

1. `protocol-incompatible` — any `protocol_violation` event falls inside `[scored_start.t, window_end)`, checked regardless of acquisition outcome (T3 owns this metric-level guard; T4's run-level eligibility layer is separate and later).
2. `no-acquisition` — the P0 canonical result for this presentation is `acquisitionFailure = true`. P0's own `acquisitionFailureRate` is never suppressed by this — callers derive it from the same unmodified `deriveTrackingMetrics()` result.
3. `missing-target-telemetry` — any tick in the post-acquisition window has a null target position or missing `dYaw`/`dPitch` where required.
4. `insufficient-valid-ticks` — fewer than `options.minValidTicks` ticks in the post-acquisition window (also returned if the window is too short to cover even the smallest requested lag, i.e. shorter than the tick-quantized `lagSearchMs` upper bound).
5. `lag-peak-ambiguous` — see above.

### NFR tolerances (fixture-verified, not eyeballed)

- **NFR-54-2** (timing precision): a fixed synthetic lag is recovered within one tick period
  (`abs(estimated_lag_ms - truth_ms) <= 1000/simHz`). The truth fixture uses a ~25s scored window (matching D-54.4's real block duration) because the multi-frequency band-limited pursuit signal needs several full periods of its slowest component to average out finite-window correlation edge effects — a window much shorter than the slowest component's period recovers a lag off by several ticks, which is a property of finite-sample cross-correlation, not a derivation bug.
- **NFR-54-3** (numeric precision): a perfect-follower fixture (aim ≡ target every tick) recovers `rmsEpsilonDeg <= 1e-6` deg and `totPercent === 100` (P0), plus `lagMs ≈ 0` and `velocityGain ≈ 1` (P1). A known-gain fixture (aim velocity = target velocity × `{0.7, 1.0, 1.3}`, zero lag) recovers `velocityGain` within `0.02` of truth.

### Version/traceability fields (NFR-54-5)

Every P1 result is reproducible from `options.version` (`'tracking-dynamics-v1'`), `options.lagSearchMs`,
`options.smoothingVersion`, `options.minValidTicks`, `options.correlationAmbiguityRatio`, plus the
export's own `meta.simHz`, seed, and `trackingTrajectory` config (already carried by T2's export
metadata pass-through). No P1 field is ever derived from wall-clock time or `Math.random()`.

## Eligibility, Compatibility, and Evidence (WP-54 / T4)

Not a third metric-priority tier (P0/P1 above are) — this section covers the run-level quality gate,
cohort-compatibility key, and evidence/report pipeline that sit above P0/P1.

`src/pilot/trackingRunEligibility.ts`, `src/pilot/trackingCompatibilityKey.ts`,
`src/pilot/trackingPilotEvidence.ts`, `src/pilot/trackingPilotReport.ts`.

### Run-level eligibility vs. metric-level blocked — two separate vocabularies

`evaluateTrackingRunEligibility(payload)` (FR-54-10) runs **before** any P0/P1 derivation and is a
strictly higher, independent layer from the P1 `TrackingDynamicsResult.status === 'blocked'`
vocabulary documented above. A run can be `eligible` at this layer while its P1 dynamics are still
metric-blocked (e.g. `lag-peak-ambiguous`, `no-acquisition`) — the two closed enums are **never**
merged, compared to each other, or share a string, even where the underlying concept overlaps (e.g.
missing target telemetry is checked at both layers, under deliberately different names:
`missing-target-position` here vs. `missing-target-telemetry` in P1).

Closed `TrackingQualityReason` vocabulary (8 codes, one-shot — do not add a 9th without a version bump):

| Reason | FR-54-10 category | Trigger |
|---|---|---|
| `recorder-overflow` | overflow | `meta.recorderOverflow === true` |
| `input-buffer-overflow` | overflow | `meta.bufferOverflow === true` |
| `missing-scored-start` | protocol mismatch | zero `scored_start` events in the export (short-circuits — no scored window exists to check target-position/coverage against) |
| `missing-target-position` | missing target | any scored-window tick (`t >= min(scored_start.t)`) has `tx`/`ty`/`tz === null` |
| `non-monotonic-timestamps` | timestamp | `ticks[i].t <= ticks[i-1].t` for any `i`, checked in the export's **own recorded order** (not re-sorted — sorting first would hide exactly the bug this check exists to catch) |
| `insufficient-scored-coverage` | coverage | scored-window tick coverage `< 99.5%` (NFR-54-4); `expectedTickCount = round(durationMs / (1000/simHz)) + 1` |
| `unsupported-schema-version` | protocol mismatch | `meta.schemaVersion !== 2` (defense-in-depth; `parseExportPayload` should already have rejected this) |
| `unrecognized-tracking-trajectory` | protocol mismatch | `meta.spawn.trackingTrajectory` missing, or its `kind` is not `band-limited-2d-v1`/`reversal-2d-v1` |

All checks except `missing-scored-start` run independently and **all** applicable reasons are
collected — `evaluateTrackingRunEligibility` never short-circuits on the first failure (a run can
fail overflow *and* coverage at once, and both must be visible to the caller).

### Compatibility key (NFR-54-7)

`buildTrackingCompatibilityKey(meta)` is a WP-54-specific key — **not** a reuse of
`src/metrics/compatibilityKey.ts`'s `buildCompatibilityKey()`, which hard-requires
`meta.assessment` and throws otherwise. Every WP-54 pilot block is `mode: 'practice'` (T2 decision),
and `main.ts` only attaches `meta.assessment` when the active drill's `mode === 'assessment'` — so a
WP-54 export's `meta.assessment` is always `undefined`, and the existing key would always throw.

Eight axes, all fail-fast on a missing/malformed source field:

| Field | Source |
|---|---|
| `drillId` | `meta.drillId` |
| `protocolVersion` | constant `'tracking-pilot-v1'` (D-54.11) |
| `motionKind` | `meta.spawn.trackingTrajectory.kind` |
| `sizeDeg` | `band-limited-2d-v1`: `${yawBoundDeg}x${pitchBoundDeg}`; `reversal-2d-v1`: `${lo}..${hi}` of `angularBoundsDeg` |
| `speedDegPerSec` | `band-limited-2d-v1`: `targetRmsSpeedDegPerSec`; `reversal-2d-v1`: `${lo}..${hi}` of `speedRangeDegPerSec` |
| `fovDeg` | `meta.fovDeg` |
| `sensitivity` | `meta.sensitivity` |
| `inputMode` | `meta.mouseIntegration?.model ?? 'aim-diff-legacy'` — a judgment call (NFR-54-7 does not define this field further); see progress.md OQ-54-9 |

### 刺激語意：angular size 與 delivered speed（T6 slice 10 / KI-020、slice 15 / KI-023）

WP-54 的 core matrix 有兩個被操弄的因子，兩者在 2026-09-03 之前**都沒有被真正交付**，分析時務必
以下列語意為準：

| 因子 | 權威來源 | 說明 |
|---|---|---|
| **Target angular size** | `meta.targets.hitbox`（sphere，直徑 `2 · distance · tan(size/2)`） | 2.0° → 0.13964u、0.5° → 0.03491u @ 4u。**不是** `trackingTrajectory.yawBoundDeg`——那是行程振幅。sphere 使 on-target 容許角在各方向等向，即「角尺寸」的字面語義；slice 10 曾因 WP-55 的 box-only 閘門改用 cube（對角 √2 倍 anisotropy），KI-021 解除該限制後於 slice 12 改回 sphere（GD-30） |
| **Delivered RMS speed** | `trackingTrajectory.targetRmsSpeedDegPerSec` = **交付的 2D RMS 角速度**（螢幕上目標的速度），且保證等於實際交付值 | 求解逐軸進行，但每軸目標為 `set-point / √(活躍軸數)`（KI-023）——兩軸 cell 各軸取 `1/√2`，單軸 axis calibration 不變。`createBandLimited2dV1()` 在請求速度不可交付時 fail fast（訊息同時帶出 config 值與該軸的需求值）。實測交付/宣稱：core 四個 cell 1.000–1.014、calibration 1.013/1.017 |
| **Reversal 速度範圍** | `trackingTrajectory.speedRangeDegPerSec` = 每個 leg 的 **2D** 巡航速度範圍 | 同一構念（KI-023）。每軸自 `range / √2` 抽樣 ⇒ 兩軸皆抽 min/max 時 2D 恰為 `speedMin`/`speedMax`。被剩餘時間或自身可用空間截短的 leg 巡航較慢，故下界是「範圍被用到」而非逐 leg 保證 |
| Travel amplitude | `trackingTrajectory.yawBoundDeg`/`pitchBoundDeg` | 所有 core cell 共用 ±16°（非操弄變數）；reversal cell 用 `angularBoundsDeg ±13°` |
| Frequency band | `trackingTrajectory.frequencyBandHz` | core cell 為 `[0.3, 2.1]` Hz（自 `[0.1, 0.7]` 提高，才能在共用振幅下交付 20 deg/s） |

**歷史資料判讀（三個世代，都不可與現行資料合併做速度比較）**：

| 世代 | 辨識方式 | 交付速度的真實值 |
|---|---|---|
| **G1**（KI-020 之前） | `frequencyBandHz [0.1,0.7]` + `yawBoundDeg ≤ 2` + `meta.targets.hitbox` 為預設 H1 | ≈ `0.605 × 振幅`，**與 metadata 宣稱值無關**；所有 cell 目標角尺寸相同（約 ±7°）⇒ `totPercent` 恆為 100%、不帶資訊量 |
| **G2**（KI-020 已修、KI-023 未修；2026-09-03 的 P01/P02/P03 三批全屬此代） | `frequencyBandHz [0.3,2.1]` + `yawBoundDeg 16` + 每 cell 有自己的 `targets.hitbox` | 每軸 RMS = 宣稱值 ⇒ **螢幕上的 2D 速度 = 宣稱值 × √2**（兩軸 cell；實測 7.14 / 28.3 對 5 / 20）。**單軸 axis calibration 例外**，其交付即為宣稱值 ⇒ 同一批資料裡 calibration 與 core 的「5 deg/s」相差 1.41 倍。reversal 的 `speedRangeDegPerSec` 亦為每軸值 |
| **G3**（KI-023 已修，本節上表所述） | 同 G2，但 `targetRmsSpeedDegPerSec` 已是 2D 語意 | 交付即宣稱值（實測比值 1.000–1.017） |

G2 資料若要納入分析，速度軸須自行乘 `√2`（calibration 除外）；但條件標籤與 compatibility key 記的
仍是宣稱值，**跨世代合併需明確標註世代**。

**Compatibility key**（NFR-54-7）隨之改名/擴充：`sizeDeg` → `travelAmplitudeDeg`（語意本來就是振幅），
新增 `targetHitboxWidthU`（真正的尺寸軸；`Meta` 不記錄目標距離，故以 source unit 表達）與
`displayRefreshHz`（OQ-54-11：60Hz 資料可用，但刷新率必須分開 cohort，四捨五入到整數 Hz）。

### Evidence model and the HTML report's parity design

`buildTrackingPilotEvidence(payloads, options?)` groups payloads by `meta.drillId` (the condition
label, single-sourced from T2's per-candidate drillId convention) and, for each run, attaches
`quality` (always) plus `p0`/`p1`/`reversal` (only when `quality.status === 'eligible'` — a blocked
run is never fed into metric derivation at all, per FR-54-10's "blocked but not aggregated"). `p0`,
`p1`, and `reversal` reuse T3's own result types verbatim (`TrackingPresentationDerivation`,
`TrackingDynamicsResult`, `TrackingReversalWindowsResult`) — no second field definitions. A P1
metric-level block (e.g. `no-acquisition`) never removes an already-attached `p0` from the same run;
the two are computed independently.

**Practice blocks are excluded from aggregation by role** (FR-54-5, added T6 slice 3). A practice
export is otherwise indistinguishable from a scored one to this pipeline: it has no prep window, so
`TargetManager` stamps `tScoredStart` on its first motion tick and the export *does* carry one
`scored_start` event, and it passes `evaluateTrackingRunEligibility()` like any scored block.
Feeding a whole manifest's nine exports into `buildTrackingPilotEvidence()` is therefore filtered
through `isTrackingPilotPracticeDrillId()` (single-source role registry in
`src/session/trackingPilotManifest.ts`), and the artifact reports `excludedPracticeRunCount` so the
exclusion is stated rather than silent. Consumers must not use "has no `scored_start`" as a
practice test — see progress.md D-54.34/D-54.36.

The self-contained HTML report (`renderTrackingPilotReportHtml`) uses **parity-by-construction**: the
canonical `TrackingPilotEvidence` object is `JSON.stringify`'d verbatim (with `<` escaped to `<`
so no embedded string can prematurely close the `<script>` tag) into a
`<script type="application/json" id="evidence-data">` block, and the page's own vanilla-JS renderer
reads every number it displays back out of that same block — nothing is recomputed. A JSON/HTML
parity test therefore only needs to extract that script's text, `JSON.parse` it, and deep-equal it
against the evidence object's own JSON form — never scrape rendered DOM text or re-derive a number to
compare against. This was the approach the WP-54 T4 task brief suggested, and it was adopted as-is
after confirming it fully covers the "blocked shows a reason, never a 0" requirement for free (T3's
own result types already omit numeric fields on a blocked/failed branch).

One caveat discovered while writing the parity test: `TrackingPresentationDerivation.windowEndMs` is
legitimately `Infinity` for WP-54's normal case (a single persistent target, no subsequent `visible`
event to bound the presentation window). `JSON.stringify` has no representation for `Infinity` and
silently emits `null`. This is standard JS/JSON behavior, not a bug introduced by the evidence or
report code — but it means the artifact's true "canonical form" for parity purposes is
`JSON.parse(JSON.stringify(evidence))`, not the raw in-memory object. A `null` `windowEndMs` in a
saved evidence `.json` file should be read as "presentation extends to the end of the recording, no
next-visible boundary" — the same thing `Infinity` meant in memory.

### Evidence pipeline defaults (T4 pipeline defaults, not new protocol freezes)

`buildTrackingPilotEvidence`'s default `TrackingDynamicsOptions`/`TrackingReversalWindowOptions`
(fully overridable via `options.dynamics`/`options.reversal`):

- `smoothingVersion: 'tracking-dynamics-smoothing-v1-tri3'` (not T3's truth-fixture default of
  `-none` — real pilot data is noisy and benefits from smoothing before lag search; synthetic truth
  fixtures use `-none` specifically to keep recovery exact).
- `minValidTicks: 32` — not arbitrary: it is exactly `lagSearchMs`'s frozen 250ms upper bound
  (D-54.5) at 128Hz, the shortest window that can resolve the full search range.
- `lagSearchMs: [0, 250]`, `correlationAmbiguityRatio: 2` — D-54.5/D-54.16 values.
- Reversal window params (`minWindowMs: 300`, `maxWindowMs: 500`, `minBaselineMs: 200`,
  `settlingToleranceDeg: 0.5`) carry over T3's own test defaults; no other source has calibrated
  these yet. T6/T7 calibration may supersede any of the above without touching this module's code —
  only its default constants.

### Benchmark (T4 checklist)

A single synthetic ~30s export (1s prep + 29s scored window at 128Hz, ~3841 ticks) through the full
eligibility + P0 + P1 + evidence-build pipeline measured well under the 2-second budget: ~23ms
cold (JIT warmup included), ~8ms warm, plus <1ms for HTML rendering. No worker/thread spike is
warranted (README §2.6: "未量先加 concurrency 不可" — do not add concurrency before measuring, and
this measurement does not justify it).
