# FPS 4-Quadrant Metrics Roadmap

> **Status**: Draft (2026-05-20)
> **Owner**: Hsin Yang
> **Anchored in**: `docs/algorithm/research/FPS 瞄準與急停指標研究.md`
> **Decisions captured by**: ADR-0001, ADR-0002
> **Glossary terms added**: Tracking Segment, Release-to-Click Sync, Key-Velocity Coupling (see `CONTEXT.md`)

This roadmap commits Vantage-Stats to a 6-indicator FPS performance evaluation pipeline grounded in the 4-quadrant framework of the research paper. Two of the 6 indicators are renamed behavioral proxies for research-doc indicators that name hardware quantities Vantage-Stats cannot directly measure (see ADR-0001). The 7th indicator from the research paper (Strain Index / 應變指數) is **out of scope** — it is an ergonomic injury-risk score, not a kinematic observable, and conflicts with the Precision Aimer persona.

---

## 1. Indicator commitments

| # | Tier | Indicator | Quadrant | Status | Notebook deliverable |
|---|------|-----------|----------|--------|----------------------|
| 1 | T1 | Per-segment SPARC (flick + tracking) | Q1, Q2 | Not started | `q2-per-segment-sparc.ipynb` |
| 2 | T1 | Per-segment LDJ-V | Q1, Q2 | Not started | `q1-per-segment-ldj.ipynb` |
| 3 | T1 | Primary sub-movement ratio | Q1 | Math exists in Go segmentation; needs formalization | `q1-primary-submovement-ratio.ipynb` |
| 4 | T1 | Velocity scaling consistency (Fitts compliance) | Q1 | Partial overlap with `spidershot_fitts.py`; needs peak-velocity-vs-distance regression | `q1-velocity-scaling.ipynb` |
| 5 | T2 | **Release-to-Click Sync** *(behavioral proxy for 急停同步延遲)* | Q3 | Not started; gated on KovaaK scenario survey | `q3-release-to-click-sync.ipynb` |
| 6 | T3 | **Key-Velocity Coupling** *(lagged cross-correlation, proxy for 雙手耦合)* | Q4 | Not started; gated on KovaaK scenario survey | `q4-key-velocity-coupling.ipynb` |

Each notebook is the **tier exit criterion** for that indicator: a Precision Aimer reading the notebook end-to-end should understand what the metric measures, see it computed on real KovaaK data, and form their own judgment about whether the metric is informative.

---

## 2. Data dependency tiers

Indicators are grouped by what data they need, not by quadrant. Tier order is strict — finish a tier before starting the next.

### T1 — Mouse-only (4 indicators)

**Inputs**: Raw Trace, existing sub-movement segmentation, target metadata. No new data wiring.

**Shared infrastructure**: a `per_segment_apply(segment_df, segments, metric_fn)` framework in `research/src/modules/analysis/algorithms/` that takes a segment list and a metric function, returning a per-segment DataFrame. All four T1 indicators sit on top of it.

**T1 new component**: Python `tracking` segment classifier with the 3-condition rule (`has_target ∧ low_speed ∧ sustained_correction`) from `docs/algorithm/research/tracking-quality-algorithm-prototype-2026-03-25.md`. This is a new sub-movement kind in Python only — see ADR-0002.

**T1 exit gate**: 4 notebooks merged. KovaaK scenario survey (see §3) starts in parallel with T1 work so T2 is unblocked when T1 lands.

### T2 — Mouse + Keyboard (1 indicator)

**Inputs**: Raw Trace + `KeyboardTrace` from the ScenarioRecord JSON. KeyboardTrace is captured today but is not part of Fused Trace — Python loads it directly from the ScenarioRecord and aligns by QPC timestamp.

**T2 new component**: a `KeyboardTrace` loader + QPC alignment utility in `research/src/modules/fusion/` (or `analysis/` if that's where keyboard alignment naturally lives — decide at implementation time). This utility is the architectural lift for the whole tier.

**T2 exit gate**: 1 notebook merged, computed on ≥1 KovaaK scenario where a movement key is actually held during aiming (the scenario survey output).

### T3 — Mouse + Keyboard + Target (1 indicator)

**Inputs**: T2's KeyboardTrace alignment + the existing target-event stream + a windowed cross-correlation routine.

**T3 new component**: lagged cross-correlation over a sliding window. The implementation-level questions (signed vs binary key state, which velocity component, window length, lag range) are deferred to T3 time and answered in the notebook itself.

**T3 exit gate**: 1 notebook merged.

---

## 3. Gating: KovaaK scenario survey

T2 and T3 are blocked on **at least one validated KovaaK scenario** in which the player presses a movement key (W/A/S/D) while aiming. The current test corpus (`test/test_data/`) contains only Spidershot — a stationary-camera flick scenario with no meaningful keyboard activity.

The survey task is empirical, not algorithmic:

1. Enumerate KovaaK scenarios with `Movement` or `Strafing` in their metadata.
2. For each candidate, record 1–2 sessions and confirm the captured KeyboardTrace contains non-trivial press/release events.
3. Pick the smallest representative subset (1 for T2, 1–2 for T3) and add the ScenarioRecord JSON to `test/test_data/`.

If the survey concludes that **no KovaaK scenario meaningfully exercises Q3 counter-strafing**, T2 and T3 are re-scoped to a different data source (CS2 / Valorant demo parsing, AimLabs, or custom scenarios). This is the single biggest re-scope risk in the roadmap and is called out explicitly.

---

## 4. Delivery model

**Python-first.** All 6 indicators live in `research/src/modules/analysis/` and are exercised by notebooks under `research/src/modules/analysis/notebooks/` (or a new sibling location chosen at T1 time). The Go backend is not touched.

**Promotion to Go is on demand.** An indicator gets a Go port + parity generator + Golden Data + table-driven tests only when product decides it ships to the Vantage-Stats desktop App. Until that decision, Python is the canonical implementation. The promotion criterion is product-driven, not engineering-driven — engineering does not preemptively port.

---

## 5. Out of scope

- **Strain Index (應變指數 SI)** — ergonomic injury-risk metric, conflicts with Precision Aimer persona, requires modeling muscle activation from input frequency (different data model). Dropped from the 7-indicator research-doc table down to the 6 listed here.
- **Hall-effect hardware reset delay** — the original Q3 急停同步延遲 quantity (5.7 ms vs 13.3 ms). Requires hardware telemetry Vantage-Stats does not have. See ADR-0001.
- **HKB phase-coupled-oscillator coupling** — the original Q4 雙手耦合指標 model. Requires sustained periodic motion that FPS strafing does not produce. See ADR-0001.
- **Cognitive / physiological indicators** — Flow state, SEA-RCA visual-motor synchronization, MSK pain effects. Requires data Vantage-Stats does not capture (eye-tracking, self-report).

---

## 6. Known open questions (deferred to implementation tier, not now)

- **T1**: shared notebook scaffold or ad-hoc per indicator?
- **T1**: thresholds for the `tracking` classifier's `low_speed` and `sustained_correction` conditions — empirical on first KovaaK tracking scenario.
- **T3**: which keys count as "movement keys" — WASD only, or all? Signed direction encoding (A=-1, D=+1, S=-1, W=+1) or binary held/not-held? Which velocity component (speed magnitude, x-velocity, y-velocity, projected-on-target-direction)? Window length and lag range.
- **Promotion**: who decides Python-first → Go-promote, and on what trigger?
