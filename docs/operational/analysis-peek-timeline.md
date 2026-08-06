# Peek timeline analysis contract (`timeline-v1` + `sync-v1`)

> **Status: 定稿 (2026-08-05, WP-29 T-exit).** `timeline-v1` and `sync-v1` are frozen from this
> point on: a semantic change requires a new version string and a full rerun of the chain, never an
> in-place redefinition (same discipline as `seg-v1` / D-28.7).

WP-29 defines the offline, per-peek event timeline and the Release-to-Click Sync family used by
coach-facing metrics. The implementation authority for the new reconstruction is
`research/src/modules/metrics/algorithms/peek.py` (windows and anchors) plus
`research/src/modules/metrics/algorithms/sync.py` (Sync family and precision verdicts); the three
established aggregate metrics remain governed by frozen `compute-v1` in the engine's
`src/metrics/compute` implementation and are parity-tested at relative error `<= 1e-9`.

| Contract | Version | Authority | Validity tier |
|---|---|---|---|
| `counterReactionMs` / `fireTimingAlignmentMs` / `firstShotHitRate` | `compute-v1` | TypeScript (engine) | Parity-verified against the engine at `<= 1e-9` |
| Peek windows, anchors, `outcome`, flag vocabulary | `timeline-v1` | Python (`peek.py`) | New construct, documented here |
| `release_to_fire_ms` / `counter_hold_ms` / `counter_to_fire_ms` | `sync-v1` | Python (`sync.py`) | New construct + pre-registered precision verdict |
| submovement segmentation | `seg-v1` | Python (`submovement.py`) | Frozen upstream; **not consumed** by this contract |

The coach report v0 (`research/src/report/coach_report.py`) is the single-command consumer: it
renders exactly these six metrics, each annotated with its `n`, flag counts, version string and
validity tier, and refuses to display any construct that has not passed a gate (C-D3 / GD-20).

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

### Additive key-event release evidence (WP-29 / T3, user override)

`build_peek_windows` also carries two **additive** fields that never redefine the frozen `t_release`
above and never enter `flags`:

| Field | Meaning |
|---|---|
| `t_release_event` | The original-direction key's **up** transition inside the window, taken from the additive `events[].key` stream at input `timeStamp` (sub-tick). `None` when no such key event exists. The original-direction key is the opposite of the counter key; with no counter, the latest in-window A/D key up wins (same `(t, key)` tie-break as the tick fallback); an unsupported counter key yields `None`, matching the tick-derived path. |
| `release_source` | `key_event` when `t_release_event` is present, else `tick_keys` (only the frozen tick-derived `t_release` is available). |

This is opt-in observability from the engine's `DataRecorder.recordKeyEvents` (default off): it provides a
direct input-timestamp release anchor that avoids the ±1-tick quantization of tick-derived `t_release`. It is
**not** consumed by frozen `timeline-v1`/`compute-v1`/`sync-v1` — `release_to_fire_ms` still uses the frozen
tick-derived `t_release`, so the pre-registered `sync-v1` precision verdicts are unchanged. Because the source
is expressed as a dedicated `release_source` field rather than a `flags` member, adding it does not alter the
`sync-v1` aggregate `n` (which excludes any flagged row). This T3 slice was implemented under an explicit user
gate override; the frozen `sync-v1` verdict remained `sufficient` and was not re-run or changed.

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

## Report carrier (`coach-report-v0`)

One command turns an export into one self-contained static HTML file:

```
uv run python src/report/coach_report.py --export <path> [--group-by side|ads|weapon_mode] [--out <dir>]
```

The page embeds its own CSS and an inline SVG timeline and references no external resource, so it
can be opened or forwarded without a server (OQ-S4-6 closed on this carrier; an interactive report
remains the documented upgrade trigger). Output is deterministic — no wall-clock stamp, no random
identifier, stable ordering — so a diff in a committed example report always means the data or a
frozen contract changed. Committed examples live in
`research/src/modules/metrics/notebooks/t-exit/outputs/`.

`--group-by` only *partitions* rows the pure algorithms already produced. Every parameter, threshold
and version string is byte-identical across groupings, and the pre-registered precision verdict is
deliberately **not** re-run per group: `sync-v1` was pre-registered at drill level, and re-judging
each stratum would be post-hoc multiple comparison. Per-group output is therefore `n`, statistics
and flag counts only.

## Known limitations

1. **Release timing carries up to one 128 Hz tick (`7.8125 ms`) of quantization error.** The 09:39
   evidence judged both tick-derived metrics `sufficient`, but that is a verdict about this fixture,
   not a population inference. The additive `t_release_event` path above can remove the quantization
   entirely, but only for recordings made with `DataRecorder.recordKeyEvents` enabled — neither
   committed real fixture has it, so every real row reports `release_source = tick_keys`.
2. **Real evidence is two runs from one participant**, with complementary rather than cumulative
   roles: 08:03 is the zero-input boundary (no A/D transition at all, so every Sync anchor is absent
   and `n = 0`), and 09:39 is the primary validity sample (20 peeks, 13 unflagged Sync rows). Neither
   supports population-level inference, and the earlier claim that the only real sample had zero
   strafe was superseded when 09:39 was recorded.
3. **Both real fixtures are hitscan with no ADS-on peek.** `--group-by ads` and `--group-by
   weapon_mode` therefore degenerate to a single cell on real data; projectile behaviour, ADS
   grouping and cross-window hits rely on synthetic coverage (OQ-S4-11 remains open).
4. **There is no `kill` or `timeout` event in schema v2**, so `outcome` is *derived* from the fire
   and hit streams by the table above. A peek that was abandoned without a shot is indistinguishable
   from one that never got a shot off in time; both report `no_shot`.
5. **The no-counter release fallback is unvalidated.** `release_inferred_no_counter` rows are
   excluded from every aggregate by default, and the real fixtures contribute **zero** such rows
   (09:39 has a counter wherever it has a release; 08:03 has neither), so there is still no evidence
   base for admitting the fallback into cross-peek comparison. OQ-S4-10 stays open on that ground.

KI-004 boundary: timeline reconstruction does not consume `px` or `pz`. The 09:39 fixture's
`meta.suspect=true` originates from the unrelated sim/world-unit corridor defect and does not affect
event timestamps or `ticks[].keys` used here. If any future metric in this contract starts consuming
`px`/`pz`, decision D-29.2 lapses immediately and the fixture's usability must be re-assessed.
