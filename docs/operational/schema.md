# WP-16 Export Schema v2

> Source of truth: TypeScript export types in [`src/data`](../../src/data/DataRecorder.ts), especially `Meta`, `TickRecord`, `DrillEvent`, and `ExportPayload`.
> This document describes schema v2 download format produced by `downloadJSON()` / `downloadCSV()`.

## Format Overview

The JSON export is one object:

```ts
{
  meta: Meta;
  ticks: TickRecord[];
  events: DrillEvent[];
}
```

CSV export writes two required files with the same basename. When `meta.frames` is present,
it also writes one summary-only frames file; per-frame deltas are JSON-only.

| File | Rows | Source |
|---|---:|---|
| `<basename>-ticks.csv` | one row per sim tick | `ticks[]` |
| `<basename>-events.csv` | one sparse row per drill event | `events[]` |
| `<basename>-frames.csv` | one summary row | `meta.frames.summary` (optional) |

All numeric data fields must be finite. `collectMeta()` validates metadata numeric fields; JSON/CSV serialization rejects non-finite tick/event values such as `NaN`, `Infinity`, and `-Infinity`.

## Units And Timing

| Concept | Unit / Basis |
|---|---|
| Time fields (`t`) | milliseconds, `performance.now()` timebase |
| `startedAt` | ISO-8601 wall-clock timestamp for session metadata |
| `simHz`, `displayHz` | hertz |
| Velocity (`vx`, `vz`, `vStrafe`, `residualSpeed`) | source units per second |
| Aim (`yaw`, `pitch`, `viewYaw`, `viewPitch`) | radians, camera orientation written by `CameraController` |
| Recoil punch (`aimPunchPitch`, `aimPunchYaw`) | degrees, Source/CS2 aimPunch, sampled pre-kick for the shot |
| Spread (`spreadX`, `spreadY`) | unitless tangent-plane offsets, sampled pre-kick for the shot |
| Position (`px`, `pz`, `tx`, `ty`, `tz`) | source units |
| Keyboard state | canonical key names: `A`, `D`, `W`, `S` |

Tick rows are recorded inside the sim tick. Event rows use their source timestamp: visible events use sim tick time; counter/fire/key events use the input event `timeStamp`, which shares the `performance.now()` basis.

## JSON Schema

### Root

| Field | Type | Required | Source | Notes |
|---|---|---:|---|---|
| `meta` | object | Yes | `collectMeta()` then `buildExportPayload()` | Environment and validity metadata. |
| `ticks` | `TickRecord[]` | Yes | `DataRecorder.snapshot().ticks` | Ordered by recording time; arena does not wrap. |
| `events` | `DrillEvent[]` | Yes | `DataRecorder.snapshot().events` | Ordered by record time. |

### `meta`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `drillId` | string | drill config id | Yes | active drill config | Non-empty. Example: `counterstrafe_ad_v1`. |
| `schemaVersion` | number | `2` | Yes | `collectMeta()` fixed value | v2 break from phase-A exports. Older exports without this field are v1/phase-A. |
| `weaponId` | string | weapon config id | Yes | active drill config or default | Defaults to `ak47` when `DrillConfig.weaponId` is omitted. |
| `weaponSeed` | number | seed | Yes | active weapon config | Recoil table seed for weapon reproducibility. |
| `rngSeed` | number | seed | Yes | drill sequence seed or default | Spread RNG seed; defaults to `1` when `sequence.seed` is omitted. |
| `backend` | string | `webgpu` or `webgl2` | Yes | renderer seam | Render backend selected by `createRenderer()`. |
| `displayHz` | number | Hz | Yes | `measureDisplayHz()` | Runtime display refresh estimate. |
| `simHz` | number | Hz | Yes | sim loop config | Defaults to `128`. |
| `browser` | string | user agent | Yes | `navigator.userAgent` or caller | `unknown` only when unavailable. |
| `sensitivity` | number | app setting | Yes | settings panel | Positive finite number. |
| `sensitivityModel` | string | `cs2-0.022deg` | Yes | `collectMeta()` fixed value | Current count conversion model: `degrees = movementX * sensitivity * 0.022`. Missing in older exports means phase-A placeholder semantics (`0.0022 rad/count`). |
| `movementModel` | string | `cs2-source` | Yes | `collectMeta()` fixed value | Stage2 movement profile semantic break. Future Valorant-style profiles use a new value, not reinterpretation. |
| `fovDeg` | number | degrees | No | `SettingsPanel.fov` | Additive (KI-005 / A). Hip-baseline vertical FOV — the denominator of ADS gain (`sensitivityRatio × (weapon.ads.fovDeg / fovDeg)`). **Never** read from `sceneManager.camera.fov`: during ADS the camera FOV is a render-only alpha-interpolated value, and reading it would make the export depend on render frame rate (same trap as `scene.eye`, KI-004 T2). Absence means a pre-KI-005 export → the ADS-period sensitivity chain for that export is not reconstructable. |
| `crossOriginIsolated` | boolean | `true` / `false` | Yes | runtime global | `false` is valid metadata, not a missing value. |
| `startedAt` | string | ISO-8601 | Yes | export/session start | Normalized by `collectMeta()`. |
| `unit` | string | `source` | Yes | fixed phase-A value | Velocity unit namespace. |
| `vStrafe` | number | source u/s | Yes | movement config/default | Defaults to `250`. |
| `maxDrillSeconds` | number | seconds | Yes | recorder/drill cap | Defaults to `300`; tied to arena capacity. |
| `lateEventCount` | number | count | Yes | input buffer telemetry | Non-negative integer. |
| `bufferOverflow` | boolean | `true` / `false` | Yes | input buffer telemetry | Marks dropped/late input-buffer data. |
| `recorderOverflow` | boolean | `true` / `false` | Yes | recorder snapshot | If true, arena refused later tick writes and preserved oldest rows. |
| `suspect` | boolean | `true` / `false` | Yes | derived validity flag | `true` if overflow or a runtime validity observer marks the run suspect. |
| `simToWorld` | number | world unit per source unit | No | `SIM_TO_WORLD` (`src/loop/constants.ts`) | Additive; absence means pre-S1 export → offline consumers fall back and mark the source as `legacy-default`. TODO(S3): reconcile the existing unit prose for `ticks[].px/pz`/`tx/ty/tz` against this. |
| `weapon` | object | active weapon snapshot | No | active `WeaponConfig` | Additive v2 block. Production exports include `{ id, ads?, bullet?, projectileOverflow? }`; `ads` stores ADS optics and `bullet` stores projectile ballistics when enabled. |
| `targets` | object | optional target geometry snapshot | No | active `DrillConfig` after defaults resolve | Additive v2 block. `targets.hitbox` stores the H1 hitbox used by sim/render/offline derivation. |
| `spawn` | object | reserved optional | No | stage3/WP-21 | v2 reserved block for `seed`, motion, and spawn-area snapshots. WP-16 writes seed/motion when available. |
| `scene` | object | scene condition | No | stage3/WP-19 | `{ sceneId, assetPackVersion, clutterTier, fallback, eye? }`. Additive; absence means scene system not active. |
| `display` | object | reserved optional | No | stage3/WP-20 | v2 reserved display/session setup metadata block. |
| `frames` | object | frame deltas and summary | No | stage3/WP-20 | `{ series, summary }`; complete delta series is JSON-only. |
| `session` | object | reserved optional | No | stage3/WP-20 | `participantId` / `sessionLabel` cross-session join keys. |
| `validity` | object | runtime validity observation breakdown | No | `sharedState.validity` / frame log / recorder snapshot | Additive; absence means pre-S1 export. **Not the same set as `suspect`** — see [`meta.validity`](#metavalidity) below. |

`buildExportPayload()` also ORs `meta.recorderOverflow` with `snapshot.recorderOverflow`, then preserves any existing `meta.suspect` flag.

#### `meta.weapon`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `id` | string | weapon config id | Yes when `weapon` exists | active `WeaponConfig.id` | Mirrors `meta.weaponId` for a self-contained weapon snapshot. |
| `ads` | object | ADS optics | No | active `WeaponConfig.ads` | Omitted when the weapon has no ADS optics. |
| `bullet` | object | projectile ballistics | No | active `WeaponConfig.bullet` | Omitted for hitscan weapons. Presence means projectile model was enabled for this export. |
| `projectileOverflow` | boolean | `true` / `false` | No | `state.bullets.overflowCount > 0` | Present when projectile mode is enabled; true means the fixed bullet arena refused at least one shot. |

`weapon.ads` fields:

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `fovDeg` | number | degrees | Yes when `ads` exists | active `WeaponConfig.ads.fovDeg` | ADS target vertical FOV. |
| `sensitivityRatio` | number | positive ratio | Yes when `ads` exists | active `WeaponConfig.ads.sensitivityRatio` | GD-16 ratio. Effective ADS sensitivity is `sensitivity × sensitivityRatio × (fovDeg / hipFov)`. |

`weapon.bullet` fields:

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `model` | string | `projectile` | Yes when `bullet` exists | active `WeaponConfig.bullet.model` | Config gate; absent `bullet` preserves hitscan semantics. |
| `speedU` | number | source u/s | Yes when `bullet` exists | active `WeaponConfig.bullet.speedU` | GD-17 tick-count-derived projectile speed. |
| `gravityU` | number | source u/s^2 | Yes when `bullet` exists | active `WeaponConfig.bullet.gravityU` | Downward acceleration applied at fixed 128 Hz. |
| `maxRangeU` | number | source u | Yes when `bullet` exists | active `WeaponConfig.bullet.maxRangeU` | Projectile expires and writes tracer endpoint when this range is reached. |

#### `meta.targets`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `hitbox` | object | source units | No | resolved `DrillConfig.targets.hitbox` | `{ widthU, heightU, depthU }`. Omitted in older exports; analysis falls back to the default H1 `{1,2,1}`. |

#### `meta.scene`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `sceneId` | string | scene config id | Yes | active `SceneConfig` | Example: `placeholder-room`, `field-low`. |
| `assetPackVersion` | string | asset/config version | Yes | active `SceneConfig` | Lets analyses group exports by scene asset revision. |
| `clutterTier` | string | `low`, `mid`, `high` | Yes | active `SceneConfig` | Scene clutter condition. |
| `fallback` | boolean | `true` / `false` | Yes | scene loader | `true` when the requested scene asset failed and render fell back to placeholder-room. |
| `eye` | object | world base `{ x, y, z }` | No | `resolveEyeWorldBase(sceneConfig)` (`src/scene/eyePose.ts`) | Additive; absence means pre-S1 export → offline consumers fall back and mark the source as `legacy-default`. Computed deterministically in the data layer — **never** read from `sceneManager.camera.position` (camera is `alpha`-interpolated for render, which would make the export depend on render frame rate and break determinism / violate ADR-2). Components allow `0` and negative values (e.g. `br-field`'s `eyeZ: 0`). TODO(S3): reconcile with the canonical unit prose. |

#### `meta.display`

`meta.display` combines automatic display/runtime facts with WP-20 session setup self-report fields.
Self-reported fields are moderator-only audit metadata; they do not control eligibility. The eligibility
gate continues to use automatic `screenW/screenH = screen × devicePixelRatio`.

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `mode` | string | `native`, `fhd-1080`, `qhd-1440` | Yes when `display` exists | active resolution mode | Fixed modes are render-buffer sizes with CSS fullscreen upscale. |
| `bufferW`, `bufferH` | number | pixels | Yes | renderer canvas | Actual render buffer dimensions. |
| `cssW`, `cssH` | number | CSS pixels | Yes | viewport | CSS presentation size. |
| `dpr` | number | device pixel ratio | Yes | `window.devicePixelRatio` | Used to recover physical screen pixels. |
| `screenW`, `screenH` | number | physical pixels | Yes | `screen × dpr` | Automatic native resolution estimate; gate input. |
| `fullscreen` | boolean | `true` / `false` | Yes | `document.fullscreenElement` | Snapshot at export time. |
| `refreshEstimateHz` | number | Hz | Yes | frame log / rAF probe | Rounded refresh estimate. |
| `refreshMedianDeltaMs` | number | ms | No | frame log / rAF probe | Median rAF delta used for the estimate. |
| `gate` | object | eligibility report | No | WP-20 gate | Full pass/fail details for post-hoc audit. |
| `monitorModel` | string | self-reported text | No | session setup | Optional, trimmed, moderator-only. |
| `nativeW`, `nativeH` | number | self-reported pixels | No | session setup | Optional; shown next to automatic `screenW/screenH` for participant verification. |
| `panelInches` | number | inches | No | session setup | Optional self-report. |
| `viewingDistanceCm` | number | cm | No | session setup | Optional self-report. |
| `selfReportUncertain` | boolean | `true` | No | session setup | Present when participant checked "not sure". |
| `nativeMismatch` | boolean | `true` / `false` | No | derived from setup | Present when both `nativeW/nativeH` are provided; true if they differ from automatic `screenW/screenH`. |

#### `meta.session`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `participantId` | string | researcher-issued id | Yes when `session` exists | session setup | Required for experiment session exports; trimmed. |
| `sessionLabel` | string | e.g. `pre`, `post`, `day-1` | No | session setup | Optional cross-session label for offline joins. |

#### `meta.frames`

Frame timing is recorded from `requestAnimationFrame` timestamps into a preallocated arena.
The exported series stores frame-to-frame deltas in milliseconds, not raw timestamps.

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `series` | number[] | ms | Yes | `FrameLog.series()` | Complete ordered delta series for JSON analysis. Values are finite and non-negative. |
| `summary` | object | frame stats | Yes | `FrameLog.summary()` | Summary used by CSV and validity metadata. |

`summary` fields:

| Field | Type | Unit / Values | Required | Notes |
|---|---|---|---:|---|
| `count` | number | samples | Yes | Must equal `series.length`. |
| `p50` | number | ms | Yes | Median frame delta. |
| `p95` | number | ms | Yes | Nearest-rank p95 frame delta. |
| `p99` | number | ms | Yes | Nearest-rank p99 frame delta. |
| `overBudgetWindows` | number | count | Yes | Number of deltas above `PERF_FLOOR_MS`. |
| `overflow` | boolean | `true` / `false` | Yes | True when the fixed-capacity arena stopped accepting later deltas. |

If `summary.p95 > PERF_FLOOR_MS`, `collectMeta()` marks `meta.suspect = true`.

#### `meta.validity`

Additive v2 block (KI-004 / S1 T2). Records four runtime observation booleans without changing `suspect`
semantics. Absence means a pre-S1 export.

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `corridorExceeded` | boolean | `true` / `false` | Yes when `validity` exists | `sharedState.validity.playerCorridorExceeded` (world-domain comparison, `src/scene/corridor.ts`'s `isOutsideCorridor`, KI-004 / S1 T3) | Purely observational (K-3, GD-6); does **not** by itself invalidate a run — corridor exit only means visual occlusion, and scene geometry never reaches sim (GD-6), so it cannot affect hit detection. |
| `perfFloor` | boolean | `true` / `false` | Yes when `validity` exists | `frames.summary.p95 > PERF_FLOOR_MS` | Same condition that contributes to `suspect`. |
| `recorderOverflow` | boolean | `true` / `false` | Yes when `validity` exists | recorder snapshot | `buildExportPayload()` ORs this with `snapshot.recorderOverflow`, same as the top-level `meta.recorderOverflow`. |
| `bufferOverflow` | boolean | `true` / `false` | Yes when `validity` exists | `sharedState.inputMeta.bufferOverflow > 0` | **Not** part of `main.ts`'s explicit `suspect` OR set — recorded here as an observation only (it does still fold into `meta.suspect` via `collectMeta()`'s own internal OR, a pre-existing, S1-unrelated coupling; see KI-004-S1 progress.md S-S1.6). |

**`meta.validity` is not the same set as `meta.suspect`.** As of **KI-004 / S1 T3**, `main.ts`'s explicit
`suspect` OR set no longer includes corridor exit (K-3): it is
`explicitSuspect (session/protocol/perfFloor) || bufferOverflow || recorderOverflow || perfFloor`, computed
independently in `collectMeta()`/`buildExportPayload()`. Adding `validity` never widens or narrows `suspect`.
Exports produced **before T3** landed carry `validity.corridorExceeded` computed from the pre-fix, 100×-too-tight
source-unit comparison (`|player.x| > halfWidthU` instead of `|player.x| × SIM_TO_WORLD > halfWidthU`) and are
**not** comparable to post-T3 exports for this field.

#### `meta.mouseIntegration`

Additive v2 block (KI-005 / A T2, FR-A-6). Self-describes the model that produced `ticks[].dYaw`/`dPitch`
(see [`ticks[]`](#ticks) below) — offline consumers must check for this block's presence rather than assume
which ω(t) derivation an export carries. **Absence means `ticks[].dYaw`/`dPitch` are also absent**, and
`omega_deg_s` must fall back to the legacy aim-difference derivation (`source: 'aim-diff-legacy'`), which
carries the render/sim beat-aliasing bug this KI fixes.

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `model` | string | `tick-window-integral` | Yes when `mouseIntegration` exists | `collectMeta()` fixed value | Closed value domain — the only model this codebase currently produces. A future model would use a new value, not reinterpretation. |
| `radPerCount` | number | rad/count | Yes when `mouseIntegration` exists | `RAD_PER_COUNT` (`src/input/mouseGain.ts`, GD-5: 0.022°/count) | Lets raw mouse counts be reconstructed from `dYaw`/`dPitch` and lets the Python side reconcile its independent constant against this export (C-D1: `research/` cannot import TS, so this field is the audit trail instead of a shared source, TD-4). |
| `hipStep` | number | rad/count | Yes when `mouseIntegration` exists | `resolveMouseGain()` (`src/input/mouseGain.ts`) | `sensitivity × RAD_PER_COUNT`, the per-count angle applied while not aiming down sights. |
| `adsStep` | number | rad/count | Yes when `mouseIntegration` exists | `resolveMouseGain()` (`src/input/mouseGain.ts`) | Per-count angle while ADS is held; equals `hipStep` when the active weapon has no ADS optics. |

### `ticks[]`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `t` | number | ms | Yes | sim tick end time | `performance.now()` basis. |
| `vx` | number | source u/s | Yes | `state.player.vx` | Lateral velocity. |
| `vz` | number | source u/s | Yes | `state.player.vz` | Forward/back velocity. |
| `px` | number | source u | Yes | `state.player.x` | Player lateral position. |
| `pz` | number | source u | Yes | `state.player.z` | Player forward/back position. |
| `tx` | number or `null` | source u | Yes | active target center | Active visible/alive target center x; `null` when no active target exists. |
| `ty` | number or `null` | source u | Yes | active target center | Active visible/alive target center y; `null` when no active target exists. |
| `tz` | number or `null` | source u | Yes | active target center | Active visible/alive target center z; `null` when no active target exists. |
| `aim` | `{ yaw: number; pitch: number }` | radians | Yes | `state.aim` | Camera orientation snapshot; canonical tick-level aim trajectory. |
| `keys` | string[] | `A`, `D`, `W`, `S` | Yes | key mask snapshot | Empty array means no tracked movement key held. |
| `ads` | boolean | `true` / `false` | Yes | `state.heldAds` after input consumption | Tick-level ADS state. Use with `events.ads` to reconstruct ADS windows. |

### `events[]`

`events[]` is a discriminated union keyed by `type`.

#### `visible`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `visible` | Yes | target manager hook | Target became visible. |
| `targetId` | string | target id | Yes | target manager | Identifies the visible target. |
| `side` | string | `L`, `R` | Yes | target state | Peek side for left/right symmetry metrics. |
| `t` | number | ms | Yes | sim tick time | `t_visible`; reaction-time start. |
| `targetX` | number | source u | Yes in WP-21 exports | target state | Target center x at `t_visible`; additive for offline detection derivation. |
| `targetY` | number | source u | Yes in WP-21 exports | target state | Target center y at `t_visible`; additive for offline detection derivation. |
| `targetZ` | number | source u | Yes in WP-21 exports | target state | Target center z at `t_visible`; additive for offline detection derivation. |

#### `counter`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `counter` | Yes | input consume hook | Counter-strafe key transition. |
| `key` | string | key code/name | Yes | input event | Current implementation records the counter key, for example `A` or `D`. |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis. |

#### `ads`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `ads` | Yes | input consume hook | ADS right-button transition. |
| `down` | boolean | `true` / `false` | Yes | input event | `true` means ADS pressed; `false` means released. |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis. |

#### `key`

Additive WP-29 / T3 event (opt-in engine emission via `DataRecorder.recordKeyEvents`; default off). Records a
raw A/D key down/up transition at the input `timeStamp` (sub-tick), enabling offline derivation of the "release
the original-direction key" moment at input-timestamp precision instead of the ±1-tick `ticks[].keys`
quantization. It does not bump `schemaVersion` (stays `2`); absence in older or opt-out exports means the
feature was not enabled, not an error. It never changes any existing field, tick semantics, or hit/metric
value; the frozen `compute-v1` / `timeline-v1` / `sync-v1` constructs do not consume it.

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `key` | Yes | input consume hook | Raw A/D key transition. |
| `code` | string | canonical key name (`A`, `D`, `W`, `S`) | Yes | input event, mapped from `KeyboardEvent.code` | Same canonical vocabulary as `ticks[].keys`; no second key-name convention. Stage A emits only `A`/`D`. |
| `down` | boolean | `true` / `false` | Yes | input event | `true` means key pressed; `false` means released (the release edge anchors offline `t_release_event`). |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis, same clock as `counter`/`fire`. |

#### `fire`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `fire` | Yes | fire input hook | Shot attempt. |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis. |
| `hit` | boolean | `true` / `false` | Yes | hit detector | Whether the shot hit a target. |
| `firstShot` | boolean | `true` / `false` | Yes | first-shot gate | First shot for the current peek sequence. |
| `residualSpeed` | number | source u/s | Yes | movement state at fire | Used by WP-8 metrics. |
| `shotSeq` | number | shot sequence | No | projectile spawn | Present for projectile fire rows; links the fire row to later `hit` events. |
| `viewYaw` | number | radians | Yes in production v2 | `state.aim.yaw` | Camera/view yaw at fire time, pre-kick for this shot. |
| `viewPitch` | number | radians | Yes in production v2 | `state.aim.pitch` | Camera/view pitch at fire time, pre-kick for this shot. |
| `aimPunchPitch` | number | degrees | Yes in production v2 | `state.recoilState` | AimPunch pitch used by this shot before `recoilOnFire`. Ideal compensation uses `-aimPunch×2`. |
| `aimPunchYaw` | number | degrees | Yes in production v2 | `state.recoilState` | AimPunch yaw used by this shot before `recoilOnFire`. |
| `spreadX` | number | tangent offset | Yes in production v2 | `state.recoil.lastSpread.x` | Spread sample consumed by this shot's ballistic ray. |
| `spreadY` | number | tangent offset | Yes in production v2 | `state.recoil.lastSpread.y` | Spread sample consumed by this shot's ballistic ray. |
| `recoilIndex` | number | shot index | Yes in production v2 | `state.recoilState.recoilIndex` | Index used to select this shot's recoil table entry; sampled before increment. |
| `ammo` | number | rounds | Yes in production v2 | `state.weapon.ammo` | Ammo remaining before this shot decrements the magazine. |
| `targetId` | string | target id | No | active target / hit detector | Active target at fire time; present when a target exists. |
| `offsetDeg` | number | degrees | No | camera forward vs target center | Non-negative unsigned angular distance from camera forward ray to active target center; `0` means centered. |
| `part` | string | `head`, `body` | No | hit detector | Present only when a hit part is available. |

For projectile mode, `fire.hit` remains the immediate fire-row field and is `false` until a later projectile hit is recorded. Projectile outcomes are represented by additive `hit` events linked by `shotSeq`; existing hitscan `fire` row semantics are unchanged.

#### `hit`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `hit` | Yes | projectile swept hit | Projectile impact event. |
| `t` | number | ms | Yes | tick-interpolated swept hit time | Hit time (`t_hit`) in the `performance.now()` basis. |
| `timeOfFlightMs` | number | ms | Yes | `t_hit - fire.t` | Projectile time of flight for the linked shot. |
| `shotSeq` | number | shot sequence | Yes | projectile spawn | Links to the projectile fire row. |
| `targetId` | string | target id | No | hit target | Target hit by the projectile. |
| `part` | string | `head`, `body` | No | target hitbox | Present when a hit part is available. |

## CSV Schema

### `<basename>-ticks.csv`

Header:

```csv
t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys,ads
```

| Column | JSON source | Notes |
|---|---|---|
| `t` | `tick.t` | ms. |
| `vx` | `tick.vx` | source u/s. |
| `vz` | `tick.vz` | source u/s. |
| `px` | `tick.px` | source u. |
| `pz` | `tick.pz` | source u. |
| `tx` | `tick.tx` | source u; empty when JSON value is `null`. |
| `ty` | `tick.ty` | source u; empty when JSON value is `null`. |
| `tz` | `tick.tz` | source u; empty when JSON value is `null`. |
| `yaw` | `tick.aim.yaw` | Camera yaw in radians. |
| `pitch` | `tick.aim.pitch` | Camera pitch in radians. |
| `keys` | `tick.keys.join('|')` | Empty when no tracked key is held. |
| `ads` | `tick.ads` | `true` / `false`. |

### `<basename>-events.csv`

Header:

```csv
type,t,targetId,side,key,down,hit,firstShot,residualSpeed,shotSeq,timeOfFlightMs,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part,targetX,targetY,targetZ
```

Rows are sparse because event variants have different fields.

The additive `key` event reuses the existing `key` and `down` columns (no new column is added): `key` carries
the canonical `code` (`A`/`D`), `down` carries the boolean. Consumers disambiguate `key`-column meaning by the
row's `type`.

| Column | `visible` | `counter` | `ads` | `key` | `fire` | `hit` |
|---|---|---|---|---|---|---|
| `type` | `visible` | `counter` | `ads` | `key` | `fire` | `hit` |
| `t` | event time | event time | event time | event time | event time | `t_hit` |
| `targetId` | target id | empty | empty | empty | active/hit target id, or empty | hit target id, or empty |
| `side` | `L` / `R` | empty | empty | empty | empty | empty |
| `key` | empty | counter key | empty | key `code` (`A`/`D`) | empty | empty |
| `down` | empty | empty | `true` / `false` | `true` / `false` | empty | empty |
| `hit` | empty | empty | empty | empty | `true` / `false` | empty |
| `firstShot` | empty | empty | empty | empty | `true` / `false` | empty |
| `residualSpeed` | empty | empty | empty | empty | source u/s | empty |
| `shotSeq` | empty | empty | empty | empty | projectile shot seq, or empty | projectile shot seq |
| `timeOfFlightMs` | empty | empty | empty | empty | empty | projectile time of flight |
| `viewYaw` | empty | empty | empty | empty | radians | empty |
| `viewPitch` | empty | empty | empty | empty | radians | empty |
| `aimPunchPitch` | empty | empty | empty | empty | degrees | empty |
| `aimPunchYaw` | empty | empty | empty | empty | degrees | empty |
| `spreadX` | empty | empty | empty | empty | tangent offset | empty |
| `spreadY` | empty | empty | empty | empty | tangent offset | empty |
| `recoilIndex` | empty | empty | empty | empty | shot index used by this shot | empty |
| `ammo` | empty | empty | empty | empty | pre-shot ammo | empty |
| `offsetDeg` | empty | empty | empty | empty | camera-forward to target-center angle in degrees, or empty | empty |
| `part` | empty | empty | empty | empty | `head`, `body`, or empty | `head`, `body`, or empty |
| `targetX` | source u target center x | empty | empty | empty | empty | empty |
| `targetY` | source u target center y | empty | empty | empty | empty | empty |
| `targetZ` | source u target center z | empty | empty | empty | empty | empty |

### `<basename>-frames.csv`

This file exists only when `meta.frames` exists. It intentionally exports the summary only;
the complete per-frame delta series stays in JSON.

Header:

```csv
count,p50,p95,p99,overBudgetWindows,overflow
```

| Column | JSON source | Notes |
|---|---|---|
| `count` | `meta.frames.summary.count` | Number of frame deltas in JSON `series`. |
| `p50` | `meta.frames.summary.p50` | Median frame delta, ms. |
| `p95` | `meta.frames.summary.p95` | Nearest-rank p95, ms. |
| `p99` | `meta.frames.summary.p99` | Nearest-rank p99, ms. |
| `overBudgetWindows` | `meta.frames.summary.overBudgetWindows` | Count above `PERF_FLOOR_MS`. |
| `overflow` | `meta.frames.summary.overflow` | Whether the frame arena overflowed. |

CSV cells are comma-separated, include a trailing newline, and quote cells containing commas, quotes, or line breaks. Quotes inside cells are doubled.

## Example JSON

```json
{
  "meta": {
    "schemaVersion": 2,
    "drillId": "counterstrafe_ad_v1",
    "weaponId": "ak47",
    "weaponSeed": 223,
    "rngSeed": 1,
    "backend": "webgl2",
    "displayHz": 144,
    "simHz": 128,
    "browser": "Mozilla/5.0",
    "sensitivity": 1,
    "sensitivityModel": "cs2-0.022deg",
    "movementModel": "cs2-source",
    "crossOriginIsolated": true,
    "startedAt": "2026-07-02T00:00:00.000Z",
    "unit": "source",
    "vStrafe": 250,
    "maxDrillSeconds": 300,
    "lateEventCount": 0,
    "bufferOverflow": false,
    "recorderOverflow": false,
    "suspect": false,
    "weapon": {
      "id": "ak47",
      "ads": { "fovDeg": 40, "sensitivityRatio": 1 },
      "bullet": { "model": "projectile", "speedU": 916.73, "gravityU": 32, "maxRangeU": 143.24 },
      "projectileOverflow": false
    },
    "targets": {
      "hitbox": { "widthU": 1, "heightU": 2, "depthU": 1 }
    }
  },
  "ticks": [
    { "t": 10, "vx": 250, "vz": 0, "px": 1, "pz": 2, "tx": 3, "ty": 1.6, "tz": -4, "aim": { "yaw": 0.5, "pitch": -0.25 }, "keys": ["D"], "ads": false },
    { "t": 17.8125, "vx": 0, "vz": 0, "px": 1.5, "pz": 2.5, "tx": null, "ty": null, "tz": null, "aim": { "yaw": 0.25, "pitch": 0 }, "keys": ["A", "D"], "ads": true }
  ],
  "events": [
    { "type": "visible", "targetId": "target-1", "side": "R", "t": 10, "targetX": 3, "targetY": 1.6, "targetZ": -4 },
    { "type": "counter", "key": "A", "t": 14 },
    { "type": "ads", "down": true, "t": 15 },
    { "type": "fire", "t": 18, "targetId": "target-1", "hit": false, "firstShot": true, "residualSpeed": 0, "shotSeq": 1, "viewYaw": 0.25, "viewPitch": -0.1, "aimPunchPitch": -1.2, "aimPunchYaw": 0.8, "spreadX": 0.01, "spreadY": -0.02, "recoilIndex": 2, "ammo": 28, "offsetDeg": 0.5 },
    { "type": "hit", "t": 30, "targetId": "target-1", "shotSeq": 1, "timeOfFlightMs": 12, "part": "head" }
  ]
}
```

## Example CSV

`counterstrafe_ad_v1-ticks.csv`

```csv
t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys,ads
10,250,0,1,2,3,1.6,-4,0.5,-0.25,D,false
17.8125,0,0,1.5,2.5,,,,0.25,0,A|D,true
```

`counterstrafe_ad_v1-events.csv`

```csv
type,t,targetId,side,key,down,hit,firstShot,residualSpeed,shotSeq,timeOfFlightMs,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part,targetX,targetY,targetZ
visible,10,target-1,R,,,,,,,,,,,,,,,,,,3,1.6,-4
counter,14,,,A,,,,,,,,,,,,,,,,,,,
ads,15,,,,true,,,,,,,,,,,,,,,,,,
fire,18,target-1,,,,false,true,0,1,,0.25,-0.1,-1.2,0.8,0.01,-0.02,2,28,0.5,,,,
hit,30,target-1,,,,,,,1,12,,,,,,,,,,head,,,
```

## Offline Derived Fields

Detection pop-in analyses derive `eccentricity_at_spawn`, `t_detect`, timeout, anticipation,
and engagement time offline from the raw schema v2 rows above. The executable interface and
default provisional parameters live in
[`analysis-t-detect.md`](analysis-t-detect.md). These derived fields are not written by the
engine export.

Tracking analyses derive `t_acquire`, acquisition failure rate, TOT%, and RMS ε offline from the
same raw rows — the moving-target center trajectory (`ticks.tx/ty/tz`), the aim ray
(`ticks.aim.yaw/pitch` + `ticks.px/pz`), and the `visible` presentation boundaries. on-target reuses
the H1 hit geometry from `meta.targets.hitbox` when present, with the default H1 fallback for older
exports. The executable interface lives in
[`analysis-tracking.md`](analysis-tracking.md). These derived fields are not written by the engine
export.

Projectile lead analyses derive `lead_error_deg` offline from the same raw rows plus
`meta.weapon.bullet`, fire-time view angles, target tick trajectory, and linked `hit.shotSeq`
time of flight when available. Lead error is a WP-25 pilot construct, not a result-page metric;
the engine writes only `fire`/`hit` observations. The executable interface lives in
[`analysis-lead.md`](analysis-lead.md).

## FPSci Field Mapping Appendix

This appendix is a semantic mapping only. Per GD-11, FPSci source code is not copied; the mapping is based on FPSci documentation/papers and the local research note.

| Schema v2 field | FPSci SQLite area | Mapping | Notes |
|---|---|---|---|
| `ticks.t` | frame-wise timing | approximate | This project records fixed sim ticks; FPSci is frame-wise. Both are analysis time axes. |
| `ticks.px`, `ticks.pz` | frame-wise player state | same | Player position in the trial/session coordinate frame. |
| `ticks.vx`, `ticks.vz` | frame-wise player state | same | Player velocity; this project uses Source units. |
| `ticks.aim.yaw`, `ticks.aim.pitch` | frame-wise view/aim state | same | Camera/view direction over time. |
| `ticks.ads` | input/button state timeline | approximate | ADS state per fixed sim tick for reconstructing scoped windows. |
| `ticks.tx`, `ticks.ty`, `ticks.tz` | target trajectory table | same | Active target center trajectory. |
| `events.visible.t` | target spawn/visibility event | approximate | `t_visible` is spawn tick for pop-in targets. |
| `events.visible.targetX/Y/Z` | target spawn/visibility event | approximate | Spawn-time target center for offline `t_detect` / eccentricity derivation. |
| `events.fire.t` | click event table | same | Shot/click timestamp. |
| `events.ads.t/down` | input/button event table | approximate | ADS right-button transition timestamp and state. |
| `events.fire.hit` / `events.hit` | click/hit result | same | Hitscan uses `fire.hit`; projectile mode writes delayed `hit` events linked by `shotSeq`. |
| `events.fire.viewYaw/viewPitch` | click-time player view | same | Fire-time view snapshot. |
| `events.fire.aimPunch*`, `spread*`, `recoilIndex`, `ammo`, `shotSeq`, `events.hit.timeOfFlightMs` | weapon/recoil/projectile state | no direct equivalent | CS2 recoil/spread-specific state and WP-25 projectile timing for reproducibility. |
| `meta.session` | experiment/session/user status | approximate | Reserved v2 join keys; WP-20 fills participant/session labels. |
| `meta.display`, `meta.frames` | system/frame timing tables | approximate | Reserved v2 display and frame-time blocks. |
| `meta.scene` | environment/condition config | approximate | Reserved v2 scene condition block. |
| `meta.targets.hitbox` | target geometry/config table | approximate | Resolved H1 hitbox snapshot for offline on-target replay. |
| `meta.weaponId`, `meta.weapon`, `weaponSeed`, `rngSeed` | weapon/config seed fields | approximate | Reproducibility fields for weapon, ADS optics, and RNG streams. |

## Related Execution Plan

- WP-16 spec: [`docs/exec-plan/completed/stage2/wp-16-metrics-export-v2/README.md`](../exec-plan/completed/stage2/wp-16-metrics-export-v2/README.md)
- T1 task: [`docs/exec-plan/completed/stage2/wp-16-metrics-export-v2/T1-schema-v2.md`](../exec-plan/completed/stage2/wp-16-metrics-export-v2/T1-schema-v2.md)
- WP-21 detection derivation spec: [`docs/operational/analysis-t-detect.md`](analysis-t-detect.md)
- WP-18 tracking derivation spec: [`docs/operational/analysis-tracking.md`](analysis-tracking.md)
## Recorder Capacity

`capacityForDrill(simHz, maxDrillSeconds, extraTicks, maxFireHz)` reserves:

```text
ceil(maxDrillSeconds * (simHz + maxFireHz)) + ceil(extraTicks)
```

The default `maxFireHz` is `10`, matching AK-47 `1 / cycletimeSec`. This keeps the arena conservative after adding per-tick target/player position fields and v2 fire-event columns.
