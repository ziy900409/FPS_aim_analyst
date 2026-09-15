import { describe, expect, it, vi } from 'vitest';
import {
  createAttemptFinalizationGate,
  describeDiscardReason,
  INVALID_ATTEMPT_BASENAME_MARKER,
  invalidAttemptBasename,
  planFinalization,
  type AttemptFinalizationPlan,
} from './AttemptFinalizationGate.ts';
import { createRunAttemptController } from './RunAttemptController.ts';
import type { AttemptDisposition } from './RunAttemptController.ts';
import type { RecordingIntegrityReason, RecordingSnapshot } from './recordingIntegrity.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;

function ticksFrom(start: number, count: number): Array<{ t: number }> {
  return Array.from({ length: count }, (_, i) => ({ t: start + i * TICK_MS }));
}

function snapshot(overrides: Partial<RecordingSnapshot> = {}): RecordingSnapshot {
  return {
    ticks: ticksFrom(1000, 64),
    events: [],
    simHz: SIM_HZ,
    bufferOverflow: false,
    recorderOverflow: false,
    ...overrides,
  };
}

/** Every consequence field, so a new field cannot be added without every row stating its value. */
const CONSEQUENCES = [
  'buildsPayload',
  'showsMetrics',
  'download',
  'savesHistory',
  'offersReplay',
  'advancesOrchestrator',
  'clearsRecording',
] as const satisfies ReadonlyArray<keyof AttemptFinalizationPlan>;

const ALL_REASONS: readonly RecordingIntegrityReason[] = [
  'tick-non-finite',
  'tick-regression',
  'tick-step-off-grid',
  'event-non-finite',
  'event-out-of-window',
  'event-backward-step-exceeds-tick',
  'pause-fence-unclosed',
  'pause-attempt-overflow',
];

describe('planFinalization — the consequence matrix (README §2.4, FR-69.7/69.8/69.9)', () => {
  it('eligible-candidate keeps every existing path open and clears nothing', () => {
    expect(planFinalization({ kind: 'eligible-candidate' })).toEqual({
      disposition: { kind: 'eligible-candidate' },
      buildsPayload: true,
      showsMetrics: true,
      download: 'official',
      savesHistory: true,
      offersReplay: true,
      advancesOrchestrator: true,
      clearsRecording: false,
    });
  });

  it('invalid-retained keeps the payload but closes history, replay and advance (FR-69.8)', () => {
    expect(planFinalization({ kind: 'invalid-retained', reason: 'paused' })).toEqual({
      disposition: { kind: 'invalid-retained', reason: 'paused' },
      buildsPayload: true,
      showsMetrics: true,
      // OQ-69.1 / D-69-T0-3 — offered, but only as a manual, renamed, audit-only file.
      download: 'diagnostic-manual',
      savesHistory: false,
      offersReplay: false,
      advancesOrchestrator: false,
      // The arena must survive: the operator has not pressed the diagnostic download yet.
      clearsRecording: false,
    });
  });

  it.each(ALL_REASONS)('discarded (%s) refuses at the payload line and clears (FR-69.9/FM-7)', (reason) => {
    expect(planFinalization({ kind: 'discarded', reason })).toEqual({
      disposition: { kind: 'discarded', reason },
      buildsPayload: false,
      showsMetrics: false,
      download: 'none',
      savesHistory: false,
      offersReplay: false,
      advancesOrchestrator: false,
      clearsRecording: true,
    });
  });

  it('never lets a non-eligible attempt reach history, replay or an orchestrator advance', () => {
    const nonEligible: AttemptDisposition[] = [
      { kind: 'invalid-retained', reason: 'paused' },
      ...ALL_REASONS.map((reason): AttemptDisposition => ({ kind: 'discarded', reason })),
    ];
    for (const disposition of nonEligible) {
      const plan = planFinalization(disposition);
      expect({
        savesHistory: plan.savesHistory,
        offersReplay: plan.offersReplay,
        advancesOrchestrator: plan.advancesOrchestrator,
        official: plan.download === 'official',
      }).toEqual({ savesHistory: false, offersReplay: false, advancesOrchestrator: false, official: false });
    }
  });

  it('states every consequence on every row (a new field cannot default itself in)', () => {
    const rows = [
      planFinalization({ kind: 'eligible-candidate' }),
      planFinalization({ kind: 'invalid-retained', reason: 'paused' }),
      planFinalization({ kind: 'discarded', reason: 'pause-fence-unclosed' }),
    ];
    for (const row of rows) {
      for (const field of CONSEQUENCES) expect(row[field]).toBeDefined();
      // `disposition` + the seven consequences: a field added to the interface without being added
      // to all three constants would fail here rather than silently arriving as `undefined`.
      expect(Object.keys(row).sort()).toEqual([...CONSEQUENCES, 'disposition'].sort());
    }
  });

  it('returns the very disposition it was handed (no re-derivation, C-D4)', () => {
    const disposition: AttemptDisposition = { kind: 'discarded', reason: 'tick-regression' };
    expect(planFinalization(disposition).disposition).toBe(disposition);
  });
});

describe('invalidAttemptBasename — the forced diagnostic filename (FR-69.8)', () => {
  it('appends the marker before the extension the download helper adds', () => {
    expect(invalidAttemptBasename('counterstrafe_ad_v1-2026-09-15T09_18_05.351Z')).toBe(
      'counterstrafe_ad_v1-2026-09-15T09_18_05.351Z.invalid-paused',
    );
  });

  it('is idempotent — double-marking cannot happen', () => {
    const once = invalidAttemptBasename('run');
    expect(invalidAttemptBasename(once)).toBe(once);
    expect(once.match(/\.invalid-paused/g)).toHaveLength(1);
  });

  it('exposes the marker as a constant so tests and e2e assert one spelling', () => {
    expect(INVALID_ATTEMPT_BASENAME_MARKER).toBe('.invalid-paused');
    expect(invalidAttemptBasename('x')).toContain(INVALID_ATTEMPT_BASENAME_MARKER);
  });
});

describe('describeDiscardReason — the frozen vocabulary stays fully covered', () => {
  it.each(ALL_REASONS)('%s has operator-facing text', (reason) => {
    const text = describeDiscardReason(reason);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('gives each reason its own text (no copy-paste collisions)', () => {
    const texts = ALL_REASONS.map((reason) => describeDiscardReason(reason));
    expect(new Set(texts).size).toBe(ALL_REASONS.length);
  });
});

describe('createAttemptFinalizationGate — one call site, one decision', () => {
  it('asks the controller exactly once per decide() and plans that answer', () => {
    const finalize = vi.fn<(s: RecordingSnapshot) => AttemptDisposition>(() => ({
      kind: 'invalid-retained',
      reason: 'paused',
    }));
    const gate = createAttemptFinalizationGate({ finalize });
    const snap = snapshot();

    const plan = gate.decide(snap);

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(snap);
    expect(plan.download).toBe('diagnostic-manual');
    expect(plan.savesHistory).toBe(false);
  });

  it('drives a real controller: clean run → eligible, everything stays open', () => {
    const gate = createAttemptFinalizationGate(createRunAttemptController());
    const plan = gate.decide(snapshot());
    expect(plan.disposition).toEqual({ kind: 'eligible-candidate' });
    expect(plan.buildsPayload && plan.savesHistory && plan.advancesOrchestrator).toBe(true);
  });

  it('drives a real controller: paused then resumed → invalid-retained, history closed', () => {
    const controller = createRunAttemptController();
    // A correct mapper freezes active time, so the fence is degenerate — the same shape T2 proves.
    const frozenActive = 1000 + 10 * TICK_MS;
    controller.pause(frozenActive);
    controller.beginResume();
    controller.confirmLock(0);
    controller.finishResumeCountdown(frozenActive);

    const plan = createAttemptFinalizationGate(controller).decide(snapshot());

    expect(plan.disposition).toEqual({ kind: 'invalid-retained', reason: 'paused' });
    expect(plan.buildsPayload).toBe(true);
    expect(plan.savesHistory).toBe(false);
    expect(plan.clearsRecording).toBe(false);
  });

  it('drives a real controller: finalized while still paused → discarded, no payload (OQ-69.4)', () => {
    const controller = createRunAttemptController();
    controller.pause(1000 + 10 * TICK_MS);

    const plan = createAttemptFinalizationGate(controller).decide(snapshot());

    expect(plan.disposition).toEqual({ kind: 'discarded', reason: 'pause-fence-unclosed' });
    expect(plan.buildsPayload).toBe(false);
    expect(plan.clearsRecording).toBe(true);
  });

  it('restart() hands the next attempt a clean eligible plan', () => {
    const controller = createRunAttemptController();
    controller.pause(1000);
    const gate = createAttemptFinalizationGate(controller);
    expect(gate.decide(snapshot()).disposition.kind).toBe('discarded');

    controller.restart();

    expect(gate.decide(snapshot()).disposition).toEqual({ kind: 'eligible-candidate' });
  });
});
