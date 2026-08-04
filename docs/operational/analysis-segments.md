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
