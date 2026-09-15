import {
  evaluateRecordingIntegrity,
  type PauseFence,
  type RecordingIntegrityReason,
  type RecordingSnapshot,
} from './recordingIntegrity.ts';

/**
 * WP-69 / T1 — the single authority for pause lifecycle, sticky attempt validity and the resulting
 * disposition (README §2.1, FR-69.2/69.3/69.6/69.7).
 *
 * Pure state machine: zero DOM, Three.js, `SharedState`, sim or research imports (T1 DoD), so the
 * rule "a paused attempt can never be adopted" is testable without a browser and has exactly one
 * definition (C-D4). `DrillPhase = idle | armed | countdown | running | ended` is **not** touched:
 * pause is an orthogonal runtime state (D-69.P1 / FM-3). Pause and resume never call
 * `DrillRunner.start()` or `restart()`; only the Restart control routes through `restart()`.
 *
 * Two invariants this module exists to enforce:
 *
 *  1. **Sticky invalidation.** The first `pause()` sets `invalid-paused` and nothing short of
 *     `restart()` clears it — not resume, not re-acquiring Pointer Lock, not finishing the resume
 *     countdown (FR-69.2). There is deliberately no setter that walks validity back.
 *  2. **Integrity outranks validity.** `finalize()` evaluates recording integrity *first*, so an
 *     attempt whose time axis cannot be proven continuous yields `discarded` and its caller must
 *     never build a payload or compute a metric from it (FR-69.9 / FM-7).
 *
 * Active-time note: the fence opened by `pause()` closes at `finishResumeCountdown()`, not at
 * `confirmLock()`. Acquiring the lock only enters the resume countdown; gameplay input, camera and
 * the measurement clock all stay frozen until the countdown completes (FR-69.5 / NFR-69.4), so the
 * whole locking + countdown span belongs inside the fence.
 */

/** Orthogonal to `DrillPhase` — never merge the two (D-69.P1 / FM-3). */
export type PauseRuntimePhase = 'active' | 'paused' | 'locking' | 'resume-countdown';

export type AttemptValidity = 'eligible-candidate' | 'invalid-paused';

/**
 * `eligible-candidate` is **not** "accepted": it only means the attempt has earned the right to
 * face the existing eligibility / quality / compatibility gates (README §1.3). `invalid-retained`
 * is **not** "low quality but usable": it is explicitly non-adoptable, audit-only.
 */
export type AttemptDisposition =
  | { readonly kind: 'eligible-candidate' }
  | { readonly kind: 'invalid-retained'; readonly reason: 'paused' }
  | { readonly kind: 'discarded'; readonly reason: RecordingIntegrityReason };

export interface RunAttemptController {
  readonly phase: PauseRuntimePhase;
  readonly validity: AttemptValidity;
  /** 1-based; `restart()` increments it. Same drill/config/scene/weapon/seed (FR-69.6). */
  readonly attempt: number;
  /** True from the first `pause()` of this attempt until `restart()`. Feeds `meta.validity`. */
  readonly pauseOccurred: boolean;
  /** Active-time fences for this attempt, for integrity proof and audit. */
  readonly pauseFences: readonly PauseFence[];
  /** Wall-clock times a Pointer Lock was re-confirmed, newest last. Audit only. */
  readonly lockConfirmations: readonly number[];
  pause(atActiveMs: number): void;
  beginResume(): void;
  confirmLock(atWallMs: number): void;
  finishResumeCountdown(atActiveMs: number): void;
  restart(): void;
  finalize(snapshot: RecordingSnapshot): AttemptDisposition;
}

export function createRunAttemptController(): RunAttemptController {
  let phase: PauseRuntimePhase = 'active';
  let validity: AttemptValidity = 'eligible-candidate';
  let attempt = 1;
  let fences: PauseFence[] = [];
  let lockConfirmations: number[] = [];

  /**
   * Illegal transitions are no-ops rather than throws. These methods sit directly under UI events
   * (a double-clicked Resume button, a stray `pointerlockchange` while already active), and a throw
   * there would take the app down mid-run — which is a worse outcome than ignoring the edge. Every
   * accepted source phase is spelled out below so "ignored" is a decision, not an oversight.
   */
  return {
    get phase() {
      return phase;
    },
    get validity() {
      return validity;
    },
    get attempt() {
      return attempt;
    },
    get pauseOccurred() {
      return validity === 'invalid-paused';
    },
    get pauseFences() {
      return fences;
    },
    get lockConfirmations() {
      return lockConfirmations;
    },

    pause(atActiveMs: number): void {
      // Reachable from active, locking and resume-countdown: losing the lock again during a resume
      // attempt must land back in `paused` (FR-69.5). Already-paused is idempotent — no second
      // fence, because active time has been frozen since the first one opened.
      if (phase === 'paused') return;
      phase = 'paused';
      validity = 'invalid-paused'; // sticky; nothing below ever writes it back
      const open = fences.length > 0 ? fences[fences.length - 1]! : undefined;
      if (open === undefined || open.resumedAtMs !== undefined) {
        fences = [...fences, { pausedAtMs: atActiveMs, resumedAtMs: undefined }];
      }
    },

    beginResume(): void {
      if (phase !== 'paused') return;
      phase = 'locking';
    },

    confirmLock(atWallMs: number): void {
      // Only a lock confirmed while we asked for one counts. A `pointerlockchange` arriving in any
      // other phase is not a resume, and must not skip the countdown.
      if (phase !== 'locking') return;
      phase = 'resume-countdown';
      lockConfirmations = [...lockConfirmations, atWallMs];
    },

    finishResumeCountdown(atActiveMs: number): void {
      if (phase !== 'resume-countdown') return;
      phase = 'active';
      const open = fences.length > 0 ? fences[fences.length - 1]! : undefined;
      if (open !== undefined && open.resumedAtMs === undefined) {
        fences = [...fences.slice(0, -1), { pausedAtMs: open.pausedAtMs, resumedAtMs: atActiveMs }];
      }
      // validity deliberately untouched: finishing the countdown does not restore eligibility.
    },

    restart(): void {
      // The only path back to `eligible-candidate`. Callers pair this with the single
      // `restartActiveDrill()` coordinator that also resets recorder, RNG stream, tick index and
      // UI — this controller owns only the attempt-validity half of that reset (FR-69.6 / FM-8).
      phase = 'active';
      validity = 'eligible-candidate';
      attempt += 1;
      fences = [];
      lockConfirmations = [];
    },

    finalize(snapshot: RecordingSnapshot): AttemptDisposition {
      const integrity = evaluateRecordingIntegrity(snapshot, {
        pauseOccurred: validity === 'invalid-paused',
        fences,
      });
      // Integrity first (FM-7): a `discarded` attempt must be refused before anything downstream
      // builds a payload or computes a metric from timestamps it cannot trust.
      if (!integrity.ok) return { kind: 'discarded', reason: integrity.reasons[0]! };
      if (validity === 'invalid-paused') return { kind: 'invalid-retained', reason: 'paused' };
      return { kind: 'eligible-candidate' };
    },
  };
}
