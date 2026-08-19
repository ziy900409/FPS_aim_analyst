# Analysis Hold-Track Contract

WP-35 defines `hold-track-v1`: the fire-gated tracking variant of the aim-shooting-challenge family (FR-F7). It shares `hold-click-v1`'s emergence/exposure mechanism (WP-34) and `trackingDerivation.ts`'s tracking geometry (WP-18), and adds exactly two new engine capabilities — fire-gating and in-place freeze — plus the metrics that consume them.

## Fire-Gating Semantics

`TargetState.fireLocked?: boolean` ([types.ts](../../src/state/types.ts)) is an additive, sim-read-only flag written by `TargetManager` from `DrillConfig.timing.trackingStopMs`. It answers one question only — "does `scheduleFire` accept a consumption this tick?" — and never becomes a second state machine alongside the existing weapon-cycle gate.

`SimLoop.scheduleFire()` ([SimLoop.ts:507](../../src/loop/SimLoop.ts)) adds one AND condition to its existing while-loop gate:

```ts
while (state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs && !isFireLockedForActiveTarget(state)) { ... }
```

`isFireLockedForActiveTarget` reads the first alive+visible target's `fireLocked`; omitting the field (all pre-existing drills) evaluates to `false` and leaves behavior byte-identical. While locked, held-fire input is **not lost** — `nextFireT`/ammo stay untouched, so the player's held trigger is simply deferred, not dropped. Unlocking does not inject a bonus shot or reset cadence: the next `scheduleFire` call only consumes whatever the existing `cycleMs`/`nextFireT` arithmetic already allows.

Fire-gating is deliberately **not** merged into `WeaponConfig`/`nextFireT`/ammo semantics (D-35.1) — it is a target/drill lifecycle judgment, not a weapon-cycle or magazine state.

## `target_stop`: Definition And Time Source

`target_stop` is **freeze-in-place, not removal** — the opposite of the existing `presentationMs` expiry path (`markKilled`). When a `trackingStopMs`-tagged target's `age` reaches that threshold, `TargetManager.tick()` ([TargetManager.ts:191-209](../../src/sim/TargetManager.ts)):

1. Stops driving `motion` — `pos` freezes at the expiry instant (tested via `tStop.has(id)` as the freeze witness, not a second `motionFrozen` flag — D-35.4).
2. Flips `fireLocked` to `false` in the **same tick**.
3. Writes `SharedState.tStop: Map<targetId, number>` with the current sim-clock `nowMs` (same tick as step 2 — D-35.4, S-35.1 surfaced that unlocking alone does not stop `motionOffset` drive without this witness).

`target_stop` is exported as an additive event (`{ type: 'target_stop', targetId, t, targetX, targetY, targetZ }`, [DataRecorder.ts:23](../../src/data/DataRecorder.ts)) rather than into `meta`, because it is per-target/per-tick data, matching the existing `visible` event's shape (D-35.5). The frozen `targetX/Y/Z` in that event is the position `deriveStopTransitions` reuses for angle-error computation — no second target-position derivation.

After `target_stop`, the target is no longer `persistent`: the player's next fire (hit or miss) removes it via the existing `markKilled` path, unmodified.

This behavior only activates when `timing.trackingStopMs` is present. `schema.ts` rejects `presentationMs` and `trackingStopMs` appearing together ([schema.ts:70-72](../../src/drill/schema.ts)), so a drill can declare "advance on expiry" (`tracking_br_v1`) or "stop on expiry" (`hold_track_v1`) but never both.

## Fixed Tracking-Window Invariant

`persistent` + `presentationMs`/`trackingStopMs` already guarantee the tracking window's right edge is "the next `visible` event," independent of when (or whether) the player fires. `target_stop`'s freeze extends this: the window stays open through the stop until the next target spawns, regardless of fire timing.

[`holdTrackWindowInvariant.test.ts`](../../src/metrics/holdTrackWindowInvariant.test.ts) verifies this directly: firing at `t=10` (early), `t=500` (on time), or never all produce the identical `windowEndMs = 1000` and `windowEndMs - tVisibleMs = 1000`. This is the v1 acceptance condition ("`hold-track` 的追蹤窗不因提早擊殺而縮短") holding on the landed implementation.

## Metrics

### Acquisition And Tracking (Reused, Not Reimplemented)

`tAcquire`, acquisition failure, TOT%, RMS/median/P95 angular error come directly from `deriveTrackingMetrics()`/`deriveTrackingSamples()` ([trackingDerivation.ts](../../src/metrics/trackingDerivation.ts), WP-18 T4) — zero geometry changes for this WP (C-D4).

### Drop Count / Reacquire Time

`deriveTrackingTransitions(samples, targetId)` ([trackingTransitions.ts](../../src/metrics/trackingTransitions.ts)) consumes the exported `TrackingSample[]` and scans `onTarget` transitions after the first acquisition in the presentation:

- **`dropCount`**: number of on-target → off-target transitions.
- **`reacquireMs`**: for each drop that recovers (off-target → on-target before the window ends), the elapsed ms.

**Exclusion rule (OQ-S6-15, D-35.5)**: a drop that never recovers before the window ends still counts toward `dropCount`, but its duration is **not** appended to `reacquireMs`. Filling it with the remaining window time would misrepresent a right-censored observation as an observed reacquire duration; downstream presentation must report the effective `reacquireMs.length` alongside its mean, since `n` for this statistic is smaller than `dropCount` whenever a terminal drop occurs.

### Stop-Transition Metrics

`deriveStopTransitions(payload)` ([stopTransitionDerivation.ts](../../src/metrics/stopTransitionDerivation.ts)) reads the exported `target_stop` events and, for each, looks up that target's first fire via the existing `buildPeekWindows()` ([peekWindows.ts](../../src/metrics/peekWindows.ts)) — the same first-shot selection every other protocol uses (C-D4). Only a fire with `t_fire >= t_stop` counts as the post-stop first shot; a fire recorded before the stop (should not occur under fire-gating, but guarded regardless) is treated as absent.

Per target:

- **`fireToStopMs`** = `t_fire − t_stop` (undefined if no qualifying fire was recorded).
- **`firstShotHitAfterStop`**: the existing `hit` outcome of that same fire event — not a new hit judgment.
- **`fireAngleErrorDeg`**: angular error between the fire-time aim ray and the frozen stop position, computed via the existing `angularEccentricityDeg()`/`resolveEyeOrigin()` ([eyeOrigin.ts](../../src/metrics/eyeOrigin.ts)) — the same angle-error math used everywhere else, evaluated against the tick nearest-at-or-before the fire time.

## Relationship To `tracking_br_v1` / `presentationMs`

`tracking_br_v1` ([tracking_br_v1.ts](../../src/drill/tracking_br_v1.ts)) measures tracking error (ε(t)) during continuous movement and deliberately allows firing throughout — it has no fire-gating and no stop. It supplies `presentationMs`, so `TargetManager` marks its targets `persistent` and `DrillRunner`'s existing expiry path removes them (`markKilled`) once the presentation time elapses — an **advance**, not a stop. This existing test suite is unmodified by WP-35 (mechanical criterion: `git diff` shows only additive branches guarded by `trackingStopMs`).

`hold_track_v1` supplies `trackingStopMs` instead — the target freezes in place and unlocks fire rather than being removed. The two fields are mutually exclusive per drill (`schema.ts`), so a reader encountering either field name can immediately tell which expiry semantics apply without inspecting the rest of the config.

## Known Limitations

- `fireAngleErrorDeg` uses the tick nearest-at-or-before the fire timestamp, matching the existing tick-quantization tolerance used elsewhere in the codebase (not a new quantization source).
- `deriveTrackingTransitions` and `deriveStopTransitions` are independent, additive consumers of existing exported data; they do not interact with each other or with `deriveTrackingMetrics`'s aggregation.
- Weapon/motion condition-cell values in `hold_track_v1` (`src/drill/hold_track_v1.ts`) are pilot candidates (WP-39), intentionally independent of `tracking_br_v1`'s matrix — the two drills are not meant to be compared as a shared condition cell.
