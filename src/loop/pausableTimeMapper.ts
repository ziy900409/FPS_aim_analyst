/**
 * WP-69 / T2 — `PausableTimeMapper`: the single mapping from wall time to **active measurement
 * time** (README §2.2, FR-69.1, NFR-69.1/69.2/69.3).
 *
 * Every measurement timestamp in the app comes from one Chromium time origin: rAF `now`, DOM
 * `event.timeStamp` and `performance.now()`. This module maps that one wall axis onto the axis the
 * sim, the recorder and the gameplay HUD actually live on, where a paused attempt contributes no
 * time at all. It never reads a clock itself — callers pass the wall value in — so it stays a pure,
 * O(1) arithmetic object with no allocation on the hot path (NFR-69.5).
 *
 * Why a mapper rather than "just stop pumping": `SimLoop.pump()` accumulates the rAF delta and
 * clamps it at 250 ms, then re-anchors `simTimeMs` to the raw `nowMs` when the clamp fires
 * ([SimLoop.ts](./SimLoop.ts), KI-001 / INV-ReAnchor). Skipping `pump()` for the pause and resuming
 * therefore costs one 250 ms catch-up frame **and** injects a multi-second discontinuity into the
 * tick timestamps on the frame after that (measured in T0.4: 32 ticks, then a 2766.667 ms jump).
 * Keeping `pump()` running on frozen active time makes both impossible by construction: the delta
 * the loop sees across a pause is zero.
 *
 * Three invariants this module exists to hold:
 *
 *  1. **Identity until the first pause.** `mapWallTime()` returns the argument itself — the same
 *     double, not an arithmetically equal one — so a never-paused run is bit-for-bit the run we had
 *     before WP-69 existed (NFR-69.1). The short-circuit below is that guarantee, not an
 *     optimisation.
 *  2. **Frozen while paused.** Every call during a pause returns one stored value, so `pump()` sees
 *     `delta === 0` and yields `ticks === 0` no matter how long the pause lasts (NFR-69.2).
 *  3. **Exactly continuous across resume.** `resume()` returns the same double `pause()` returned,
 *     and mapping the resume instant reproduces it exactly. This is what makes the pause fence in
 *     `RunAttemptController` **degenerate** — a single point rather than an interval — which in turn
 *     is what lets `pause-fence-unclosed` be a mechanical proof instead of a tolerance
 *     (D-69-T1-1). A mapper that let active time leak during a pause would open the fence and the
 *     attempt would be `discarded`; that is the intended detector, so it must not fire on us.
 */

/** `performance.now()` is finite and monotonic by spec; a violation means a broken caller. */
function assertFiniteWallMs(wallNowMs: number, label: string): void {
  if (!Number.isFinite(wallNowMs)) {
    throw new RangeError(`PausableTimeMapper.${label}: wall time must be finite, received ${wallNowMs}`);
  }
}

export interface PausableTimeMapper {
  /**
   * Wall ms → active ms. Strictly identity before the first `pause()`; a fixed value while paused.
   * Pure read: safe to call for rAF `now` and for DOM `event.timeStamp` alike, including event
   * timestamps that predate the current frame (T3 feeds both through here).
   */
  mapWallTime(wallNowMs: number): number;
  /**
   * Freeze active time. Returns the active ms the attempt paused at — feed it straight to
   * `RunAttemptController.pause()`; do not recompute it, or the fence stops being exact.
   * Idempotent: a second `pause()` while paused returns the same value and changes nothing.
   */
  pause(wallNowMs: number): number;
  /**
   * Unfreeze. Returns the active ms measurement resumes at, which is **the same double**
   * `pause()` returned — feed it to `RunAttemptController.finishResumeCountdown()`.
   * Called when the resume countdown completes, not when the lock is re-acquired: the whole
   * locking + countdown span stays frozen (FR-69.5).
   */
  resume(wallNowMs: number): number;
  /** Full reset to the never-paused identity state, for the single full-restart coordinator. */
  restart(wallNowMs: number): void;
  readonly paused: boolean;
  /** Wall ms excluded from active time so far this attempt. Audit / HUD proof only. */
  readonly excludedWallMs: number;
}

export function createPausableTimeMapper(): PausableTimeMapper {
  let everPaused = false;
  let paused = false;
  /** Active ms at which the current (or most recent) pause froze the clock. */
  let frozenActiveMs = 0;
  let pausedAtWallMs = 0;
  let excludedWallMs = 0;
  // Post-resume mapping is anchored on a (wall, active) pair rather than a subtracted offset.
  // `(w - resumeWallMs) + resumeActiveMs` reproduces `resumeActiveMs` exactly at `w === resumeWallMs`
  // for every representable input, whereas `w - offset` only does so when the rounding happens to
  // cooperate. Invariant 3 above has to hold for all inputs, not for the plausible ones.
  let resumeWallMs = 0;
  let resumeActiveMs = 0;

  const map = (wallNowMs: number): number => {
    assertFiniteWallMs(wallNowMs, 'mapWallTime');
    if (paused) return frozenActiveMs;
    if (!everPaused) return wallNowMs; // bit-exact identity (invariant 1)
    return wallNowMs - resumeWallMs + resumeActiveMs;
  };

  return {
    mapWallTime: map,

    get paused() {
      return paused;
    },
    get excludedWallMs() {
      return excludedWallMs;
    },

    pause(wallNowMs: number): number {
      assertFiniteWallMs(wallNowMs, 'pause');
      if (paused) return frozenActiveMs;
      frozenActiveMs = map(wallNowMs);
      pausedAtWallMs = wallNowMs;
      paused = true;
      everPaused = true;
      return frozenActiveMs;
    },

    resume(wallNowMs: number): number {
      assertFiniteWallMs(wallNowMs, 'resume');
      if (!paused) return map(wallNowMs); // not paused: nothing to unfreeze, no state change
      if (wallNowMs < pausedAtWallMs) {
        // Fail fast rather than fold a backwards clock into the anchor: a negative pause duration
        // would push active time backwards and surface downstream as `tick-regression` in an
        // export, long after the evidence of what went wrong is gone.
        throw new RangeError(
          `PausableTimeMapper.resume: wall time went backwards (${wallNowMs} < ${pausedAtWallMs})`,
        );
      }
      excludedWallMs += wallNowMs - pausedAtWallMs;
      resumeWallMs = wallNowMs;
      resumeActiveMs = frozenActiveMs;
      paused = false;
      return frozenActiveMs;
    },

    restart(wallNowMs: number): void {
      // A restarted attempt must be indistinguishable from a fresh one, mapper included: back to
      // identity so its tick timestamps match a never-paused run (FR-69.6 / NFR-69.8). Callers run
      // this *before* rebuilding the SimLoop, since the loop anchors itself off the mapped clock.
      assertFiniteWallMs(wallNowMs, 'restart');
      everPaused = false;
      paused = false;
      frozenActiveMs = 0;
      pausedAtWallMs = 0;
      excludedWallMs = 0;
      resumeWallMs = 0;
      resumeActiveMs = 0;
    },
  };
}
