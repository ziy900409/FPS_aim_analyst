/**
 * WP-69 / T1 — recording timestamp integrity, the sole authority for the `discarded` disposition.
 *
 * Pure module: no DOM, no Three.js, no `SharedState`, no sim import. It takes a snapshot of what
 * the recorder already produced and answers one question — *can this attempt's time axis be
 * proven continuous?* If not, `RunAttemptController.finalize()` must refuse to build a payload at
 * all (FR-69.9 / FM-7), so this evaluation has to run **before** any payload or metric exists.
 *
 * ⚠️ The reason vocabulary below is **closed** and was frozen in T0 (progress.md §T0.5) by
 * measuring the 9 committed clean fixtures (13,262 ticks / 634 events), not by picking thresholds.
 * Do not add a 9th reason and do not loosen a criterion while implementing a later task: version
 * the contract instead. The two asymmetries are the whole point and are load-bearing:
 *
 *  - The **tick** axis is bit-exact (`dt === tickMs`, zero tolerance). At `SIM_HZ = 128`,
 *    `tickMs = 7.8125` is exactly representable in float, and all 13,253 measured clean steps hit
 *    it to the bit — so any epsilon here could only ever hide a real defect.
 *  - The **event** axis gets a one-tick backward window, and zero tolerance there would reject
 *    clean production data. `counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json` really does step
 *    backwards 0.2025 ms at idx 67 while `meta.suspect === false` and `lateEventCount === 0`.
 *    The cause is not late delivery: `simStep()` calls `recordVisibleEvents(state, tickEndMs, …)`
 *    *before* `consume()`, so within one tick a sim-stamped event (`tickEndMs`) lands before an
 *    input-stamped one (DOM `event.timeStamp`, inside `[tickStart, tickEnd)`). That is a
 *    cross-clock interleave bounded by exactly one tick, not disorder.
 */

/** Closed vocabulary — frozen by WP-69 T0 (progress.md §T0.5). Extend only by versioning. */
export type RecordingIntegrityReason =
  | 'tick-non-finite'
  | 'tick-regression'
  | 'tick-step-off-grid'
  | 'event-non-finite'
  | 'event-out-of-window'
  | 'event-backward-step-exceeds-tick'
  | 'pause-fence-unclosed'
  | 'pause-attempt-overflow';

/**
 * Declaration order doubles as report order, so `reasons[0]` is a stable canonical reason for the
 * single-reason `AttemptDisposition.discarded`.
 */
const REASON_ORDER: readonly RecordingIntegrityReason[] = [
  'tick-non-finite',
  'tick-regression',
  'tick-step-off-grid',
  'event-non-finite',
  'event-out-of-window',
  'event-backward-step-exceeds-tick',
  'pause-fence-unclosed',
  'pause-attempt-overflow',
];

/**
 * One pause/resume pair in **active measurement time** (the mapper's domain, T2), never wall time.
 * A correct mapper freezes active time across a pause, so a closed fence is degenerate
 * (`resumedAtMs === pausedAtMs`) and nothing can fall strictly inside it. That is exactly why the
 * "no tick/event inside the fence" check is a mechanical proof of the freeze rather than a
 * tolerance: if active time ever leaks forward during a pause, the fence opens up and catches it.
 */
export interface PauseFence {
  readonly pausedAtMs: number;
  /** `undefined` = still paused when finalization was attempted ⇒ the fence never closed. */
  readonly resumedAtMs: number | undefined;
}

/** Pause facts, supplied by `RunAttemptController` from its own state — never by the caller. */
export interface PauseIntegrityInput {
  /** The sticky flag. Must agree with `fences`; a disagreement is itself a fence failure. */
  readonly pauseOccurred: boolean;
  readonly fences: readonly PauseFence[];
}

/** Structural minimum this evaluator needs; `TickRecord` and `DrillEvent` both satisfy it. */
export interface RecordingStamp {
  readonly t: number;
}

export interface RecordingSnapshot {
  readonly ticks: readonly RecordingStamp[];
  readonly events: readonly RecordingStamp[];
  /** Sim rate the ticks were produced at; `tickMs = 1000 / simHz`. */
  readonly simHz: number;
  readonly bufferOverflow: boolean;
  readonly recorderOverflow: boolean;
}

export interface RecordingIntegrityReport {
  readonly ok: boolean;
  /** Deduped, in `REASON_ORDER`. Empty iff `ok`. */
  readonly reasons: readonly RecordingIntegrityReason[];
}

/**
 * Pure `(snapshot, pause) → report`. Reasons are **not** mutually exclusive by construction — a
 * regressing tick also steps off grid, and both are reported. Each criterion answers its own
 * question about the time axis; collapsing them would lose audit detail.
 */
export function evaluateRecordingIntegrity(
  snapshot: RecordingSnapshot,
  pause: PauseIntegrityInput,
): RecordingIntegrityReport {
  const hit = new Set<RecordingIntegrityReason>();
  const tickMs = 1000 / snapshot.simHz;
  const { ticks, events } = snapshot;

  for (let i = 0; i < ticks.length; i += 1) {
    const t = ticks[i]!.t;
    if (!Number.isFinite(t)) {
      hit.add('tick-non-finite');
      continue;
    }
    if (i === 0) continue;
    const previous = ticks[i - 1]!.t;
    if (!Number.isFinite(previous)) continue;
    if (t < previous) hit.add('tick-regression');
    if (t - previous !== tickMs) hit.add('tick-step-off-grid');
  }

  // Window bounds come from the tick axis, so they only exist once there is a tick axis.
  const firstTick = ticks.length > 0 ? ticks[0]!.t : undefined;
  const lastTick = ticks.length > 0 ? ticks[ticks.length - 1]!.t : undefined;
  const windowUsable =
    firstTick !== undefined &&
    lastTick !== undefined &&
    Number.isFinite(firstTick) &&
    Number.isFinite(lastTick);

  for (let i = 0; i < events.length; i += 1) {
    const t = events[i]!.t;
    if (!Number.isFinite(t)) {
      hit.add('event-non-finite');
      continue;
    }
    // `firstTick − tickMs`: an input event stamped inside the first tick's own window is legal.
    if (windowUsable && (t < firstTick - tickMs || t > lastTick)) hit.add('event-out-of-window');
    if (i === 0) continue;
    const previous = events[i - 1]!.t;
    if (!Number.isFinite(previous)) continue;
    // One-tick window, not a tolerance — see the cross-clock interleave note in the file header.
    if (previous - t >= tickMs) hit.add('event-backward-step-exceeds-tick');
  }

  if (!pauseFenceClosed(pause, ticks, events)) hit.add('pause-fence-unclosed');

  // OQ-69.3 — overflow discards only on an attempt that was paused. A clean never-paused run keeps
  // its existing `meta.suspect` semantics bit-for-bit; this WP does not quietly rewrite the global
  // quality policy.
  if (pause.pauseOccurred && (snapshot.bufferOverflow || snapshot.recorderOverflow)) {
    hit.add('pause-attempt-overflow');
  }

  const reasons = REASON_ORDER.filter((reason) => hit.has(reason));
  return { ok: reasons.length === 0, reasons };
}

function pauseFenceClosed(
  pause: PauseIntegrityInput,
  ticks: readonly RecordingStamp[],
  events: readonly RecordingStamp[],
): boolean {
  // The sticky flag and the fence list are two views of one fact; disagreement means the pause
  // bookkeeping is broken, which is precisely what an unclosed fence reports.
  if (pause.pauseOccurred !== pause.fences.length > 0) return false;

  for (const fence of pause.fences) {
    const { pausedAtMs, resumedAtMs } = fence;
    if (!Number.isFinite(pausedAtMs)) return false;
    if (resumedAtMs === undefined) return false;
    if (!Number.isFinite(resumedAtMs)) return false;
    if (resumedAtMs < pausedAtMs) return false;
    if (resumedAtMs === pausedAtMs) continue; // degenerate fence: active time froze, as required
    if (stampInsideFence(ticks, pausedAtMs, resumedAtMs)) return false;
    if (stampInsideFence(events, pausedAtMs, resumedAtMs)) return false;
  }
  return true;
}

function stampInsideFence(
  stamps: readonly RecordingStamp[],
  pausedAtMs: number,
  resumedAtMs: number,
): boolean {
  for (const stamp of stamps) {
    if (stamp.t > pausedAtMs && stamp.t < resumedAtMs) return true;
  }
  return false;
}
