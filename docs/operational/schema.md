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

CSV export writes two files with the same basename:

| File | Rows | Source |
|---|---:|---|
| `<basename>-ticks.csv` | one row per sim tick | `ticks[]` |
| `<basename>-events.csv` | one sparse row per drill event | `events[]` |

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

Tick rows are recorded inside the sim tick. Event rows use their source timestamp: visible events use sim tick time; counter/fire events use the input event `timeStamp`, which shares the `performance.now()` basis.

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
| `crossOriginIsolated` | boolean | `true` / `false` | Yes | runtime global | `false` is valid metadata, not a missing value. |
| `startedAt` | string | ISO-8601 | Yes | export/session start | Normalized by `collectMeta()`. |
| `unit` | string | `source` | Yes | fixed phase-A value | Velocity unit namespace. |
| `vStrafe` | number | source u/s | Yes | movement config/default | Defaults to `250`. |
| `maxDrillSeconds` | number | seconds | Yes | recorder/drill cap | Defaults to `300`; tied to arena capacity. |
| `lateEventCount` | number | count | Yes | input buffer telemetry | Non-negative integer. |
| `bufferOverflow` | boolean | `true` / `false` | Yes | input buffer telemetry | Marks dropped/late input-buffer data. |
| `recorderOverflow` | boolean | `true` / `false` | Yes | recorder snapshot | If true, arena refused later tick writes and preserved oldest rows. |
| `suspect` | boolean | `true` / `false` | Yes | derived validity flag | `true` if `bufferOverflow` or `recorderOverflow` is true. |
| `spawn` | object | reserved optional | No | stage3/WP-21 | v2 reserved block for `seed`, motion, and spawn-area snapshots. WP-16 writes seed/motion when available. |
| `scene` | object | scene condition | No | stage3/WP-19 | `{ sceneId, assetPackVersion, clutterTier, fallback }`. Additive; absence means scene system not active. |
| `display` | object | reserved optional | No | stage3/WP-20 | v2 reserved display/session setup metadata block. |
| `frames` | object/array | reserved optional | No | stage3/WP-20 | v2 reserved frame-time log block. |
| `session` | object | reserved optional | No | stage3/WP-20 | `participantId` / `sessionLabel` cross-session join keys. |

`buildExportPayload()` also ORs `meta.recorderOverflow` with `snapshot.recorderOverflow`, then recomputes `suspect` from the resulting recorder flag.

#### `meta.scene`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `sceneId` | string | scene config id | Yes | active `SceneConfig` | Example: `placeholder-room`, `field-low`. |
| `assetPackVersion` | string | asset/config version | Yes | active `SceneConfig` | Lets analyses group exports by scene asset revision. |
| `clutterTier` | string | `low`, `mid`, `high` | Yes | active `SceneConfig` | Scene clutter condition. |
| `fallback` | boolean | `true` / `false` | Yes | scene loader | `true` when the requested scene asset failed and render fell back to placeholder-room. |

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

### `events[]`

`events[]` is a discriminated union keyed by `type`.

#### `visible`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `visible` | Yes | target manager hook | Target became visible. |
| `targetId` | string | target id | Yes | target manager | Identifies the visible target. |
| `side` | string | `L`, `R` | Yes | target state | Peek side for left/right symmetry metrics. |
| `t` | number | ms | Yes | sim tick time | `t_visible`; reaction-time start. |

#### `counter`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `counter` | Yes | input consume hook | Counter-strafe key transition. |
| `key` | string | key code/name | Yes | input event | Current implementation records the counter key, for example `A` or `D`. |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis. |

#### `fire`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `type` | string | `fire` | Yes | fire input hook | Shot attempt. |
| `t` | number | ms | Yes | input event timestamp | `performance.now()` basis. |
| `hit` | boolean | `true` / `false` | Yes | hit detector | Whether the shot hit a target. |
| `firstShot` | boolean | `true` / `false` | Yes | first-shot gate | First shot for the current peek sequence. |
| `residualSpeed` | number | source u/s | Yes | movement state at fire | Used by WP-8 metrics. |
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

## CSV Schema

### `<basename>-ticks.csv`

Header:

```csv
t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys
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

### `<basename>-events.csv`

Header:

```csv
type,t,targetId,side,key,hit,firstShot,residualSpeed,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part
```

Rows are sparse because event variants have different fields.

| Column | `visible` | `counter` | `fire` |
|---|---|---|---|
| `type` | `visible` | `counter` | `fire` |
| `t` | event time | event time | event time |
| `targetId` | target id | empty | active/hit target id, or empty |
| `side` | `L` / `R` | empty | empty |
| `key` | empty | counter key | empty |
| `hit` | empty | empty | `true` / `false` |
| `firstShot` | empty | empty | `true` / `false` |
| `residualSpeed` | empty | empty | source u/s |
| `viewYaw` | empty | empty | radians |
| `viewPitch` | empty | empty | radians |
| `aimPunchPitch` | empty | empty | degrees |
| `aimPunchYaw` | empty | empty | degrees |
| `spreadX` | empty | empty | tangent offset |
| `spreadY` | empty | empty | tangent offset |
| `recoilIndex` | empty | empty | shot index used by this shot |
| `ammo` | empty | empty | pre-shot ammo |
| `offsetDeg` | empty | empty | camera-forward to target-center angle in degrees, or empty |
| `part` | empty | empty | `head`, `body`, or empty |

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
    "suspect": false
  },
  "ticks": [
    { "t": 10, "vx": 250, "vz": 0, "px": 1, "pz": 2, "tx": 3, "ty": 1.6, "tz": -4, "aim": { "yaw": 0.5, "pitch": -0.25 }, "keys": ["D"] },
    { "t": 17.8125, "vx": 0, "vz": 0, "px": 1.5, "pz": 2.5, "tx": null, "ty": null, "tz": null, "aim": { "yaw": 0.25, "pitch": 0 }, "keys": ["A", "D"] }
  ],
  "events": [
    { "type": "visible", "targetId": "target-1", "side": "R", "t": 10 },
    { "type": "counter", "key": "A", "t": 14 },
    { "type": "fire", "t": 18, "targetId": "target-1", "hit": true, "firstShot": true, "residualSpeed": 0, "viewYaw": 0.25, "viewPitch": -0.1, "aimPunchPitch": -1.2, "aimPunchYaw": 0.8, "spreadX": 0.01, "spreadY": -0.02, "recoilIndex": 2, "ammo": 28, "offsetDeg": 0.5, "part": "head" }
  ]
}
```

## Example CSV

`counterstrafe_ad_v1-ticks.csv`

```csv
t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys
10,250,0,1,2,3,1.6,-4,0.5,-0.25,D
17.8125,0,0,1.5,2.5,,,,0.25,0,A|D
```

`counterstrafe_ad_v1-events.csv`

```csv
type,t,targetId,side,key,hit,firstShot,residualSpeed,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part
visible,10,target-1,R,,,,,,,,,,,,,,
counter,14,,,A,,,,,,,,,,,,,
fire,18,target-1,,,true,true,0,0.25,-0.1,-1.2,0.8,0.01,-0.02,2,28,0.5,head
```

## FPSci Field Mapping Appendix

This appendix is a semantic mapping only. Per GD-11, FPSci source code is not copied; the mapping is based on FPSci documentation/papers and the local research note.

| Schema v2 field | FPSci SQLite area | Mapping | Notes |
|---|---|---|---|
| `ticks.t` | frame-wise timing | approximate | This project records fixed sim ticks; FPSci is frame-wise. Both are analysis time axes. |
| `ticks.px`, `ticks.pz` | frame-wise player state | same | Player position in the trial/session coordinate frame. |
| `ticks.vx`, `ticks.vz` | frame-wise player state | same | Player velocity; this project uses Source units. |
| `ticks.aim.yaw`, `ticks.aim.pitch` | frame-wise view/aim state | same | Camera/view direction over time. |
| `ticks.tx`, `ticks.ty`, `ticks.tz` | target trajectory table | same | Active target center trajectory. |
| `events.visible.t` | target spawn/visibility event | approximate | `t_visible` is spawn tick for pop-in targets. |
| `events.fire.t` | click event table | same | Shot/click timestamp. |
| `events.fire.hit` | click/hit result | same | Boolean hit outcome. |
| `events.fire.viewYaw/viewPitch` | click-time player view | same | Fire-time view snapshot. |
| `events.fire.aimPunch*`, `spread*`, `recoilIndex`, `ammo` | weapon/recoil state | no direct equivalent | CS2 recoil/spread-specific state for WP-16/WP-17 reproducibility. |
| `meta.session` | experiment/session/user status | approximate | Reserved v2 join keys; WP-20 fills participant/session labels. |
| `meta.display`, `meta.frames` | system/frame timing tables | approximate | Reserved v2 display and frame-time blocks. |
| `meta.scene` | environment/condition config | approximate | Reserved v2 scene condition block. |
| `meta.weaponId`, `weaponSeed`, `rngSeed` | weapon/config seed fields | approximate | Reproducibility fields for weapon and RNG streams. |

## Related Execution Plan

- WP-16 spec: [`docs/exec-plan/completed/stage2/wp-16-metrics-export-v2/README.md`](../exec-plan/completed/stage2/wp-16-metrics-export-v2/README.md)
- T1 task: [`docs/exec-plan/completed/stage2/wp-16-metrics-export-v2/T1-schema-v2.md`](../exec-plan/completed/stage2/wp-16-metrics-export-v2/T1-schema-v2.md)
## Recorder Capacity

`capacityForDrill(simHz, maxDrillSeconds, extraTicks, maxFireHz)` reserves:

```text
ceil(maxDrillSeconds * (simHz + maxFireHz)) + ceil(extraTicks)
```

The default `maxFireHz` is `10`, matching AK-47 `1 / cycletimeSec`. This keeps the arena conservative after adding per-tick target/player position fields and v2 fire-event columns.
