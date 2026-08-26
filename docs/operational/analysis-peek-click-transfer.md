# Analysis Peek-click Transfer Pilot Contract

`peek-click-transfer-pilot-v1` is a Practice-only integrated transfer task. It asks whether a player can turn the component abilities measured separately by `hold-click-v1` (exposure/acquisition) and `counterstrafe-reversal-v1` (braking/first shot) into one self-motion peek: move out from cover, expose a static target, counter-strafe, and fire. It is not an Assessment protocol, a leaderboard task, or a replacement for either component measure.

## Trial timeline and geometry

The default researcher cell is the 2.0 degree target-size candidate in `peek-ad-corridor-v1`; 1.5 and 3.0 degree cells are available for pilot comparison. Each cell is deterministic and records its drill id, scene, seed, hitbox, and the visibility candidate (`N=9`, onset threshold `0.5`).

1. The 3 s countdown completes.
2. A 500 ms single A/D cue announces the next L/R side.
3. The target spawns behind the center cover. At the centered eye pose, its 9-point visibility fraction is below `0.5`.
4. The player moves in the cued direction. `tMeasurementOnsetMs` is the first 128 Hz tick where visibility fraction reaches `0.5`.
5. The player reverses direction to brake. A hitscan shot through a cover AABB is blocked; a first miss does not remove the target.
6. A hit or the spawn-anchored 3000 ms timeout ends that presentation and advances the strict L/R schedule. The block ends after 20 presentations or the 120 s backstop.

Runtime hitscan occlusion and offline visibility use the same `occlusionGeometry` segment/AABB kernel. Projectile occlusion is deliberately out of scope.

## Reported values

`derivePeekClickTransferMetrics()` joins the existing hold-click and counter-strafe results by `targetId`; it does not recompute their frozen definitions. Per presentation it emits:

- exposure/first-shot/completion timestamps: `tMeasurementOnsetMs`, `tFirstShotMs`, `onsetToFirstShotMs`, and `onsetToHitMs` when observed;
- outcome values: `firstShotHit`, `validFirstShot`, and `shotsToKill`;
- quality/context flags listed below.

At aggregate level it reports `validFirstShotRate`, existing `firstShotHitRate` and `fireBeforeGateRate`, `anticipationRate`, and the full existing `counterstrafe` metrics. There is intentionally no `score` or `compositeScore` field.

A valid first shot requires a first fire event that hits, occurs no earlier than measurement onset, and has residual speed below `CS2_PROFILE.accuracyThreshold`. Missing onset/fire/hit values remain missing; they are never converted to zero.

## Flags

| Flag | Meaning |
|---|---|
| `fire_before_first_visible` | The first fire occurred before any geometric visibility. |
| `fire_before_measurement_onset` | The first fire occurred before the 50% visibility onset. |
| `no_measurement_onset` | The target never reached the measurement-onset threshold. |
| `no_counter` | No reverse-direction counter event was observed. |
| `fire_before_gate` | The first fire was above the accuracy-speed gate. |
| `timeout` / `timeout_before_onset` | The target was not hit before timeout; the latter also never reached onset. |
| `player_corridor_exceeded` | Any tick in the presentation lies outside the scene corridor. |
| `suspect` | The session-level display/recorder suspect status applies to this presentation. |

## Interpretation boundaries

- Do not compare transfer onset-relative timing directly with hold-click detection latency: the transfer task permits a predictable strict L/R side sequence and self-motion creates exposure.
- Do not interpret a 20-presentation block as 20 independent participant observations. Presentations are nested trials; the participant is the independent replicate.
- Do not use these values in stage6 Assessment history, compatibility comparisons, diagnosis recommendations, or a combined score.
- The 1.5/2.0/3.0 degree target candidates and 3000 ms timeout are pilot settings, not frozen Assessment values. Formal adoption requires a separate pilot-data, power, analysis, and numeric-freeze decision.

## Verification evidence

The pilot configuration, geometry, wall-blocking behavior, metrics, session roster, and 60/120/240 Hz timeout export cadence are covered by the WP-45 unit suite. Full project typecheck, Vitest, and Playwright evidence is recorded in the WP-45 T-exit progress entry.
