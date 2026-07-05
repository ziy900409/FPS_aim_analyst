# WP-7 Export Schema

> Source of truth: TypeScript export types in [`src/data`](../../src/data/DataRecorder.ts), especially `Meta`, `TickRecord`, `DrillEvent`, and `ExportPayload`.
> This document describes the phase-A download format produced by `downloadJSON()` / `downloadCSV()`.

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
| Aim (`yaw`, `pitch`) | radians, camera orientation written by `CameraController` |
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
| `backend` | string | `webgpu` or `webgl2` | Yes | renderer seam | Render backend selected by `createRenderer()`. |
| `displayHz` | number | Hz | Yes | `measureDisplayHz()` | Runtime display refresh estimate. |
| `simHz` | number | Hz | Yes | sim loop config | Defaults to `128`. |
| `browser` | string | user agent | Yes | `navigator.userAgent` or caller | `unknown` only when unavailable. |
| `sensitivity` | number | app setting | Yes | settings panel | Positive finite number. |
| `crossOriginIsolated` | boolean | `true` / `false` | Yes | runtime global | `false` is valid metadata, not a missing value. |
| `startedAt` | string | ISO-8601 | Yes | export/session start | Normalized by `collectMeta()`. |
| `unit` | string | `source` | Yes | fixed phase-A value | Velocity unit namespace. |
| `vStrafe` | number | source u/s | Yes | movement config/default | Defaults to `250`. |
| `maxDrillSeconds` | number | seconds | Yes | recorder/drill cap | Defaults to `300`; tied to arena capacity. |
| `lateEventCount` | number | count | Yes | input buffer telemetry | Non-negative integer. |
| `bufferOverflow` | boolean | `true` / `false` | Yes | input buffer telemetry | Marks dropped/late input-buffer data. |
| `recorderOverflow` | boolean | `true` / `false` | Yes | recorder snapshot | If true, arena refused later tick writes and preserved oldest rows. |
| `suspect` | boolean | `true` / `false` | Yes | derived validity flag | `true` if `bufferOverflow` or `recorderOverflow` is true. |

`buildExportPayload()` also ORs `meta.recorderOverflow` with `snapshot.recorderOverflow`, then recomputes `suspect` from the resulting recorder flag.

### `ticks[]`

| Field | Type | Unit / Values | Required | Source | Notes |
|---|---|---|---:|---|---|
| `t` | number | ms | Yes | sim tick end time | `performance.now()` basis. |
| `vx` | number | source u/s | Yes | `state.player.vx` | Lateral velocity. |
| `vz` | number | source u/s | Yes | `state.player.vz` | Forward/back velocity. |
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
| `targetId` | string | target id | No | active target / hit detector | Active target at fire time; present when a target exists. |
| `offsetDeg` | number | degrees | No | camera forward vs target center | Canonical source for WP-8 crosshair/aim alignment offset. |
| `part` | string | `head`, `body` | No | hit detector | Present only when a hit part is available. |

## CSV Schema

### `<basename>-ticks.csv`

Header:

```csv
t,vx,vz,yaw,pitch,keys
```

| Column | JSON source | Notes |
|---|---|---|
| `t` | `tick.t` | ms. |
| `vx` | `tick.vx` | source u/s. |
| `vz` | `tick.vz` | source u/s. |
| `yaw` | `tick.aim.yaw` | Camera yaw in radians. |
| `pitch` | `tick.aim.pitch` | Camera pitch in radians. |
| `keys` | `tick.keys.join('|')` | Empty when no tracked key is held. |

### `<basename>-events.csv`

Header:

```csv
type,t,targetId,side,key,hit,firstShot,residualSpeed,offsetDeg,part
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
| `offsetDeg` | empty | empty | camera-forward to target-center angle in degrees, or empty |
| `part` | empty | empty | `head`, `body`, or empty |

CSV cells are comma-separated, include a trailing newline, and quote cells containing commas, quotes, or line breaks. Quotes inside cells are doubled.

## Example JSON

```json
{
  "meta": {
    "drillId": "counterstrafe_ad_v1",
    "backend": "webgl2",
    "displayHz": 144,
    "simHz": 128,
    "browser": "Mozilla/5.0",
    "sensitivity": 1,
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
    { "t": 10, "vx": 250, "vz": 0, "aim": { "yaw": 0.5, "pitch": -0.25 }, "keys": ["D"] },
    { "t": 17.8125, "vx": 0, "vz": 0, "aim": { "yaw": 0.25, "pitch": 0 }, "keys": ["A", "D"] }
  ],
  "events": [
    { "type": "visible", "targetId": "target-1", "side": "R", "t": 10 },
    { "type": "counter", "key": "A", "t": 14 },
    { "type": "fire", "t": 18, "targetId": "target-1", "hit": true, "firstShot": true, "residualSpeed": 0, "offsetDeg": 0.5, "part": "head" }
  ]
}
```

## Example CSV

`counterstrafe_ad_v1-ticks.csv`

```csv
t,vx,vz,yaw,pitch,keys
10,250,0,0.5,-0.25,D
17.8125,0,0,0.25,0,A|D
```

`counterstrafe_ad_v1-events.csv`

```csv
type,t,targetId,side,key,hit,firstShot,residualSpeed,offsetDeg,part
visible,10,target-1,R,,,,,,
counter,14,,,A,,,,,
fire,18,target-1,,,true,true,0,0.5,head
```

## Related Execution Plan

- WP-7 spec: [`docs/exec-plan/completed/stage1/wp-7-data-recorder/README.md`](../exec-plan/completed/stage1/wp-7-data-recorder/README.md)
- T5 task: [`docs/exec-plan/completed/stage1/wp-7-data-recorder/T5-schema-doc.md`](../exec-plan/completed/stage1/wp-7-data-recorder/T5-schema-doc.md)
