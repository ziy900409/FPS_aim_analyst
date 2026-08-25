# Stage6 Pilot Protocol — Calibration and Freeze

> WP-39 T1 pilot procedure. This document defines reproducible candidate generation and collection; it does not execute human participant sessions or choose final frozen values.

## 1. Purpose and separation

Stage6 calibrates the candidate values used by the four assessment families before their formal `1.0.0` freeze. Generate all exploration drills with `src/pilot/pilotConfigs.ts`; every generated drill has `mode: 'practice'`. Practice exports intentionally contain no assessment metadata and therefore cannot produce a formal compatibility key or enter the baseline history.

The assessment protocols and their seeds remain unchanged during the pilot. The pilot roster begins at `90000`, disjoint from the assessment seed range currently ending at `37002`.

## 2. Participant and device preparation

1. Assign a stable `participantId` and a descriptive `sessionLabel` such as `stage6-pilot-day-1`.
2. Complete the same consent, eligibility, visual correction, FPS-experience, fullscreen, and background-process checks described in [pilot-protocol-stage3.md](pilot-protocol-stage3.md).
3. Record the actual display and browser configuration. A session that exits fullscreen or fails the performance floor remains exported but is marked suspect and is excluded from the primary calibration comparison.
4. Run an unrecorded practice round before every family so calibration measures the candidate, not unfamiliar controls.

## 3. Candidate roster

| Family | Generator | Candidate dimensions | Required analysis handling |
|---|---|---|---|
| Hold click | `buildHoldClickPilotConfigs` | near/mid/far `distanceU`; `onsetThreshold`; fixed `N=9` | Read the returned `visibility` companion; rerun existing visibility/hold-click derivation for each threshold. |
| Hold track | `buildHoldTrackPilotConfigs` | near/mid/far `distanceU` | Preserve the existing tracking-stop and movement schedule. |
| Spider Shot | `buildSpiderShotPilotConfigs` | `angularRadiusDeg`; hitbox width/height | Derive `D_deg` and `W_deg` exclusively through `deriveSpiderShotTransitions()`; do not introduce a second geometry calculation. |
| Counterstrafe reversal | `buildCounterstrafeReversalPilotConfigs` | one-dimensional `holdDurationMs` candidate set | Compare one hold-time dimension only; T0 closed the distance-style layered alternative. |
| Feedback policy | `PILOT_FEEDBACK_POLICY_CANDIDATES` | `minimal-end-of-block`, `unrestricted` | The export assembly accepts an explicit policy override; its omitted default remains `minimal-end-of-block`. |

Use the same candidate order for each participant or pre-register a counterbalanced order. Preserve both the generated config and the candidate labels beside each exported JSON so the offline analysis can be reproduced exactly.

## 4. Per-condition procedure

1. Generate the planned practice config from the named builder; do not hand-edit its mode, seed, or schedule.
2. Load the config, confirm `mode: 'practice'`, its pilot drill id, and seed range before starting.
3. Complete the prescribed target count, then export JSON.
4. Check `meta.drillId`, `meta.spawn.seed`, `meta.suspect`, the session fields, and the expected target condition details.
5. Save with a human-readable name, for example `P003_stage6-pilot_hold-click_near_threshold-0.4_<startedAt>.json`. The JSON metadata is still the authority; the filename is for audit convenience only.
6. Allow a short rest between condition cells and record interruptions, reruns, and any configuration deviation.

## 5. Freeze handoff

For each candidate family, retain the raw practice exports and a calculation record containing the included sessions, excluded/suspect sessions, statistic, and chosen value. WP-39 T2 may provisionally retain the existing candidate values when no human data is available, but it must state that explicitly in `DECISIONS.md`. Final changes must version the affected constant rather than overwrite the candidate history.

## 6. Pilot completion checks

- Every generated configuration was practice-only and used a seed ≥ `90000`.
- No pilot export appears in an assessment baseline or compatibility comparison.
- Hold-click records identify both `distanceU` and `onsetThreshold` with `N=9`.
- Spider Shot records retain exported hitbox and spawn information for the canonical `D_deg`/`W_deg` derivation.
- Counterstrafe reversal records retain the exact `holdDurationMs` candidate and both cue events where completed.
- The collection log records policy candidate, participant/session identifiers, suspect state, and exclusions.
