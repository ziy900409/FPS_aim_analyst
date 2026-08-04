# Submovement segmentation and quality flags

This document is the operational registry for WP-28's offline segmentation layer. The algorithms
consume angular speed in degrees per second at the export's nominal 128 Hz tick rate. Radian to
degree conversion remains confined to `research/src/modules/kinematics/algorithms/angular.py`.

## Segment definition

`segment_submovements` smooths a finite trace with Savitzky-Golay filtering, gates peaks at the
larger of `mean + k * sd` and the absolute speed floor, and expands each accepted peak to the
registered low/stop ratios. Overlapping intervals are merged. The first interval is the
`primary_flick`; later intervals are `micro_adjustment` segments. Start and end indices are
inclusive.

Each `Segment` may carry a non-negative `peek_index`. WP-29 owns reconstruction of peek windows;
WP-28 only preserves that index through `per_segment_apply` so peek- and segment-level results can
be joined without reconstructing windows inside metric functions.

`omega_deg_s` returns `nan` at index zero because `omega[i]` describes the interval `(i-1, i]`; that
sample is undefined, not missing. Callers segment the measured tail and shift reported indices back
into the tick frame, so a segment never starts at tick index 0. Passing the undefined sample into
`segment_submovements` is accepted but stamps `non_finite_interpolated` on every segment of every
export, which makes `summarize_with_flags` exclude all rows.

## One-command pipeline

`research/src/report/run_pipeline.py` is the shared entry point for WP-29/30/31. It chains
`load_export` → `check_dt` → `omega_deg_s`/`epsilon_deg` → `segment_submovements` →
`per_segment_apply`/`summarize_with_flags` and writes three artifacts to `research/out/`
(git-ignored, regenerate on demand):

| Artifact | Contents |
|---|---|
| `pipeline-summary.json` | Export identity, dt report (tick count, median/expected dt, gap list), segmentation counts and success rate, per-metric quality aggregates, flag histograms. Non-finite values are serialized as `null`. |
| `peek-quality.csv` | One row per `visible` event: tick count, segment count, `has_primary_flick`, peek-level flags. |
| `peek-segments.csv` | One row per segment: kind, inclusive tick indices and timestamps, per-segment values, flags. |

```powershell
uv run python src/report/run_pipeline.py                                  # committed synthetic export
uv run python src/report/run_pipeline.py --export fixtures/exports/<real>.json
```

Presentation windows are `[t_visible, next t_visible)` per
[analysis-tracking.md](analysis-tracking.md); the pipeline slices ticks identically to the committed
epsilon parity generator. The per-segment values it writes (`duration_ms`, `peak_omega_deg_s`,
`mean_epsilon_deg`) are **pipeline diagnostics, not coach-report metrics**: they restate quantities
that are already authoritative elsewhere and have not passed a construct-validity gate (GD-20 /
C-D3). Real-export overlay SVGs and the parameter sweep come from
`modules/segments/notebooks/t3-sweep/run_sweep.py`.

## Frozen parameter registry

| Version | SG window/poly | Peak k | Floor | Low ratio | Stop ratio |
|---|---:|---:|---:|---:|---:|
| `seg-v1` | 7 / 3 | 0.5 | 80 deg/s | 0.1 | 0.2 |

The pre-registration sweep evaluated 243 combinations over six deterministic synthetic cases; 108
passed all cases and `seg-v1` had zero case failures with a maximum boundary error of one tick.
Changing any numeric value requires a new version and a full-chain rerun. Real-export overlay and
segmentation-success evidence remain pending until an anonymized export is available; synthetic
evidence does not clear that M14 gate.

## Quality flag vocabulary

The vocabulary is closed by `QUALITY_FLAG_VOCABULARY`. A new exact flag must be added to that
constant and this table before it is emitted. `compute_failed:<reason>` is the sole templated form;
the suffix must be non-empty.

| Flag | Meaning |
|---|---|
| `insufficient_samples` | The inclusive segment contains fewer than two samples. |
| `no_segment` | A peek-level record has no accepted segment. |
| `truncated_at_window_edge` | A segment boundary remained above threshold at a window edge. |
| `below_floor` | The trace did not reach the registered absolute speed floor. |
| `non_uniform_dt` | Tick spacing is unsuitable for uniform-rate downstream calculations. |
| `missing_target` | Required target geometry is unavailable. |
| `empty_signal` | The input trace contains no samples. |
| `zero_motion` | The cleaned trace contains no positive angular speed. |
| `no_peak` | No local maximum passed the registered peak gate. |
| `sg_fallback_short_signal` | The trace was shorter than the SG window and used raw values. |
| `non_finite_replaced` | A wholly non-finite trace was replaced by zeros. |
| `non_finite_interpolated` | Interior non-finite samples were interpolated. |
| `merged_adjacent_peaks` | Overlapping peak intervals were merged into one segment. |
| `compute_failed:<reason>` | A metric function failed or returned a non-finite numeric result. |

`per_segment_apply` returns one row per input segment with tuple-valued `flags` and nullable integer
`peek_index` columns. A failed row remains present with metric values set to `NaN`; other rows are
still computed. `summarize_with_flags` excludes flagged rows, reports finite unflagged `n`, and
reports excluded `n_flagged` separately alongside mean, p50, and sample standard deviation.

## Known limits

- Parameters are registered for nominal 128 Hz traces; other sampling rates require a new version.
- The synthetic sweep exercises the current binary counter-strafe movement profiles, not arbitrary
  continuous-speed movement.
- Per-drill and per-condition sample sizes may be small; reports must display `n` and `n_flagged`.
- Real-data validation scope is not yet established because the anonymized sample is still missing.
  Every claim in this document therefore rests on deterministic synthetic traces; `seg-v1` is
  pre-registered, not validated. See M14 ①④⑤ in
  [WP-28 T-exit](../exec-plan/active/stage4/wp-28-research-foundation/T-exit-gate.md).
- `summarize_with_flags` excludes any flagged row, so a single quality flag removes a segment from
  every aggregate. Aggregates must be read together with `n_flagged` and the flag histogram.
- Segment boundaries are inclusive tick indices, not milliseconds. Converting them to durations
  assumes uniform spacing unless timestamps are used directly; the pipeline uses timestamps.
- A dt gap raises `non_uniform_dt` only on the presentation window that contains it, so one dropped
  tick does not exclude the whole export from every aggregate. The export-wide gap count and gap
  list stay in `pipeline-summary.json`; read both.
