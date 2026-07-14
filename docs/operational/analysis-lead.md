# Projectile Lead Error Offline Derivation

> WP-25 T4 operational spec. This is the analysis-side interface for projectile lead
> evaluation. The engine records raw schema v2 ticks/events only; lead error is derived
> offline from export JSON (GD-7: raw-over-derived, zero new sim calculation).

## Scope

Lead error is a candidate projectile construct, not a pre-registered result-page metric.
Use it for pilot analysis and validation of projectile drills. Promotion into the formal
metric set requires a separate decision after pilot data shows construct validity.

## Inputs

Use schema v2 JSON exports with projectile metadata:

- `meta.schemaVersion === 2`
- `meta.weapon.bullet` present with `{ model:"projectile", speedU, gravityU, maxRangeU }`
- `ticks[].t`, `ticks[].px`, `ticks[].pz`
- `ticks[].tx`, `ticks[].ty`, `ticks[].tz` while a target is active
- `events[]` rows with `type:"fire"`, `t`, `shotSeq`, `viewYaw`, `viewPitch`, and optional `targetId`
- `events[]` rows with `type:"hit"`, `shotSeq`, `t`, and `timeOfFlightMs` when the projectile hit

Time fields are milliseconds in the `performance.now()` basis. Positions and velocities are
source units. Angles in export rows are radians unless this spec explicitly says degrees.

## Coordinate Convention

For each projectile `fire` row, reconstruct the fire-time aim vector from `viewYaw/viewPitch`:

```text
f_aim = (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch))
```

The fire-time eye point is:

```text
p_eye = (px, eyeY, pz)
```

`eyeY` defaults to `1.6` source units, matching the current scene/player eye height.
If a later schema exports eye height explicitly, the explicit field wins.

The fire-time target center is linearly interpolated from surrounding tick rows. Target
velocity is estimated from adjacent tick target centers:

```text
v_target = (p_target_after - p_target_before) / dt
```

This is an export-side reconstruction of observed target motion. It does not require the
engine target-motion config and does not run sim code.

## Time Of Flight

For hit projectiles:

```text
tof = events.hit.timeOfFlightMs / 1000
```

where `events.hit.shotSeq === events.fire.shotSeq`.

For missed projectiles, the verifier may estimate a planning flight time from current
target distance:

```text
tof_est = distance(p_eye, p_target_fire) / meta.weapon.bullet.speedU
```

Report whether a sample used `hit` or `estimated` time of flight. Hit-linked samples are
preferred for primary pilot analysis because they use the observed projectile timing.

## Ideal Lead Direction

The ideal lead point is the target center advanced by target velocity over the flight time:

```text
p_target_ideal = p_target_fire + v_target * tof
```

Gravity compensation aims above that future center by the analytic drop term:

```text
drop = 0.5 * gravityU * tof^2
p_aim_ideal = p_target_ideal + (0, drop, 0)
```

The ideal direction is:

```text
f_ideal = normalize(p_aim_ideal - p_eye)
```

This is a first-order offline lead model. It assumes target velocity is locally constant
over the projectile flight and ignores wind, penetration, zeroing, and scene geometry,
matching the WP-25 projectile scope.

## Lead Error

Lead error is the unsigned angular distance between actual fire-time aim and the ideal
lead direction:

```text
lead_error_deg = degrees(acos(clamp(dot(f_aim, f_ideal), -1, 1)))
```

Report one sample per projectile `fire` row with a `shotSeq`.

Recommended sample fields:

| Field | Unit | Meaning |
|---|---|---|
| `shotSeq` | sequence | Projectile shot identifier linking `fire` and `hit`. |
| `targetId` | string | Fire-row target id when present. |
| `tFireMs` | ms | Fire timestamp (`t_fire`). |
| `timeOfFlightMs` | ms | Hit-linked or estimated flight time. |
| `timeOfFlightSource` | `hit` / `estimated` | Provenance for time of flight. |
| `targetVelocityUPerSec` | source u/s | Local target velocity estimated from tick rows. |
| `actualYaw`, `actualPitch` | rad | Fire-time aim angles. |
| `idealYaw`, `idealPitch` | rad | Ideal lead aim angles. |
| `leadErrorDeg` | deg | Unsigned angular lead error. |

## Boundary Cases

- Missing `meta.weapon.bullet`: invalid for this derivation.
- Missing `fire.shotSeq`: skip or reject the sample; it cannot be linked to projectile timing.
- Missing `fire.viewYaw/viewPitch`: invalid; the actual fire-time aim is not reconstructable.
- Missing target center at fire time: invalid for that sample.
- Fewer than two target-position ticks: velocity is treated as zero, and the sample should be
  flagged as thin in downstream analysis.
- No linked hit event: use estimated time of flight only for exploratory miss analysis; keep
  `timeOfFlightSource = "estimated"` explicit.

## Result Page Semantics

Lead error is not displayed by `MetricsDashboard` in WP-25. The existing eight result metrics
keep their shot-layer semantics:

- `firstShot` and timing metrics anchor to `t_fire`.
- projectile `t_hit` / `timeOfFlightMs` are additive observations.
- projectile first-shot outcome is recovered by matching `hit.shotSeq` to the first-shot
  `fire.shotSeq`.

## Reference Implementation

The TypeScript dev verifier in `src/metrics/leadDerivation.ts` implements this spec against
the production `ExportPayload` JSON shape. Its tests synthesize projectile exports, round-trip
them through `DataRecorder` and `buildExportPayload()`, then assert:

- a known horizontal lead fixture has near-zero error when aim points at the predicted intercept
- aiming at the current target center produces the expected angular no-lead error
- gravity compensation shifts the ideal pitch upward by the expected amount
- missed projectiles can use an explicitly marked estimated time of flight
