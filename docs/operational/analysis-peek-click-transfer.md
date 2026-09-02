# Analysis Peek-click Transfer Contract

Peek-click transfer asks whether a player can turn the component abilities measured separately by `hold-click-v1` (exposure/acquisition) and `counterstrafe-reversal-v1` (braking/first shot) into one self-motion peek: move out from cover, expose a static target, counter-strafe, and fire. The pilot ids remain Practice-only evidence-collection tools; `peek_click_transfer_v1` is the formal Assessment release frozen by WP-53.

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
- Pilot v1/v2 values must not enter stage6 Assessment history, compatibility comparisons, diagnosis recommendations, or a combined score.
- The pilot target-size candidates are exploration settings: v1 uses 1.5/2.0/3.0 degrees; v2 uses 1/2.5/5 degrees after WP-52 T4. They are not formal Assessment cohorts.

## Verification evidence

The pilot configuration, geometry, wall-blocking behavior, metrics, session roster, and 60/120/240 Hz timeout export cadence are covered by the WP-45 unit suite. Full project typecheck, Vitest, and Playwright evidence is recorded in the WP-45 T-exit progress entry.

## Pilot v2 (WP-52)

`peek_click_transfer_pilot_v2` is a fully independent module/id/seed range from `peek-click-transfer-pilot-v1` — it does not replace v1, and v1's file/tests/exported evidence stay untouched (D-52.1). Its purpose is to open a second, independently auditable evidence-collection round. WP-52 T0 initially found no pilot data supporting a change to any v1 parameter, so v2 started out keeping v1's angular-size candidates (1.5/2/3 deg) verbatim (D-52.4) — but a manual pilot pass (T4) found that spread's candidates felt too similar, so D-52.9 widened them to **1/2.5/5 deg** (2.5° default candidate, ~5× min-to-max hitbox width instead of the original ~2×). Spawn-anchored 3000 ms timeout and no-warmup policy still keep v1's values verbatim (D-52.5/D-52.6). Nothing about the trial timeline, geometry, reported values, or flags described above differs between v1 and v2 — only the angular-size candidates, drill id (`peek_click_transfer_pilot_v2_<size>deg`), seed range (95000-series vs. v1's 94000-series), and evidence cohort are separate.

Operators add the pilot into a Session Plan through the existing free family-checkbox UI (`SessionPlanSetup`) by checking `'peek-click-transfer'` — WP-43 (FR-H3) already removed the named-preset selector project-wide in favor of free selection, so WP-52 T2 did not reintroduce one (see [DECISIONS.md GD-26](../exec-plan/DECISIONS.md)). That family checkbox resolves to **v1's** registered drill (`SessionRunner.ts`'s `resolveFamilyDrillId`, unchanged from WP-45) — it proves the KI-016 session-metadata gap is closed, not that it launches v2. Manually running v2 specifically goes through researcher mode's single-drill menu, which registers v2's 2.5° default (`main.ts`'s `availableDrills`, added WP-52 T4); no numeric protocol parameter is exposed in either UI.

### Evidence report

`buildPeekClickTransferPilotEvidenceReport()` (`src/pilot/peekClickTransferPilotEvidence.ts`) is a pure aggregator over one or more pilot sessions' presentations. It reports:

- `presentationCount`, `completionRate`, `timeoutRate`, `validFirstShotRate`;
- `leftRightBalance` (`{ left, right }` presentation counts, a sanity check against the strict L/R schedule);
- `flagCounts` — a tally of every flag in the table above across the sample.

It never derives a composite score, never touches file/network I/O, and accepts either `derivePeekClickTransferMetrics()`'s output or a hand-built synthetic fixture (same shape: `{ presentations }`).

## Formal v1 (WP-53)

`peek_click_transfer_v1` is the formal Assessment drill id released by WP-53 after the WP-52 manual gate and three real `peek_click_transfer_pilot_v2_masked` session exports were reviewed. The freeze decision is [DECISIONS.md GD-29](../exec-plan/DECISIONS.md): `protocolVersion='peek-click-transfer-v1.0.0'`, `angularSizeDeg=2.5`, `distanceU=8`, `targetCount=20`, and the existing 3000 ms spawn-anchored timeout plus `N=9` / `0.5` visibility onset.

Formal runs write `meta.assessment` and use the `buildPeekClickTransferV1ConditionCell()` compatibility cell. The history/trend registry accepts only the exact drill id `peek_click_transfer_v1` and projects `valid-first-shot-rate` plus median `onset-to-hit-ms` as primary metrics; `first-shot-hit-rate` and `fire-before-gate-rate` remain secondary descriptors. Pilot ids stay unregistered for formal trend projection, even if a test harness forcibly saves one as Assessment data.

Operators can include the formal transfer task in Session Plan through the independent family id `'peek-click-transfer-v1'`. This does not replace the pilot family id `'peek-click-transfer'` and does not modify the stage6 default four-family Assessment roster.

### Sampling limitations and what must not be over-claimed

- The WP-53 formal freeze used n=1 human pilot evidence as an explicit smoke-test threshold, not as population-level evidence. Do not claim stable population rates or training-effect estimates from it.
- Evidence-report output remains input-dependent: before a manual pilot pass it proves only aggregator correctness; after WP-52 T4 it supports the specific GD-29 freeze decision, not broader efficacy claims.
- A handful of participant sessions cannot establish population-level rates with usable precision. Future protocol changes or stronger claims require a new evidence threshold and version bump.
- Left/right balance from the evidence report only detects a *gross* scheduling defect (e.g. a broken alternation); it is not a substitute for the scene-geometry parity test that already covers spatial symmetry at the config level (NFR-52-2).
