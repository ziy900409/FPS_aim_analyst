# Phase decomposition (`phase-v1`) and normalized L/R curves (`curve-v1`)

This document is the operational registry for WP-30's trajectory-diagnostic layer: **`phase-v1`**
(REC/MR/V decomposition, FR-D11, this section) and **`curve-v1`** (101-point normalized L/R
ω(t)/ε(t) curves, FR-D12, added by T3). Both consume the same upstream constructs as WP-28/29 —
`omega_deg_s(strict=True)`, `resolve_eye_origin(strict=True)`, `build_peek_windows`
(`timeline-v1`), `segment_submovements` (`seg-v2`) — and introduce no second definition of any of
them (C-D4).

## `phase-v1`

### What it answers

Every peek is split into three consecutive, non-overlapping segments between `t_visible` and the
first compatible shot:

| Segment | Definition | Meaning |
|---|---|---|
| **REC** (reaction) | `[t_visible, MR.start)` | Time from target visibility to the start of the primary movement. |
| **MR** (main run) | `MR.start .. MR.end` (inclusive) | The primary movement itself. |
| **V** (verification) | `(MR.end, t_first_shot]` | Time from the end of the primary movement to the first compatible shot. |

`MR` is **not a new detector** — it is read verbatim off the existing `seg-v2` (or `seg-v1`, for
`aim-diff-legacy` exports) `primary_flick` [`Segment`](../../research/src/modules/segments/algorithms/submovement.py)
for that peek (D-30.1). `research/src/modules/metrics/algorithms/phase.py`'s `phase_decompose`
contains **no motion-onset detection of its own**: `t_onset`/`t_mr_end` are `Segment.start_idx`/
`end_idx` mapped through the peek's own tick timestamps, nothing else. When a peek segments into
more than one interval, `MR` is the segment already labeled `primary_flick` by `segment_submovements`
— there is at most one per peek by construction, so "which segment is MR" (D-30.1b) reduces to "use
the one seg-v2 already calls the primary flick," not a new selection rule.

Zero-phase Butterworth smoothing (`smooth_report_omega`) exists **only** to produce a readable curve
for the coach-report / notebook overlay. It is never consulted for any boundary decision — the
module contains no code path where a Butterworth-filtered value feeds `t_onset`, `t_mr_end`,
`rec_ms`, `mr_ms`, or `v_ms`.

### Degenerate handling (never crashes)

| Condition | Flag | Effect |
|---|---|---|
| Window has fewer than `min_window_ticks` samples | `window_too_short` | All three phases `None`; no further processing attempted. |
| No `primary_flick` segment in this peek | `no_primary_flick` | REC/MR/V all `None` (there is nothing to anchor REC or V to either). |
| `peek.t_first_shot` is absent | `no_first_shot` | `t_anchor`/`v_ms` are `None`; REC/MR are still computed. |
| `t_first_shot < MR.end` (shot fired before or during the flick's own tail) | `anchor_before_onset` | `rec_ms`/`mr_ms`/`v_ms` all `None` — a negative duration is never emitted (generalizes the spec's literal "fired before MR start" case to the whole MR span, since a shot fired during the flick's tail would otherwise produce a negative `v_ms`). Raw `t_onset`/`t_mr_end`/`t_anchor` timestamps are retained for diagnostics. |
| `butter_filter` raises (`cutoff_hz` at/above Nyquist, or too few samples for the requested `filtfilt` order) | `filter_degenerate` | The report-only smoothed curve falls back to the unfiltered trace; no boundary field is affected. |
| This window's own tick spacing is not self-consistent | `non_uniform_dt` | Additive/diagnostic only (D-29.5 pattern) — does **not** null `rec_ms`/`mr_ms`/`v_ms`. |

`non_uniform_dt` here is a **narrower** check than `run_pipeline.py`'s: `phase.py` is a pure
algorithms module that only ever sees one peek's own tick slice, so it compares each interval
against that window's own median interval rather than threading `meta.simHz` through the layer.
Same meaning ("tick spacing unsuitable for uniform-rate downstream calculations"), evidence scoped
to the window instead of the whole export.

Flags are a closed vocabulary (`KNOWN_PHASE_FLAGS`); an unrecognized flag raises `AssertionError`
rather than being silently emitted, mirroring `peek.py`/`detect.py`.

### Consistency check: REC-end vs. `t_detect`

`t_detect` (WP-30/T1, `detect.py`) is cross-checked against `t_onset` (REC-end) as
`rec_minus_detect_ms = t_onset - t_detect`. This is a **check, not a boundary input** — `t_detect`
never participates in computing `t_onset`, `rec_ms`, or any other phase field. Rows follow the
same D-29.5 inclusion rule as every other WP-29/30 aggregate (finite value **and** empty `flags`).

## Frozen `phase-v1` parameter registry

| `cutoff_hz` | `butter_order` | `min_window_ticks` | Version |
|---:|---:|---:|---|
| 12.0 | 4 | 30 | `phase-v1` |

Frozen 2026-08 by `research/src/modules/metrics/notebooks/t2/sweep_phase_params.py`, following the
same dual-dimension discipline that froze `seg-v2` — a candidate that only passes on synthetic data
is not eligible (this is exactly how `seg-v1`'s SG window went uncalibrated against real data; see
[analysis-segments.md](analysis-segments.md)):

- **Dimension 1 (synthetic, structural).** Six pre-registered cases — the same three known
  submovement profiles that froze `seg-v2` (`single_flick`, `flick_plus_one_micro`,
  `flick_plus_three_micro`), each run with and without a first-shot anchor. `t_onset`/`t_mr_end`
  must equal the underlying `Segment`'s boundary **exactly** (0-tick error, stronger than the ≤2-tick
  bar `seg-v2` itself cleared) for every one of the 18 swept candidates — a structural guarantee of
  the "no second definition" design, not something a parameter choice can fail.
- **Dimension 2 (real, ≥90% pre-registered threshold).** Of the 60 real peeks across the three T0
  fixtures (09:18/09:24/09:37), the fraction with all three phases non-degenerate (none of
  `window_too_short`/`no_primary_flick`/`no_first_shot`/`filter_degenerate`/`anchor_before_onset`)
  must be ≥90%. The frozen candidate scores **59/60 = 98.33%** — the sole exclusion is 09:24's
  known `below_floor`/0-segment peek (D-30.1b), already accounted for in `seg-v2`'s own 98.3%
  success rate. All 18 candidates in the swept grid (`cutoff_hz` ∈ {8, 12, 16}, `butter_order` ∈
  {2, 4}, `min_window_ticks` ∈ {24, 30, 40}) cleared both dimensions identically, because every real
  peek's own tick count (minimum 53 across all three fixtures) comfortably exceeds every candidate
  `min_window_ticks` and every candidate `butter_order`'s `filtfilt` padlen requirement — the
  smoothing path never degenerates on real data at this parameter scale. `min_window_ticks=30` was
  chosen from within that tied set specifically so the synthetic fixture's 24-tick peeks trip
  `window_too_short` deterministically (see below), rather than picking a value that happens to let
  them through.

Full candidate comparison: `research/src/modules/metrics/notebooks/t2/outputs/phase-sweep.csv`.
Changing any of the three numeric values requires a new version (`phase-v2`) and a full-chain rerun
— never an in-place edit (D-30.4, D-28.7 precedent).

### `synthetic_counterstrafe.json` is a required regression, not "unsupported"

The committed synthetic fixture has 48 ticks across 2 peeks (24 ticks each) — below the frozen
`min_window_ticks=30`. Both of its peeks therefore hit `window_too_short` deterministically; this is
asserted by `generate_phase_report.py` as a hard regression check, and is the natural "short window
degrades gracefully" case the spec calls for (S-30.3), not a case phase-v1 fails to handle.

## Real-data evidence (2026-08, P001, n=3 sessions)

Source: `research/src/modules/metrics/notebooks/t2/generate_phase_report.py`, run against the T0
fixture roster. Per-session, non-pooled (KI-004-S1/README §R-7 discipline — one anonymized
participant, one machine, one drill config; not population-level evidence):

| Session | n | REC p50 (ms) | MR p50 (ms) | V p50 (ms) | peak ω p50 (deg/s) |
|---|---:|---:|---:|---:|---:|
| 09:18 | 20 | 58.6 | 238.3 | 191.5 | 170.3 |
| 09:24 | 19 (1 `no_primary_flick`) | 54.7 | 242.2 | 188.3 | 180.2 |
| 09:37 | 20 | 66.4 | 265.6 | 137.3 | 156.6 |

Full distributions (mean/p50/sd/n/n_flagged per session per metric):
`research/src/modules/metrics/notebooks/t2/outputs/phase-distributions.csv`. Per-peek rows:
`phase-quality-<fixture>.csv` in the same directory.

### REC-end vs. `t_detect` consistency verdict

**Systematic divergence**, not consistency and not `blocked-by-data`:

| Session | n (`detected`, REC defined) | median REC-end − t_detect (ms) |
|---|---:|---:|
| 09:18 | 8 | −66.4 |
| 09:24 | 8 | −74.2 |
| 09:37 | 5 | −85.9 |
| **pooled** (anti-vacuous gate only) | **21** | **−78.1** |

Pooled `n=21 ≥ 10` (T0's anti-vacuous threshold, OQ-S4-15 resolved as "not blocked-by-data"), and the
pooled median offset (−78.1 ms ≈ 10 ticks) is far larger than the ±1-tick (7.8 ms) consistency bar,
in the same direction and of comparable magnitude in every one of the three sessions (not one
outlier session). `seg-v2`'s velocity-threshold `MR.start` fires **before** `detectionDerivation`'s
sustained-eccentricity-decrease `t_detect` in every session, by roughly 9–11 ticks. Per §2 of
[T2-phase-decompose.md](../exec-plan/active/stage4/wp-30-trajectory-metrics/T2-phase-decompose.md),
this divergence is recorded as a finding — **REC is not redefined to align with `t_detect`, and
`t_detect`'s parameters are not retuned here** (both are out of this task's scope; retuning would
also violate C-D4 by editing an already-frozen construct's calibration based on a different drill's
data). See OQ-S4-17 (WP-30 README §7) for the follow-up question this raises.

**Plausible mechanism** (not yet independently confirmed): `t_detect`'s `theta_v = 3 × SD` threshold
and `k = 4` consecutive-tick requirement were calibrated for a detection pop-in drill's more gradual
eccentricity change (`analysis-t-detect.md` §Sensitivity Analysis, OQ-S4-15's original concern);
`seg-v2`'s angular-speed peak-gate can accept a `primary_flick` onset as soon as raw angular speed
clears its own threshold, which a sharp counter-strafe flick reaches well before eccentricity has
decreased for 4 sustained ticks. The two constructs are not measuring the same window of the same
movement — this is not evidence either derivation is wrong on its own terms.

Per-peek overlays for manual review: `research/src/modules/metrics/notebooks/t2/outputs/overlays/
<fixture>/peek-<NNN>-overlay.svg` (grey=REC, blue=MR, green=V, red dashed line=`t_detect`); 60 real
+ 2 synthetic files generated. Reviewed via the underlying per-peek records (band ordering,
non-negative durations, MR fully containing the trace's local peak) across all 62 files, plus direct
inspection of the raw SVG polyline/band coordinates for several representative peeks (including the
sole `no_primary_flick` case, 09:24 peek 0, which correctly renders with no colored bands). No
image-rendering tool is available in this environment, so this is a structural/numeric review
rather than an eyeballed visual pass; no anomalous sample beyond the known `no_primary_flick` case
and the systematic REC/`t_detect` offset above was found by that review.

## Known limits

- Parameters are registered for the nominal 128 Hz tick rate (same convention as `seg-v1`/`seg-v2`);
  a different sampling rate requires a new version.
- Real-data evidence covers one anonymized participant (P001) across three sessions on one 240 Hz
  machine and one drill config — not population-level validity (KI-004-S1/README §R-7).
- The REC-end/`t_detect` divergence above is a real, measured signal in this sample, not a
  calibration artifact of a short data run — but it has not been checked against a different
  participant or a deliberately varied `theta_v`/`k` sweep; do not treat the "9–11 tick lag"
  magnitude as a fixed correction factor.
- `phase-v1`'s `non_uniform_dt` check is local to each peek's own tick slice (see above) and will
  not catch a gap pattern that happens to preserve a peek's own median spacing while still
  disagreeing with the export's global nominal rate; `run_pipeline.py`'s export-wide `check_dt`
  report remains the authoritative uniformity source for anything beyond this module's own
  diagnostic flag.
- `anchor_before_onset` did not occur in any of the 60 real peeks in this sample; its handling is
  verified by unit test and by the six synthetic cases' "no first shot" variant family, not by a
  real-data instance yet.

## `curve-v1`

Pending WP-30 / T3 (101-point normalized L/R ω(t)/ε(t) curves). Pre-registered format decisions
(window `[t_visible, t_first_shot]`, `points=101`, linear interpolation with no extrapolation past
the endpoints, IQR distribution bands, D-29.5 inclusion rule) are recorded in
[WP-30 progress.md §3.2](../exec-plan/active/stage4/wp-30-trajectory-metrics/progress.md); `min_ticks`
and the frozen registry entry are added when T3 lands.
