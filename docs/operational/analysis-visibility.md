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

## Occlusion-Aware Clearance Policy (WP-34 T2)

Hold-click drills need a target that is deliberately occluded before emergence — the opposite of the legacy `validateClearance(scene, drill)` invariant (zero occlusion across the full movement envelope), which every other drill still relies on for "guaranteed reachable" clearance.

`validateClearance` gained an **additive, opt-in** third parameter, `ClearanceOptions`:

```ts
interface ClearanceOptions {
  allowedOcclusionPropIds?: readonly string[];
  exposedRestEnvelope?: TargetEnvelope;
}
```

- Omitted (or called as `validateClearance(scene, drill)`) → byte-identical legacy behavior. This is a mechanical test criterion (`clearance.test.ts` is unmodified), not just a stated intent.
- `allowedOcclusionPropIds`: only these named props may occlude the *emergence* envelope. Every other prop still must clear the full envelope — an unlisted prop that happens to occlude is a bug, not a design choice.
- `exposedRestEnvelope`: the post-emergence resting sub-envelope (the hold-click first-shot assessment window) must be unoccluded by **every** prop, including the ones listed in `allowedOcclusionPropIds`. This is what stops "still partly hidden" ticks from leaking into first-shot judgment.

`loadDrill(source, scene, { clearance })` threads the same options through the drill-loading gate. `loadDrill(source, scene)` (two-arg call) keeps calling strict clearance — so pairing a scene with occlusion semantics (e.g. `peek-corridor`) with an unaware drill still fails loudly, rather than silently becoming permissive because of the scene's identity. Occlusion semantics live on the *options*, never implicitly on `sceneId` (D-34.4).

`hold_click_v1` (`src/drill/hold_click_v1.ts`) is the frozen reference usage: scene `peek-corridor`, `allowedOcclusionPropIds: ['cover-wall']`, and an `exposedRestEnvelope` placed clear of the cover wall on the opposite side of the corridor.

## Known Limitations

- `N` and `onsetThreshold` are pre-registered *candidates* (`N=9`, `onsetThreshold=0.5` for `hold_click_v1`), not final values — WP-39's calibration pilot owns the frozen numbers (OQ-AF-01 in `aim-assessment-framework-v1.md`).
- Visibility sampling only tests point-vs-AABB occlusion against `SceneConfig.propBounds`; it has no model of partial/soft occlusion, translucency, or props with non-axis-aligned geometry.
- `deriveVisibilityTimeline` assumes a single moving target per presentation window; it does not disambiguate overlapping presentations from multiple simultaneously visible targets.
- The contract intentionally does not define a stop/tracking-window construct — that is `hold-track-v1`'s scope (WP-35), which layers fire-gating and a tracking window on top of this same visibility timeline without redefining `visibleFraction`/`tMeasurementOnset`.
