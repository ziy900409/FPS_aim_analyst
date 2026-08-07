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

`omega_deg_s` returns an `OmegaResult` (`values`, `source`). The two sources compute the same
construct — instantaneous view angular speed, one number per tick — from the same math core; they
differ only in where the per-tick delta comes from, never in what is being measured (C-D4: an
existing construct may not acquire a second definition):

- `tick-integral` — `values` derive from `ticks[].dYaw`/`dPitch`, the tick-window mouse integral
  (KI-005 / A). Each mouse event is attributed to the tick containing its own `timeStamp`, so this
  source is structurally immune to render/sim beat aliasing and independent of `displayHz`. Present
  only on exports carrying `meta.mouseIntegration`.
- `aim-diff-legacy` — `values` derive from a per-tick difference of `ticks[].aim`, the only source
  available on exports without `meta.mouseIntegration` (pre-KI-005 exports, including every export
  committed before 2026-08-06). This source carries the render(~240 Hz)/sim(128 Hz)
  zero-order-hold aliasing described in
  [KI-005](../known_issue/KI-005-omega-render-sim-aliasing.md) — a spurious notch roughly every 8
  ticks at 240 Hz, worse at other refresh rates — and must not be treated as a clean trace.

`omega_deg_s` selects `tick-integral` when both new columns exist and are finite for the requested
window, otherwise falls back to `aim-diff-legacy`; `strict=True` raises instead of falling back
silently. Callers must read `.source` off the result rather than assume which derivation an export
carries.

`omega[0]` is `nan` under both sources because `omega[i]` describes the interval `(i-1, i]`; that
sample is undefined, not missing. `tick-integral` could in principle give index 0 a real value (the
first tick has its own integration window), but the contract is kept unchanged on purpose — index 0
stays `nan` under both sources — to avoid touching the frozen `seg-v1` / D-28.12 (`omega[1:]`)
contract. This is a deliberate, logged deferral (TD-3), to be revisited only alongside the `seg-v2`
resweep. Callers segment the measured tail and shift reported indices back into the tick frame, so a
segment never starts at tick index 0. Passing the undefined sample into `segment_submovements` is
accepted but stamps `non_finite_interpolated` on every segment of every export, which makes
`summarize_with_flags` exclude all rows.

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

> ⚠️ `seg-v1`'s SG window (7 ticks) was swept on synthetic signal that cannot contain the KI-005
> render/sim beat artifact — the artifact's period is **8 ticks**, so a 7-tick window is
> mathematically incapable of removing it (see the withdrawal note below). **`seg-v1`'s validity on
> real data is unproven until it is re-swept on a post-KI-005-A export and re-frozen as `seg-v2`**
> (D-28.7: never re-tune a frozen version in place). Until then, treat `seg-v1` as validated only on
> the synthetic suite.

The pre-registration sweep evaluated 243 combinations over six deterministic synthetic cases; 108
passed all cases and `seg-v1` had zero case failures with a maximum boundary error of one tick.
Changing any numeric value requires a new version and a full-chain rerun.

> ⚠️ **WITHDRAWN 2026-08-06.** The real-export validation recorded below no longer supports either
> `seg-v1` or M14's real-data validity gate. Two independent defects were confirmed after it was
> written — see [KI-005](../known_issue/KI-005-omega-render-sim-aliasing.md) and
> [KI-006](../known_issue/KI-006-m14-sample-no-counterstrafe.md). The paragraph is kept verbatim as
> the historical record of what was claimed; **do not cite it as evidence.**
>
> 1. **The angular-speed trace was contaminated by render/sim aliasing** (KI-005). `ticks[].aim` is
>    written on the render path (~240 Hz) and read on the sim path (128 Hz), so one tick in every
>    eight captures only half a frame's displacement. The `merged_adjacent_peaks` reading below is
>    the direct symptom: the SG window is **7** ticks while the artefact period is **8**, so the
>    filter cannot remove it. Effective clean yield was **4 of 19** segments (`n=4, n_flagged=15` in
>    `pipeline-summary.json`), not the 0.95 headline. The 243-combination synthetic sweep that froze
>    `seg-v1` could not have detected this: `make_synthetic_export` produces the `aim` series
>    directly and never traverses the render path.
> 2. **The export contains no counter-strafe behaviour** (KI-006). In the sample cited below,
>    `vx ≠ 0` on **0** of 3,507 ticks, `keys` is empty throughout, and there are **0** `counter`
>    events. It is stationary flick data, so the drill's core construct was never exercised.
>
> Re-validation requires a sample that exercises the construct — the same-day
> `counterstrafe_ad_v1-2026-08-05T09_39_06.031Z` export has 1,415 strafing ticks and 24 `counter`
> events — and must wait until the KI-005 fix lands, since that export is subject to the same
> aliasing. `seg-v1` must then be re-swept and version-bumped rather than adjusted in place.

Real-export validation was completed on 2026-08-05 with the anonymized 27.390625-second
`counterstrafe_ad_v1` export (`participantId=P001`, 3,507 ticks at nominal 128 Hz). The one-command
pipeline reported 20 peeks, 19 primary flicks, one `below_floor|no_segment` peek, and a 0.95
segmentation success rate. Manual inspection of all 20 overlay SVGs found that each of the 19
accepted intervals enclosed the principal angular-speed burst with plausible onset and offset
boundaries; the unsegmented first peek was a long stationary window. Fifteen accepted segments
carry `merged_adjacent_peaks`, but the overlays showed merges within one noisy principal burst and
no merge spanning two visually distinct bursts. This single-export check supports retaining
`seg-v1` unchanged and clears M14's real-data validity gate; it does not establish population-level
validity.

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
- Real-data validation currently covers one anonymized participant and one 27.390625-second
  `counterstrafe_ad_v1` export (20 peeks). The observed 0.95 success rate and visually plausible
  boundaries support `seg-v1` for the M14 foundation gate, but must not be generalized to other
  drills, participants, sampling rates, or continuous-speed movement without additional evidence.
- The T3 evidence runner currently passes the undefined leading `omega[0]` into
  `segment_submovements`, so its `real-peek-segments.csv` stamps `non_finite_interpolated` on all
  19 accepted rows. This is a runner-reporting artifact: the overlay geometry and success count are
  still usable, while the authoritative one-command pipeline follows D-28.12 (`omega[1:]` plus
  index offset) and produces uncontaminated quality aggregates. Do not use the T3 CSV flags as
  quality evidence until the runner is aligned with the pipeline.
- `summarize_with_flags` excludes any flagged row, so a single quality flag removes a segment from
  every aggregate. Aggregates must be read together with `n_flagged` and the flag histogram.
- Segment boundaries are inclusive tick indices, not milliseconds. Converting them to durations
  assumes uniform spacing unless timestamps are used directly; the pipeline uses timestamps.
- A dt gap raises `non_uniform_dt` only on the presentation window that contains it, so one dropped
  tick does not exclude the whole export from every aggregate. The export-wide gap count and gap
  list stay in `pipeline-summary.json`; read both.
