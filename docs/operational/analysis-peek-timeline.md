# Peek timeline analysis contract (`timeline-v1`)

WP-29 T1 defines the offline, per-peek event timeline used by later coach-facing metrics. The
implementation authority for the new reconstruction is
`research/src/modules/metrics/algorithms/peek.py`; the three established aggregate metrics remain
governed by frozen `compute-v1` in `src/metrics/compute.ts` and are parity-tested at relative error
`<= 1e-9`.

## Window and anchors

Every `visible` event produces exactly one window. Windows are ordered by `visible.t`, use
`[t_visible, next_visible.t)`, and end at positive infinity for the final peek. Tick membership uses
the existing `1e-9 ms` boundary tolerance. No window is dropped or merged.

| Anchor | `timeline-v1` definition |
|---|---|
| `t_visible` | The window's `visible.t` in measurement-clock milliseconds. |
| `t_counter` | The first `counter` event in the window, regardless of key. Multiple counter events retain the first and add `multiple_counters`. |
| `t_release` with counter | The original-direction key is the opposite of `counter.key` (`A <-> D`). `t_release` is the last tick in the window where that key is held immediately before a later in-window tick where it is released. |
| `t_release` without counter | Use the latest in-window held-to-released transition of either A or D and add `release_inferred_no_counter`. If no such transition exists, keep `None` and add `no_key_transition`. |
| `t_first_shot` | The first in-window `fire` with `firstShot === true` and absent `targetId` or `targetId == visible.targetId`. |
| `fires` | All in-window `fire.t` values in stable chronological order, including follow-up shots. |

`t_release` is tick-derived: it represents the last observed held sample, not an input-event
timestamp. At 128 Hz its quantization is one tick (`7.8125 ms`) and is assessed formally in T2;
T1 does not aggregate Release-to-Click Sync metrics.

## Hit association and outcome

Hitscan uses `fire.hit === true`, with `t_hit = fire.t`. Projectile association uses `shotSeq`
between an in-window fire and any `hit` event in the export. The associated hit is not clipped to
the presentation window. If `hit.t >= t_end`, the peek remains a hit and receives
`hit_outside_window`. When several shots hit, `t_hit` is the earliest associated hit time.

| Fires in window | Any fire hits | Outcome |
|---|---|---|
| none | — | `no_shot` |
| one or more | yes | `hit` |
| one or more | no | `timeout` |

Outcome describes any shot in the peek. It is intentionally distinct from `firstShotHitRate`, which
uses only the compatible first shot and divides by all visible events. Consequently, a peek may have
`outcome=hit` while its first shot is a miss and a follow-up shot hits.

## Closed flag vocabulary

| Flag | Meaning |
|---|---|
| `empty_window` | No tick belongs to the window; `ads=None`. |
| `no_counter` | No counter event belongs to the window. |
| `multiple_counters` | More than one counter event belongs to the window; the first remains authoritative. |
| `unsupported_counter_key` | The first counter key is not A or D, so no counter-derived release key is available. |
| `release_inferred_no_counter` | `t_release` used the no-counter A/D fallback. |
| `no_key_transition` | No eligible held-to-released transition exists; `t_release=None`. |
| `no_first_shot` | No target-compatible first-shot fire exists in the window. |
| `hit_outside_window` | A shot fired in this window hit at or after the next visible event. |
| `missing_release` | Sync cannot compute a release-anchored value because `t_release=None`. |
| `missing_counter` | Sync cannot compute a counter-anchored value because `t_counter=None`. |
| `missing_first_shot` | Sync cannot compute a fire-anchored value because `t_first_shot=None`. |
| `counter_hold_truncated` | The counter key remains held at the last in-window tick; the reported hold is clipped there and excluded from aggregation. |

The algorithm asserts that every emitted flag is in this table. Missing anchors are explicit
semantics: they remain `None` and do not enter the corresponding `compute-v1` aggregate; they are
never replaced with zero or NaN.

## Release-to-Click Sync contract (`sync-v1`)

`research/src/modules/metrics/algorithms/sync.py` is authoritative for the new Sync family. It emits
one row per `PeekWindow`; no row is dropped. The three time columns preserve signed differences and
use Python `None` when an endpoint is absent.

| Metric | `sync-v1` definition | Timing precision |
|---|---|---|
| `release_to_fire_ms` | `t_first_shot - t_release` | Tick-derived release endpoint, up to one tick of quantization. |
| `counter_hold_ms` | From sub-tick `t_counter` to the last observed tick on which the counter key remains continuously held. A release observed in the next tick closes the interval. If the key is still held at the final in-window tick, return the clipped duration with `counter_hold_truncated`. | Tick-derived release endpoint, up to one tick of quantization. |
| `counter_to_fire_ms` | `t_first_shot - t_counter`; identical to frozen `compute-v1` `fireTimingAlignmentMs`. | Sub-tick input timestamps at both endpoints; not precision-judged here. |

Every row also carries `peek_index`, `side`, `ads`, `weapon_mode`, and the combined peek/Sync flags.
`weapon_mode` is `projectile` when `meta.weapon.bullet` is present and otherwise `hitscan`; the
notebook boundary resolves that metadata and passes the explicit value into the pure algorithm.

The formal aggregate eligibility rule is deliberately conservative: a metric value enters `n` and
sample SD only when it is finite and the row's `flags` tuple is empty. Thus
`release_inferred_no_counter`, `multiple_counters`, unrelated outcome flags, and clipped holds are
all inspectable in row output but excluded by default. This keeps OQ-S4-10 open without silently
admitting inferred release anchors.

### Pre-registered precision decision

`SyncParams(min_samples=10, sd_ratio_threshold=1/3, version="sync-v1")` is frozen. With 128 Hz
ticks, `tick_ms = 7.8125` and uniform-quantization SD is exactly
`tick_ms / sqrt(12) = 2.255274489021976 ms`. `sample_sd_ms` uses sample SD (division by `n - 1`).

| Condition, evaluated independently for `release_to_fire_ms` and `counter_hold_ms` | Verdict | T3 consequence |
|---|---|---|
| `n < 10` | `blocked-by-data` | Do not trigger T3. |
| `n >= 10` and `quantization_sd_ms >= sample_sd_ms * (1/3)` | `insufficient` | Trigger T3, but implement it only in the T3 slice. |
| `n >= 10` and `quantization_sd_ms < sample_sd_ms * (1/3)` | `sufficient` | Skip T3 and retain tick-derived release timing. |

Equality belongs to `insufficient`. The threshold may not be adjusted after seeing fixture results;
a changed definition requires a new version and a full rerun.

## Aggregate parity contract

- `counterReactionMs = t_counter - t_visible` for peeks with a counter.
- `fireTimingAlignmentMs = t_first_shot - t_counter` only when both anchors exist.
- `firstShotHitRate = compatible first-shot hits / visible count * 100`.
- `stat()` filters non-finite values, returns zeros with `n=0`, uses linear-interpolated p50, and
  population SD (division by `n`).

Committed parity covers `synthetic_timeline.json`, the 08:03 zero-input fixture, and the 09:39
counter-strafe fixture. `timeline-v1`, `compute-v1`, and frozen `seg-v1` semantics require an explicit
version change rather than in-place redefinition.

## Known limitations

1. Release timing has up to one 128 Hz tick of quantization error. T2's 09:39 evidence judged both
   tick-derived metrics `sufficient`, but that verdict is fixture-specific rather than a population
   inference.
2. Real evidence is two runs from one participant. The 08:03 run has no A/D transition, while 09:39
   contributes only 20 counter/alignment samples; neither supports population-level inference.
3. Both real fixtures are hitscan and provide no ADS-on comparison. Projectile, ADS grouping, and
   cross-window hit behavior therefore rely on synthetic coverage (OQ-S4-11 remains open).

KI-004 boundary: timeline reconstruction does not consume `px` or `pz`. The 09:39 fixture's
`meta.suspect=true` originates from the unrelated sim/world-unit corridor defect and does not affect
event timestamps or `ticks[].keys` used here.
