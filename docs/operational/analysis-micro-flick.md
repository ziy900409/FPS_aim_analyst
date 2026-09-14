# Analysis Micro Flick Contract

This note defines the operational contract for `micro_flick_three_target_test_v8` metrics after WP-63. The scope is deliberately narrow: v8 is a researcher/practice drill with three simultaneously alive targets, so analysis must use the population-aware target-window primitive and the event-anchored micro-flick metrics. It must not be treated as an ordinary one-active-target drill.

## Metric Boundary

`deriveMicroFlickMetrics(payload)` is the canonical offline entry point for v8. It consumes only export facts:

- `visible` events with per-target `targetId` and `targetX/Y/Z`.
- `fire` events with `hit === true`, `targetId`, `viewYaw`, and `viewPitch`.
- `ticks[].dYaw` and `ticks[].dPitch` for tick-window mouse integration.
- `meta.scene.eye`, `meta.simToWorld`, `meta.weaponId`, `meta.simHz`, and `meta.targets.hitbox`.

The metric does not consume render-thread `aim` for L2 micro-adjust or direction prediction. That is intentional: render FPS can lag the 128 Hz sim tick stream, and WP-63 keeps the metric anchored to tick-integrated mouse deltas.

## Environment Gates

A v8 run is suitable for this metric contract only when these payload facts are present:

| Gate | Required state | Reason |
|---|---|---|
| `meta.displayHz >= 144` | required for metric-grade interpretation | Below 144 Hz, render `aim` can undersample short acquisition windows; even though L2 does not consume `aim`, the run environment is still below the WP-63 validity floor. |
| `meta.crossOriginIsolated === true` | required | Timer precision must stay on the COOP/COEP path used by the rest of the measurement stack. |
| `meta.weaponId === 'usp_s_laser'` | required | v8 is declared as zero-spread/zero-recoil so shot geometry is not contaminated by AK spread, recoil, or ADS FOV. |
| `meta.scene.eye` | required for strict analysis | Missing eye origin forces `legacy-default`, which is allowed only for backwards compatibility and not for metric-grade v8 runs. |
| `meta.targets.hitbox.shape === 'sphere'` | required for L2 | The angular radius uses the same ray/sphere assumption as the hit detector. |
| No sensitivity/FOV change after drill start | required | WP-63 T2 fixed stale gain, but a valid protocol still freezes aim settings during a run. |

`?rawMouse=1` is recommended for research capture, but WP-63 does not require it for metric calculation. Raw samples should be used in a later calibration/cohort WP before promoting micro-adjust interpretations beyond "calculable and reproducible."

## Quality Flags

The metric reports undefined values with explicit flags instead of returning `0` for missing evidence. Downstream consumers must preserve these flags and must not coerce `undefined` to zero.

Important flags:

- `missing_target_position`: the export cannot reconstruct per-target geometry.
- `missing_view_angles`: fire events cannot anchor shot geometry.
- `no_mouse_integration`: tick rows lack `dYaw`/`dPitch`.
- `no_hitbox` or `unsupported_hitbox_shape`: L2 angular-radius metrics are unavailable.
- `ammo_exhausted_in_run` / `ammo_exhausted_in_window`: shot-rate metrics are withheld because magazine state may truncate firing intent.
- `replacement_distance_not_comparable`: aggregate replacement engagement is withheld; use `replacementEngagedByRank` instead.

## Synthetic Gates

WP-63 T7 freezes seven synthetic probes in `src/metrics/microFlickMetrics.test.ts`:

| # | Probe | Expected signal |
|---:|---|---|
| 1 | Straight flick into a 300 ms window | `reEntryCount === 0`, `signReversalCount === 0`. |
| 2 | Feint from A toward B | short `W` predicts A, longer `W` predicts B. |
| 3 | Choppy correction path | higher `signReversalCount` and `dwellPathRatio` than the straight path. |
| 4 | Overshoot then return | `reEntryCount >= 1` and `signReversalCount >= 1`. |
| 5 | Stale 60 Hz render `aim` | L2/direction outputs are bit-identical to fresh `aim` when `dYaw/dPitch` match. |
| 6 | Pause then resume: flick into the radius, hold for 10 ticks (78.125 ms), micro-adjust, then fire | `approachToFireMs` **includes** the pause: it exceeds the paused-versus-unpaused control by exactly the pause length, and `reEntryCount` is unchanged (the hold stays inside the angular radius). |
| 7 | Near replacement | `nearest3Deg < nearest2Deg`, with rank-specific replacement evidence. |

The same test file also freezes:

- tick-rate sensitivity at 64/128/256 Hz, requiring FR-63.10 numeric drift below 5%. The probe resamples **one continuous trajectory** (0° → 6.5° → 5° over 1.000 s) at the three rates, and asserts up front that the two discrete counters are non-zero at the 128 Hz baseline — on a monotone ramp they would both be `0`, and the equality check would prove nothing;
- that `deriveMicroFlickMetrics()` ignores `meta.displayHz` and `meta.frames`;
- v1-v7 micro-flick fixture snapshots so the v8 harness does not silently rewrite legacy drills. Note this snapshot compares an 11-field config subset with `widthU` rounded to three decimals; the bit-exact protection for v1-v7 comes from those config objects being untouched by WP-63 plus the existing per-key assertions in `micro_flick_three_target_test_variants.test.ts`.

**Render-FPS parity (NFR-63.2) lives in its own file**: `src/loop/__tests__/wp63-v8-metrics-determinism.test.ts`
runs the **real** v8 drill — seeded `TargetManager` spawns, real hitscan hit detection, real `DataRecorder` —
and pumps the same input sequence through 30/60/144/240 Hz frame sequences, then compares tick traces, events,
and all four metric layers with deep `Object.is` equality. Two sides of a parity comparison must come from two
real executions of the thing under test; a comparison whose two sides share one generator is always green and
proves nothing about the pipeline (see [GD-39](../exec-plan/DECISIONS.md) ⑥).

## Interpretation Limit

Passing these gates means the v8 metric layer is reproducible, population-aware, and auditable. It does not establish coaching validity, promotion to Assessment history, or a human-calibrated micro-adjust threshold. Those require a later cohort and a separate decision record.
