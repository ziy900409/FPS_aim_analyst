import { describe, expect, it } from 'vitest';
import { createRunAttemptController, type RunAttemptController } from './RunAttemptController.ts';
import type { RecordingSnapshot } from './recordingIntegrity.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;

function cleanSnapshot(overrides: Partial<RecordingSnapshot> = {}): RecordingSnapshot {
  return {
    ticks: Array.from({ length: 8 }, (_unused, index) => ({ t: 1000 + index * TICK_MS })),
    events: [],
    simHz: SIM_HZ,
    bufferOverflow: false,
    recorderOverflow: false,
    ...overrides,
  };
}

/** Drive one full pause → resume cycle; active time is frozen, so both stamps are the same. */
function pauseAndResume(controller: RunAttemptController, atActiveMs: number): void {
  controller.pause(atActiveMs);
  controller.beginResume();
  controller.confirmLock(999_000);
  controller.finishResumeCountdown(atActiveMs);
}

describe('createRunAttemptController — fresh attempt', () => {
  it('starts active, eligible and on attempt 1', () => {
    const controller = createRunAttemptController();
    expect(controller.phase).toBe('active');
    expect(controller.validity).toBe('eligible-candidate');
    expect(controller.attempt).toBe(1);
    expect(controller.pauseOccurred).toBe(false);
    expect(controller.pauseFences).toEqual([]);
  });
});

// FR-69.2 — the whole point of the WP. Every path that could plausibly look like "recovery" is
// enumerated here, because each one is a way a real operator might expect eligibility back.
describe('sticky invalidation (FR-69.2)', () => {
  it('invalidates on the first pause', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    expect(controller.phase).toBe('paused');
    expect(controller.validity).toBe('invalid-paused');
    expect(controller.pauseOccurred).toBe(true);
  });

  it('does not restore eligibility when the resume request starts', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    expect(controller.phase).toBe('locking');
    expect(controller.validity).toBe('invalid-paused');
  });

  it('does not restore eligibility when Pointer Lock is re-acquired', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(4242);
    expect(controller.phase).toBe('resume-countdown');
    expect(controller.validity).toBe('invalid-paused');
  });

  it('does not restore eligibility when the resume countdown completes', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.phase).toBe('active');
    expect(controller.validity).toBe('invalid-paused');
    expect(controller.pauseOccurred).toBe(true);
  });

  it('stays invalid across many resume cycles', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    pauseAndResume(controller, 2000);
    pauseAndResume(controller, 3000);
    expect(controller.validity).toBe('invalid-paused');
    expect(controller.pauseFences).toHaveLength(3);
  });

  // Only `restart()` may write validity back — there is intentionally no other setter.
  it('exposes no mutator that clears validity other than restart()', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    for (const call of [
      () => controller.pause(1100),
      () => controller.beginResume(),
      () => controller.confirmLock(1200),
      () => controller.finishResumeCountdown(1000),
    ]) {
      call();
      expect(controller.validity).toBe('invalid-paused');
    }
    controller.restart();
    expect(controller.validity).toBe('eligible-candidate');
  });
});

describe('pause idempotence and fence bookkeeping', () => {
  it('opens exactly one fence no matter how many times pause repeats', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.pause(1500);
    controller.pause(2000);
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: undefined }]);
  });

  it('closes the fence at the end of the resume countdown, not at lock confirmation', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(5000);
    // Lock is back, but input, camera and the measurement clock stay frozen through the countdown
    // (FR-69.5 / NFR-69.4) — so the fence is still open here.
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: undefined }]);
    controller.finishResumeCountdown(1000);
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: 1000 }]);
  });

  it('reuses the open fence when the lock is lost again mid-resume', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.pause(1400); // request failed / lock lost again
    expect(controller.phase).toBe('paused');
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: undefined }]);
  });

  it('reuses the open fence when the lock is lost during the resume countdown', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(5000);
    controller.pause(1000);
    expect(controller.phase).toBe('paused');
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: undefined }]);
  });

  it('records lock confirmations for audit', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(5000);
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(9000);
    expect(controller.lockConfirmations).toEqual([5000, 9000]);
  });
});

describe('illegal transitions are ignored, not thrown (UI lives directly on these)', () => {
  it('ignores beginResume() while active', () => {
    const controller = createRunAttemptController();
    controller.beginResume();
    expect(controller.phase).toBe('active');
    expect(controller.validity).toBe('eligible-candidate');
  });

  it('ignores a stray lock confirmation outside a resume request', () => {
    const controller = createRunAttemptController();
    controller.confirmLock(1000);
    expect(controller.phase).toBe('active');
    controller.pause(1000);
    controller.confirmLock(1100); // paused, but no resume was requested
    expect(controller.phase).toBe('paused');
    expect(controller.lockConfirmations).toEqual([]);
  });

  it('ignores a countdown completion that no lock confirmation preceded', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.finishResumeCountdown(1000); // never confirmed the lock
    expect(controller.phase).toBe('locking');
    expect(controller.pauseFences).toEqual([{ pausedAtMs: 1000, resumedAtMs: undefined }]);
  });

  it('ignores a repeated beginResume()', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.beginResume();
    expect(controller.phase).toBe('locking');
  });
});

describe('restart() is the only way back to a fresh candidate (FR-69.6)', () => {
  it('clears pause state, validity and fences, and increments the attempt', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    controller.beginResume();
    controller.confirmLock(5000);
    controller.restart();
    expect(controller.phase).toBe('active');
    expect(controller.validity).toBe('eligible-candidate');
    expect(controller.attempt).toBe(2);
    expect(controller.pauseOccurred).toBe(false);
    expect(controller.pauseFences).toEqual([]);
    expect(controller.lockConfirmations).toEqual([]);
  });

  it('increments the attempt every time, including from a clean attempt', () => {
    const controller = createRunAttemptController();
    controller.restart();
    controller.restart();
    expect(controller.attempt).toBe(3);
    expect(controller.validity).toBe('eligible-candidate');
  });

  it('lets a restarted attempt finalize as a fresh eligible candidate', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.finalize(cleanSnapshot())).toEqual({ kind: 'invalid-retained', reason: 'paused' });
    controller.restart();
    expect(controller.finalize(cleanSnapshot())).toEqual({ kind: 'eligible-candidate' });
  });
});

// FR-69.7 — three dispositions, each with a positive case and a counter-case proving the other
// branches do not produce it.
describe('finalize() — eligible-candidate', () => {
  it('is produced by a never-paused attempt with a clean recording', () => {
    const controller = createRunAttemptController();
    expect(controller.finalize(cleanSnapshot())).toEqual({ kind: 'eligible-candidate' });
  });

  it('is not produced once the attempt has been paused, even after a full resume', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.finalize(cleanSnapshot()).kind).not.toBe('eligible-candidate');
  });

  it('is not produced when the recording integrity fails', () => {
    const controller = createRunAttemptController();
    const broken = cleanSnapshot({ ticks: [{ t: 1000 }, { t: Number.NaN }] });
    expect(controller.finalize(broken).kind).not.toBe('eligible-candidate');
  });

  it('survives an overflow on a never-paused attempt (OQ-69.3 — no policy change)', () => {
    const controller = createRunAttemptController();
    const overflowed = cleanSnapshot({ bufferOverflow: true, recorderOverflow: true });
    expect(controller.finalize(overflowed)).toEqual({ kind: 'eligible-candidate' });
  });
});

describe('finalize() — invalid-retained', () => {
  it('is produced by a paused attempt whose timeline is still provable', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.finalize(cleanSnapshot())).toEqual({ kind: 'invalid-retained', reason: 'paused' });
  });

  // Retention requires a *closed* fence, so re-pausing after a completed resume takes the attempt
  // back out of retainable and into discarded. This is what stops "still paused" from quietly
  // becoming retainable, and it is the frozen T0.5 criterion (pause/resume counts must match).
  it('is withdrawn again if the attempt re-pauses and is finalized while still paused', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.finalize(cleanSnapshot())).toEqual({ kind: 'invalid-retained', reason: 'paused' });
    controller.pause(1000);
    expect(controller.finalize(cleanSnapshot())).toEqual({
      kind: 'discarded',
      reason: 'pause-fence-unclosed',
    });
  });

  it('is not produced by a never-paused attempt', () => {
    const controller = createRunAttemptController();
    expect(controller.finalize(cleanSnapshot()).kind).not.toBe('invalid-retained');
  });

  it('loses to integrity failure — a paused attempt with a broken axis discards', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    const broken = cleanSnapshot({ ticks: [{ t: 1000 }, { t: 900 }] });
    expect(controller.finalize(broken)).toEqual({ kind: 'discarded', reason: 'tick-regression' });
  });
});

describe('finalize() — discarded', () => {
  it('is produced when a paused attempt also overflowed (OQ-69.3)', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    expect(controller.finalize(cleanSnapshot({ recorderOverflow: true }))).toEqual({
      kind: 'discarded',
      reason: 'pause-attempt-overflow',
    });
  });

  it('is produced when the attempt is still paused at finalization', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    expect(controller.finalize(cleanSnapshot())).toEqual({
      kind: 'discarded',
      reason: 'pause-fence-unclosed',
    });
  });

  it('reports the first reason in the frozen vocabulary order when several apply', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    const broken = cleanSnapshot({ ticks: [{ t: Number.NaN }, { t: 900 }], recorderOverflow: true });
    expect(controller.finalize(broken)).toEqual({ kind: 'discarded', reason: 'tick-non-finite' });
  });

  it('is not produced by a clean never-paused attempt', () => {
    const controller = createRunAttemptController();
    expect(controller.finalize(cleanSnapshot()).kind).not.toBe('discarded');
  });

  // FM-7 — `finalize()` is a query over timestamps only. It must be safe to call before any
  // payload exists, which is the whole reason the disposition is decided this early.
  it('does not mutate controller state, so it is safe to call before a payload exists', () => {
    const controller = createRunAttemptController();
    pauseAndResume(controller, 1000);
    const before = {
      phase: controller.phase,
      validity: controller.validity,
      attempt: controller.attempt,
      fences: [...controller.pauseFences],
    };
    controller.finalize(cleanSnapshot());
    controller.finalize(cleanSnapshot({ recorderOverflow: true }));
    expect({
      phase: controller.phase,
      validity: controller.validity,
      attempt: controller.attempt,
      fences: [...controller.pauseFences],
    }).toEqual(before);
  });
});

describe('active time is frozen across a pause (NFR-69.3 contract, enforced here)', () => {
  it('admits ticks straddling a degenerate fence', () => {
    const controller = createRunAttemptController();
    const ticks = Array.from({ length: 8 }, (_unused, index) => ({ t: 1000 + index * TICK_MS }));
    pauseAndResume(controller, ticks[4]!.t);
    expect(controller.finalize(cleanSnapshot({ ticks }))).toEqual({
      kind: 'invalid-retained',
      reason: 'paused',
    });
  });

  // If the mapper ever let active time advance while paused, the fence widens and the ticks it
  // swallowed become the evidence. This is the T2 regression detector, expressed at T1.
  it('discards when active time advanced during the pause (mapper leak)', () => {
    const controller = createRunAttemptController();
    const ticks = Array.from({ length: 8 }, (_unused, index) => ({ t: 1000 + index * TICK_MS }));
    controller.pause(ticks[2]!.t);
    controller.beginResume();
    controller.confirmLock(5000);
    controller.finishResumeCountdown(ticks[6]!.t); // leaked: active time moved while paused
    expect(controller.finalize(cleanSnapshot({ ticks }))).toEqual({
      kind: 'discarded',
      reason: 'pause-fence-unclosed',
    });
  });
});
