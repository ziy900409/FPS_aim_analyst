# Analysis Visibility Contract

WP-34 T1 defines `visibility-v1`, the offline scene-layer visibility derivation for hold-click drills.

## Inputs

- `ExportPayload.ticks[]`: `t`, `px`, `pz`, and the current target center `tx`/`ty`/`tz`.
- `ExportPayload.meta.scene.eye` plus `meta.simToWorld`, resolved through `resolveEyeOrigin`.
- `ExportPayload.meta.targets.hitbox`, or the H1 default hitbox when absent.
- `SceneConfig.propBounds`, treated as the single source for static occluder AABBs.

The derivation is a pure metrics-layer function. It does not import render, sim, `SharedState`, or live scene objects.

## Sampling

The pre-registered candidate for `visibility-v1` is `N=9`: target center plus the eight current-tick hitbox corners. For diagnostics and sensitivity checks, the implementation also accepts `N=1` center-only sampling. Other `N` values are intentionally rejected until a new contract version is registered.

For each sample point, the function traces the segment from `eyeOriginForTick(tick)` to that point and checks it against every `SceneConfig.propBounds` AABB with `segmentIntersectsAabb`.

```text
visibleFraction(tick) = unblocked sample points / N
```

Ticks with no target coordinates have `visibleFraction = 0`.

## Timeline Fields

- `tFirstVisible`: first tick time where `visibleFraction > 0`.
- `tMeasurementOnset`: first tick time where `visibleFraction >= onsetThreshold`.
- `tFullExposure`: first tick time where `visibleFraction == 1`.

`onsetThreshold` is a constructor parameter so the WP-39 pilot can freeze the final threshold without changing code behavior post hoc.

## Relationship To Existing Times

`t_visible` is the sim pop-in timestamp recorded by the runtime when a target becomes visible/alive. It does not account for static scene occlusion.

`t_detect` is derived from player response kinematics in `detectionDerivation.ts`.

`tMeasurementOnset` is the visibility-analysis onset: the first exported tick where enough of the target is geometrically visible through scene occluders. Hold-click reaction time uses `t_detect - tMeasurementOnset`, not `t_detect - t_visible`, when the target emerges from cover.

## OQ-S6-12 Sensitivity

The T1 fixture records an edge-grazing case where center-only sampling reports `1.0`, while `N=9` reports `5/9`. This demonstrates why `N` is part of the registered visibility contract: changing sample density can move `tMeasurementOnset` near occluder edges. WP-39 should freeze the final `N` and `onsetThreshold` together.
