# t_detect / Eccentricity Offline Derivation

> WP-21 T3 operational spec. This is the analysis-side interface for detection pop-in drills.
> The engine records raw v2 ticks/events only; `t_detect` and eccentricity are derived offline.

## Inputs

Use schema v2 JSON exports:

- `meta.schemaVersion === 2`
- `meta.simHz`, normally `128`
- `ticks[].t`, `ticks[].aim.yaw`, `ticks[].aim.pitch`
- `ticks[].px`, `ticks[].pz`
- `ticks[].tx`, `ticks[].ty`, `ticks[].tz` while a target is active
- `events[]` rows with `type:"visible"`, `t`, `targetId`, and WP-21 additive `targetX/targetY/targetZ`
- optional `events[]` rows with `type:"fire"` for engagement time

Time fields are milliseconds in the same `performance.now()` basis. Angles are radians in export rows unless
this spec explicitly says degrees. Target/player positions are source units.

## Coordinate Convention

For each tick, reconstruct the player aim forward vector from exported yaw/pitch:

```text
f_aim = (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch))
```

For target vector, use the tick target center when present:

```text
p_eye = (px, eyeY, pz)
p_target = (tx, ty, tz)
```

`eyeY` defaults to `1.6` source units, matching the current scene/player eye height. If a later schema exports
eye height explicitly, the explicit field wins.

When computing the pre-stimulus baseline before `t_visible`, the target is not visible yet, so use the matching
`visible.targetX/targetY/targetZ` as the future target center.

## Eccentricity

Eccentricity is the unsigned angular distance between the aim ray and the target center:

```text
epsilon(t) = acos(clamp(dot(normalize(f_aim), normalize(p_target - p_eye)), -1, 1))
```

Report `epsilon` in degrees. The spawn covariate is:

```text
eccentricity_at_spawn = epsilon(t_visible)
```

Use the tick at `t == t_visible`; if the exact tick is absent, use the first tick after `t_visible` and flag the
export for audit. The TypeScript verifier exposes this as `spawnTickOffsetMs`.

## t_detect

Default parameters, provisional until pilot calibration:

```text
pre_stimulus_window = 500 ms
theta_v = 3 * SD(|d epsilon / dt| over pre-stimulus window)
k = 4 consecutive ticks
human_rt_lower_bound = 100 ms
```

`d epsilon / dt` is measured in deg/s between adjacent tick samples and assigned to the later tick. The detection
onset is the first tick after `t_visible` where:

```text
d epsilon / dt < -theta_v
```

holds for `k` consecutive derivative samples. `t_detect` is the first tick in that sustained run, not the fourth
confirming tick. This keeps the timestamp aligned to the movement onset while still requiring persistence.

## Boundary Cases

- No sustained decrease before the presentation ends: set `status = "timeout"`; this is a valid observed outcome,
  not missing data.
- Pre-stimulus window shorter than 500 ms, usually the first presentation: compute from available samples but set
  `baseline_insufficient = true`.
- `t_detect - t_visible < 100 ms`: keep the detected timestamp but set `anticipation = true`.
- Missing `visible.targetX/targetY/targetZ` and missing tick target center at spawn: invalid for this derivation.
- Multiple presentations: end a presentation window at the next `visible.t`; do not let one target's samples leak
  into the next target.

## Engagement Time

The free GD-8 secondary metric is:

```text
engagement_time = t_first_fire - t_visible
```

where `t_first_fire` is the first `fire` event in the same presentation window. This metric is independent of
`t_detect`: a participant may detect without firing, or fire before a valid sustained aim-onset is observed.

## Sensitivity Analysis

The default `theta_v = 3 * SD` and `k = 4` are the OQ-S3-2 starting point, not a final empirical calibration.
Pilot analysis should sweep:

- threshold multiplier: `2`, `2.5`, `3`, `3.5`, `4`
- sustained ticks: `3`, `4`, `5`, `6`
- anticipation lower bound: keep `100 ms` fixed unless protocol evidence says otherwise

Report how median `t_detect`, timeout rate, and anticipation rate change across the sweep.

## Reference Implementation

The TypeScript dev verifier in `src/metrics/detectionDerivation.ts` implements this spec against the production
`ExportPayload` JSON shape. Its tests synthesize aim trajectories, round-trip them through `DataRecorder` and
`buildExportPayload()`, then assert known onset recovery within one 128 Hz tick.
