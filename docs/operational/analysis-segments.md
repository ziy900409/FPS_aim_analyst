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
first tick has its own integration window: `ticks[0].dYaw` is `0.0`, not absent), but **TD-3 was
decided at the `seg-v2` resweep (2026-08-07, KI-005-A / A2-T3): the contract stays unchanged** —
index 0 stays `nan` under both sources. Reasoning: many downstream call sites hard-code the
"index 0 is undefined, shift by one" contract (e.g. `run_pipeline.py`'s `_OMEGA_INDEX_OFFSET`);
making it source-conditional would force every consumer to branch on `.source` for the sake of
recovering one tick (~7.8 ms) per presentation window. Callers segment the measured tail and shift
reported indices back into the tick frame, so a segment never starts at tick index 0. Passing the
undefined sample into `segment_submovements` is accepted but stamps `non_finite_interpolated` on
every segment of every export, which makes `summarize_with_flags` exclude all rows.

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

| Version | SG window/poly | Peak k | Floor | Low ratio | Stop ratio | Applies to |
|---|---:|---:|---:|---:|---:|---|
| `seg-v1` | 7 / 3 | 0.5 | 80 deg/s | 0.1 | 0.2 | `aim-diff-legacy` omega only (pre-KI-005 exports) |
| `seg-v2` | 11 / 3 | 0.75 | 60 deg/s | 0.1 | 0.2 | `tick-integral` omega only (post-KI-005-A exports) |

`research/src/report/run_pipeline.py::run()` selects between the two automatically by the export's
`omega_deg_s(...).source` — callers never need to pick a version by hand. `seg-v1` is not
deprecated: it stays the correct, frozen choice for any export that only ever carries
`aim-diff-legacy` omega (it can never regain `tick-integral`, since that requires `ticks[].dYaw`/
`dPitch` recorded at capture time), so both versions coexist per D-28.7 rather than one replacing
the other in place.

| Version | Scope | `min_counter_events` | `min_moving_tick_ratio` |
|---|---|---:|---:|
| `construct-v1` | `counterstrafe_*` family, session-level construct presence gate ([KI-006-C](../known_issue/KI-006-C/README.md)) | 1 | 0.05 |

`construct-v1` is frozen the same way as `seg-v1`: a change to either threshold requires a new
version (`construct-v2`), never an in-place edit; every `pipeline-summary.json` records the version
string alongside the judgement (`constructPresence.paramsVersion`).

> ⚠️ `seg-v1`'s SG window (7 ticks) was swept on synthetic signal that cannot contain the KI-005
> render/sim beat artifact — the artifact's period is **8 ticks**, so a 7-tick window is
> mathematically incapable of removing it (see the withdrawal note below). **`seg-v1` stays frozen
> as the correct version for `aim-diff-legacy` exports only** — it is not "fixed" by `seg-v2`,
> because it was never wrong for the signal it was calibrated on; it was only ever asked to
> segment a signal (render/sim-aliased `ticks[].aim`) that no synthetic case represented.
>
> ✅ **`seg-v2` resweep completed 2026-08-07 (KI-005-A / A2-T3).** Same six pre-registered synthetic
> cases, same pass bar (zero case failures, max boundary error ≤2 ticks) — 135 of the widened
> candidate grid passed (window ∈ {5,7,9,11,13} now that the 8-tick beat no longer constrains the
> choice). Frozen `seg-v2` cuts `merged_adjacent_peaks` from 60.0% (`seg-v1` on the same three
> real exports) to 38.3%, holding the identical 98.3% success rate — see the real-export validation
> below. Segment boundaries are unaffected by the version change; only which segments get flagged
> `merged_adjacent_peaks` changes (confirmed by direct overlay comparison, not aggregate counts
> alone).

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

> ⚠️ **Sample does not contain counter-strafe (2026-08-06, KI-006).** The 27.390625 s / 3,507-tick
> sample described above is the `counterstrafe_ad_v1-2026-08-05T08_03_45.617Z` export: `vx ≡ 0` on
> every tick, `keys` is empty throughout, and there are **0** `counter` events. The subject only
> aimed and fired — the drill's core construct (horizontal strafe → counter-strafe stop → aligned
> first shot) was never exercised. `check_construct_presence` ([KI-006-C](../known_issue/KI-006-C/README.md))
> judges this export **`absent`**. The sentence above stating this check "clears M14's real-data
> validity gate" is **withdrawn** — a segmentation success rate measured on stationary flick data is
> not evidence for a counter-strafe drill. This is a **second, independent** withdrawal reason from
> the render/sim aliasing one already noted earlier in this section (KI-005) — even a fully
> aliasing-free re-run of this same sample would still not restore M14 ④/⑤. Re-establishing M14
> ④/⑤ requires a new sample that satisfies both: aliasing-free `ω(t)` (KI-005 A2) and
> `check_construct_presence(...).present == True` (KI-006-C §6 B-1~B-5).

### `seg-v2` real-export validation (2026-08-07, KI-005-A / A2-T2/T3)

Three new `counterstrafe_ad_v1` exports were captured on the same 240 Hz machine
(`counterstrafe_ad_v1-2026-08-07T09_18_05.631Z`/`T09_24_18.148Z`/`T09_37_24.351Z`), each with
`omega_deg_s(..., strict=True)` resolving to `tick-integral` (KI-005 A1 engaged) and
`check_construct_presence(...).present == True` (KI-006-C construct presence gate; both
conditions this table's earlier withdrawal note required). Running the one-command pipeline with
`seg-v2` auto-selected:

| Export | Peeks | Success rate | `merged_adjacent_peaks` |
|---|---:|---:|---:|
| 09:18 | 21 | 1.00 | 6/21 (28.6%) |
| 09:24 | 19 | 0.95 | 8/19 (42.1%) |
| 09:37 | 20 | 1.00 | 9/20 (45.0%) |
| **combined** | 60 | — | **23/60 (38.3%)** |

For comparison, re-running the same three exports with `seg-v1` unchanged (forcing the pre-A1
parameter set onto post-A1 data) gives 36/60 (60.0%) `merged_adjacent_peaks` — the number the
sweep in [KI-005-A/progress.md §2e](../known_issue/KI-005-A/progress.md) reports and the basis for
selecting `seg-v2`. Segment start/end boundaries are identical between the two versions on every
inspected peek; only the `merged_adjacent_peaks` classification changes, confirmed by direct SVG
overlay comparison (not just the aggregate counts above). This clears M14's real-data segmentation
quality bar on aliasing-free, construct-present data — the two conditions the earlier `seg-v1`
withdrawal note above named as required. It does not by itself re-establish M14 ④/⑤: that also
needs the four-check real-data verification in [KI-005-A/progress.md §2e](../known_issue/KI-005-A/progress.md)
(closed 2026-08-07, FM-1 resolved) and the formal re-declaration in
[A2-T4](../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-重新宣告).

## Quality flag vocabulary

The vocabulary is closed by `QUALITY_FLAG_VOCABULARY`. A new exact flag must be added to that
constant and this table before it is emitted. `compute_failed:<reason>` is the sole templated form;
the suffix must be non-empty.

`QUALITY_FLAG_VOCABULARY` (this module, `segments/algorithms/apply.py`) covers the **peek** and
**segment** levels below — one export can have many peeks, each with zero or more segments.
`CONSTRUCT_FLAG_VOCABULARY` (`research/src/modules/ingest/algorithms/construct.py`, KI-006 /
[KI-006-C](../known_issue/KI-006-C/README.md)) is a **separate, session-level** vocabulary — one
verdict per export, asking whether the drill's core behavioural construct (e.g. counter-strafe)
is present at all, upstream of whether any individual peek or segment measured it well. The two
constants are deliberately **not merged**: `ingest` (where construct presence is checked) must not
reverse-depend on `segments`. Both are registered in the same table below, distinguished by the
**Level** column, because a reader auditing "what can a flag mean" needs the full closed vocabulary
regardless of which module emits it.

| Flag | Level | Meaning |
|---|---|---|
| `insufficient_samples` | segment | The inclusive segment contains fewer than two samples. |
| `no_segment` | peek | A peek-level record has no accepted segment. |
| `truncated_at_window_edge` | segment | A segment boundary remained above threshold at a window edge. |
| `below_floor` | peek | The trace did not reach the registered absolute speed floor. |
| `non_uniform_dt` | peek, segment | Tick spacing is unsuitable for uniform-rate downstream calculations; raised on the peek's presentation window and propagated onto every segment computed from it. |
| `missing_target` | peek, segment | Required target geometry is unavailable; raised on the peek and propagated onto every segment computed from it. |
| `empty_signal` | peek | The input trace contains no samples. |
| `zero_motion` | peek | The cleaned trace contains no positive angular speed. |
| `no_peak` | peek | No local maximum passed the registered peak gate. |
| `sg_fallback_short_signal` | peek, segment | The trace was shorter than the SG window and used raw values; a trace-level outcome carried onto every segment produced from that trace. |
| `non_finite_replaced` | peek, segment | A wholly non-finite trace was replaced by zeros; a trace-level outcome carried onto every segment produced from that trace. |
| `non_finite_interpolated` | peek, segment | Interior non-finite samples were interpolated; a trace-level outcome carried onto every segment produced from that trace. |
| `merged_adjacent_peaks` | segment | Overlapping peak intervals were merged into one segment. |
| `compute_failed:<reason>` | segment | A metric function failed or returned a non-finite numeric result. |
| `construct_absent:<construct>` | session | The drill family's declared core construct (e.g. `counter-strafe`) did not appear in this export; the session must not be used for that drill's validity claims. See [KI-006-C](../known_issue/KI-006-C/README.md). |
| `construct_unknown` | session | The export's drill family is not registered in `CONSTRUCT_REGISTRY`; construct presence was **not checked** (this is not the same as "passed"). See [KI-006-C](../known_issue/KI-006-C/README.md). |

`per_segment_apply` returns one row per input segment with tuple-valued `flags` and nullable integer
`peek_index` columns. A failed row remains present with metric values set to `NaN`; other rows are
still computed. `summarize_with_flags` excludes flagged rows, reports finite unflagged `n`, and
reports excluded `n_flagged` separately alongside mean, p50, and sample standard deviation.

## Known limits

- Parameters are registered for nominal 128 Hz traces; other sampling rates require a new version.
- The synthetic sweep exercises the current binary counter-strafe movement profiles, not arbitrary
  continuous-speed movement.
- Per-drill and per-condition sample sizes may be small; reports must display `n` and `n_flagged`.
- Real-data validation currently covers one anonymized participant across four `counterstrafe_ad_v1`
  exports: one `seg-v1`/`aim-diff-legacy` export (withdrawn as M14 evidence, see above — construct
  absent) and three `seg-v2`/`tick-integral` exports (2026-08-07, KI-005-A / A2-T2). Neither version's
  validation must be generalized to other drills, participants, sampling rates, or continuous-speed
  movement without additional evidence.
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
