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

Time fields are milliseconds in the same `performance.now()` basis. Angles are radians in export
rows unless this spec explicitly says degrees. Target/player positions are source units.

The H1 hitbox dimensions are **not** exported per tick — they are a structural constant of the
target (`width 1, height 2, depth 1` source units, matching the engine `HITBOX`). The derivation
takes them as a fixed parameter so the on-target geometry is identical to the engine hit detector;
this is not a tuning knob.

## Coordinate Convention

For each tick, reconstruct the player aim forward vector from exported yaw/pitch:

```text
f_aim = (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch))
```

For the target vector, use the tick target center when present (the target moves, so use the
per-tick center, not the spawn center):

```text
p_eye = (px, eyeY, pz)
p_target = (tx, ty, tz)
```

`eyeY` defaults to `1.6` source units, matching the current scene/player eye height. If a later
schema exports eye height explicitly, the explicit field wins. When a tick has no target center
(gap before the first active tick), fall back to the `visible.targetX/targetY/targetZ` center.

## on-target (per-tick binary)

`on-target(t)` is true when the aim ray intersects the H1 hitbox axis-aligned box centered at the
target:

```text
box = [tx - w/2, tx + w/2] x [ty - h/2, ty + h/2] x [tz - d/2, tz + d/2]
on-target(t) = ray(p_eye, f_aim) intersects box at some parameter s >= 0
```

This is the **same geometry as the engine hit detection** (`THREE.Ray.intersectBox`), evaluated
with a ray/box slab test. There is **no new threshold parameter** (CONTEXT §A / GD-7): on-target
is exactly "would a shot along the aim ray hit the target this tick".

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
