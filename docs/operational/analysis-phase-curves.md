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

## WP-32 TS promotion surface (`phase-v1` / `sync-v1`)

WP-32/T3 promotes `phase-v1` and `sync-v1` into `src/metrics/researchMetrics.ts` as TypeScript
ports of the frozen Python constructs. The parity direction is Python → TS: committed golden JSON is
generated by `research/src/modules/metrics/notebooks/t3/generate_promoted_phase_sync_golden.py`, and
`tests/golden/research/promoted-phase-sync.test.ts` compares the TypeScript output against those
files in `npm run test:ci`.

Parity surface:

| Construct | Golden files | TS entry point | Comparison |
|---|---|---|---|
| `phase-v1` | `research/fixtures/golden/phase-*.json` | `computePhaseMetrics(payload)` | per-peek `rec/mr/v/peak_omega/t_detect/rec_minus_detect` + drill aggregate |
| `sync-v1` | `research/fixtures/golden/sync-*.json` | `computeSyncMetrics(payload)` | per-peek three sync deltas + aggregate + two `PrecisionVerdict` rows |

Tolerance is pre-registered at three levels: SG constants remain T1's ≤1e-12 contract; floating
phase/sync values use relative error ≤1e-9 (absolute ≤1e-12 when the expected value is zero);
integer counts, flag sets, `verdict`, and `reason` strings are exact. The anti-vacuous checks are
also part of the committed parity test: pooled real phase non-degenerate rows must remain **59**,
and the 09:39 sync fixture must keep **13** unflagged rows.

`filter_degenerate` is the one intentional vocabulary difference on the TS promotion surface. Python
can emit it because the coach-report overlay calls `smooth_report_omega`; TS does not port
Butterworth because that path is report-only and never feeds REC/MR/V boundaries. Therefore the TS
promotion vocabulary is:

`KNOWN_PHASE_FLAGS - {'filter_degenerate'}`

Golden generation records both `pythonFlags` and TS-facing `flags`; parity compares the TS-facing
set, and asserts that removing only `filter_degenerate` from `pythonFlags` yields that set. Any other
missing or extra flag is a test failure. This difference has no effect on `t_onset`, `t_mr_end`,
`rec_ms`, `mr_ms`, `v_ms`, `peak_omega_deg_s`, or `rec_minus_detect_ms`.

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

### What it answers

Every peek's `[t_visible, t_first_shot]` window is resampled onto 101 equally spaced
normalized-time points, so peeks of different real duration become directly comparable curves. Each
peek produces **two** rows — one ω(t) curve and one ε(t) curve — which are then averaged per side
(L/R) into a mean curve + distribution band, answering "what does an L peek's movement look like,
shape-wise, versus an R peek's."

`research/src/modules/metrics/algorithms/curves.py`'s `normalize_101` is a generic linear
resampler: it drops non-finite samples (this is how ω's contractual leading `nan` — TD-3, D-29.4 —
disappears without the caller needing to slice it out, expressed as a value mask instead of an index
offset since this function works in the time domain, not `phase.py`'s tick-index domain) and raises
`ValueError` on genuinely degenerate input (fewer than two finite samples, or `t1 <= t0`) rather than
returning a guessed curve. `curve_table` turns that exception into a flag per row so a whole export's
resampling never aborts on one bad peek.

### Degenerate handling (never crashes)

| Condition | Flag | Effect |
|---|---|---|
| `peek.t_first_shot` is absent | `no_first_shot` | Both signal rows for this peek get an all-`NaN` curve. |
| Fewer than `min_ticks` ticks fall inside `[t_visible, t_first_shot]` | `window_too_short` | Both signal rows get an all-`NaN` curve. |
| `t_first_shot <= t_visible` (defensive; not observed in real data) | `degenerate_window` | Both signal rows get an all-`NaN` curve. |
| Caller could not resolve ε for this peek (missing eye origin/target geometry) | `missing_epsilon` | Only the `epsilon` row is affected; the `omega` row is unaffected. |
| This window's own tick spacing is not self-consistent | `non_uniform_dt` | Additive/diagnostic only (same D-29.5 pattern as `phase-v1`) — the curve is still computed; the row is excluded from `curve_summary` aggregation, not from `curve_table`. |
| `normalize_101` itself raises on data it did not expect (e.g. every in-window sample non-finite despite passing the tick-count check) | `degenerate_window` | Safety-net fallback so a resampling failure never propagates as an exception (Failure modes table, README §3, "退化不得 crash"). |

Flags are a closed vocabulary (`KNOWN_CURVE_FLAGS`); an unrecognized flag raises `AssertionError`
rather than being silently emitted, mirroring `peek.py`/`detect.py`/`phase.py`.

### Inclusion rule (`curve_summary`)

Same D-29.5 rule as every other WP-29/30 aggregate: a row's curve only enters the mean/band
computation when every one of its `p000..p100` values is finite **and** its `flags` tuple is empty.
Excluded rows are still counted (`n_excluded`) and remain in `curve_table`'s output for inspection —
only the aggregate step drops them. `n` in `curve_summary`'s output and `n` shown on any overlay are
the same number by construction (the overlay is built directly from `curve_summary`'s return value,
never a separately recomputed count).

## Frozen `curve-v1` parameter registry

| `points` | `min_ticks` | `band` | Version |
|---:|---:|---|---|
| 101 | 3 | `iqr` | `curve-v1` |

- **`points=101`** and **`band=iqr`** were pre-registered as format decisions before T3 ran (WP-30
  progress.md §3.2) — they do not need real data to decide, only a documented rule to freeze. IQR was
  chosen over mean±SD because each side has only n≈10 peeks per session; a small-sample distribution
  band is more robust to one noisy peek under IQR than mean±SD, and does not implicitly claim a
  normal distribution the raw aim-trajectory data hasn't been checked against (progress.md §3.2 has
  the full comparison).
- **`min_ticks=3`** is the one value T3 needed real data to set, per
  [`research/src/modules/metrics/notebooks/t3/generate_curves_report.py`](../../research/src/modules/metrics/notebooks/t3/generate_curves_report.py):
  the committed synthetic fixture's two peeks have **13** in-window ticks each (the natural
  short-window case for `curve-v1` — unlike `phase-v1`, where the *same* fixture's 24-tick full peeks
  deliberately DO trip `window_too_short`; `curve-v1`'s window is the narrower
  `[t_visible, t_first_shot]` sub-range and its threshold answers a different question — "enough
  points for a 101-point resample to represent more than a single stretched line segment" rather than
  "enough samples for a Butterworth `filtfilt`"). The pathological case the threshold guards against
  is a 1–2 tick window, not the synthetic fixture's 13. All 60 real peeks (09:18/09:24/09:37) have
  **>= 52** in-window ticks — `min_ticks=3` never excludes real data; it only excludes windows too
  short to be worth resampling at all. Changing any of the three values requires a new version
  (`curve-v2`) and a full-chain rerun — never an in-place edit (D-30.4, D-28.7 precedent).

### `synthetic_counterstrafe.json` regression

Unlike `phase-v1`'s synthetic case, `curve-v1`'s two synthetic peeks are asserted to **NOT** trip
`window_too_short` — `generate_curves_report.py` hard-fails if either does. This is the intentional
"short but valid window still produces a curve" regression case for this construct, distinct from
`phase-v1`'s "too short to filter, gracefully degrades" case on the same fixture.

## Real-data evidence (2026-08, P001, n=3 sessions)

Source: `research/src/modules/metrics/notebooks/t3/generate_curves_report.py`, run against the T0
fixture roster. Per-session, non-pooled (KI-004-S1/README §R-7 discipline, same as `phase-v1` above):

| Session | n(L) omega | n(R) omega | n(L) epsilon | n(R) epsilon | excluded |
|---|---:|---:|---:|---:|---:|
| 09:18 | 10 | 10 | 10 | 10 | 0 |
| 09:24 | 10 | 10 | 10 | 10 | 0 |
| 09:37 | 10 | 10 | 10 | 10 | 0 |

All 60 real peeks (20 per session, 10 L / 10 R) produced a complete, unflagged curve for both
signals in every session — none hit `no_first_shot` (WP-29 T1 already established
`firstShotHitRate`'s underlying first-shot presence is 20/20 for all three sessions),
`window_too_short`, or `missing_epsilon` (resolving ε required the same visible-event-then-first-tick
target fallback `run_pipeline.py` already uses for its own epsilon derivation — a tick-level target
gap exists in a minority of ticks per peek in these exports, same as the pipeline's own
`missing_target` handling, not a new gap `curve-v1` introduces).

Per-signal shape (qualitative, from the generated overlays,
`research/src/modules/metrics/notebooks/t3/outputs/overlays/`): every session's ω(t) mean curve is
near zero at both window endpoints and peaks near the middle of the normalized window (the flick
itself), and every session's ε(t) mean curve starts near its session's peak eccentricity and
decreases monotonically toward zero as the window approaches the first shot (aim converging on the
target) — both shapes are the expected qualitative signature for a counter-strafe peek and appear
consistently across all three sessions, though this review is structural/numeric (per-peek CSV
values and SVG polyline/band coordinates), not an eyeballed visual pass, per the same environment
limitation noted in `phase-v1`'s review above.

Full per-peek curve tables: `research/src/modules/metrics/notebooks/t3/outputs/curve-table-<fixture>.csv`.
Per-session summary: `outputs/curve-summary.csv`. L/R overlays (ω and ε, one file each per session):
`outputs/overlays/<fixture>-<signal>-lr-overlay.svg`.

## Known limits (`curve-v1`)

- Real-data evidence covers the same one participant (P001), three sessions, one 240 Hz machine, one
  drill config as `phase-v1` — not population-level validity (KI-004-S1/README §R-7).
- `curve-v1`'s ω(t) curve's first normalized point is necessarily derived from the first *defined*
  angular-speed sample (`omega_deg_s`'s index 1, since index 0 is contractually `nan`), not a
  genuine measurement at `t_visible` itself — there is no such measurement, angular speed being a
  between-tick quantity. In practice this is a single tick's (~7.8 ms) difference from
  `t_visible` out of a multi-hundred-ms window, but it means `p000` for the `omega` signal is a
  flat-held value rather than an interpolated one.
- `curve-v1`'s `non_uniform_dt` check is local to each peek's own tick slice (identical rationale to
  `phase-v1`'s, see above) — the export-wide `check_dt` report in `run_pipeline.py`'s summary remains
  authoritative for anything beyond this module's own diagnostic flag.
- `degenerate_window` (`t1 <= t0`) and the `normalize_101`-raises safety-net path did not occur in
  any of the 60 real peeks or the 4 synthetic-fixture rows in this sample; both are verified by unit
  test only, not by a real-data instance.
- Three sessions from one participant are shown side by side, never pooled into a single curve —
  any claim about "the" L or R shape should be read as "this participant's, in these three
  sessions," not a population statement.

## Coach-report v1 carrier contract

`research/src/report/coach_report.py` carries these frozen constructs into one deterministic,
self-contained HTML report (`coach-report-v1`). It computes phase rows and curve rows **once per
export** with the frozen defaults, then `--group-by side|ads|weapon_mode` only partitions those
already-computed rows; it never re-runs a threshold, detector, or parameter search for a subgroup.
The parameter block remains byte-identical across groupings.

- The REC/MR/V main table shows mean, p50, sample SD, `n`, excluded-row flag counts,
  `phase-v1`, and its new-construct validity tier. `curve-v1` renders inline L/R SVGs for ω(t) and
  ε(t), with IQR bands and the same `n`/excluded counts returned by `curve_summary`.
- `REC-end − t_detect` is deliberately a **research-only** section, never a coach main-table
  correction. A single session can be `session-insufficient`; the registered three-session
  anti-vacuous result is pooled `n=21`, p50 −78.1 ms, **systematic divergence**. Its cause remains
  OQ-S4-17, so neither REC nor `detect-v1` is retuned here.
- All trajectory derivation begins with `resolve_eye_origin(..., strict=True)` and
  `omega_deg_s(..., strict=True)`. Pre-WP-30 legacy exports can still render their frozen timeline
  and Sync evidence, but the v1 trajectory sections state that the strict source gate rejected the
  export and emit no phase or curve numbers.
- Real trajectory claims are limited to P001, one 240 Hz machine, one drill configuration, and the
  three same-day sessions. Reports are session-local; the HTML does not pool them or claim a
  population/training effect. Short windows, missing anchors, filter degradation, and all closed
  flags remain visible through the corresponding `n` and exclusion counts.
