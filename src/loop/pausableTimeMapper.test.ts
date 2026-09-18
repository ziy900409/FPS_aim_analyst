import { describe, expect, it } from 'vitest';
import { createRunAttemptController } from '../attempt/RunAttemptController.ts';
import type { RecordingSnapshot } from '../attempt/recordingIntegrity.ts';
import { SIM_HZ } from './constants.ts';
import { createPausableTimeMapper } from './pausableTimeMapper.ts';

/**
 * WP-69 / T2 — `PausableTimeMapper` unit contract.
 *
 * The three invariants in the module doc get one section each, plus the cross-module proof that a
 * mapper-driven pause produces the **degenerate** fence `RunAttemptController` was built to expect
 * (D-69-T1-1). Wall values below are deliberately ugly fractions: `performance.now()` returns
 * sub-millisecond fractions, and identity/continuity claims that only hold for round numbers are
 * worthless.
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125

/** Realistic wall samples: a session already ~7 minutes in, 60 FPS-ish, fractional. */
const WALL_SAMPLES = [419_837.4, 419_854.066_666_67, 419_870.733_333_34, 419_887.4, 419_904.066_666_7];

describe('PausableTimeMapper — identity before the first pause (NFR-69.1)', () => {
  it('returns the argument itself, not an arithmetically equal double', () => {
    const mapper = createPausableTimeMapper();
    for (const wall of WALL_SAMPLES) {
      expect(Object.is(mapper.mapWallTime(wall), wall)).toBe(true);
    }
  });

  it('is identity for the doubles a naive "wall - 0" offset would survive least well', () => {
    const mapper = createPausableTimeMapper();
    for (const wall of [0, -0, Number.MIN_VALUE, Number.EPSILON, 1e-300, Number.MAX_VALUE]) {
      expect(Object.is(mapper.mapWallTime(wall), wall)).toBe(true);
    }
  });

  it('reports no excluded wall time and is not paused', () => {
    const mapper = createPausableTimeMapper();
    mapper.mapWallTime(WALL_SAMPLES[0]!);
    expect(mapper.paused).toBe(false);
    expect(mapper.excludedWallMs).toBe(0);
  });

  it('stays identity after a restart with no pause in between', () => {
    const mapper = createPausableTimeMapper();
    mapper.restart(WALL_SAMPLES[0]!);
    expect(Object.is(mapper.mapWallTime(WALL_SAMPLES[1]!), WALL_SAMPLES[1]!)).toBe(true);
  });
});

describe('PausableTimeMapper — frozen while paused (NFR-69.2)', () => {
  it('returns one fixed value for every call during the pause, whatever the wall delta', () => {
    const mapper = createPausableTimeMapper();
    const frozen = mapper.pause(419_837.4);
    expect(frozen).toBe(419_837.4);
    expect(mapper.paused).toBe(true);
    // 1 ms, 1 s, 10 s, 300 s into the pause — the DoD's three durations and then some.
    for (const dt of [1, 1_000, 10_000, 300_000]) {
      expect(Object.is(mapper.mapWallTime(419_837.4 + dt), frozen)).toBe(true);
    }
  });

  it('is idempotent: a second pause neither moves the fence nor re-counts excluded time', () => {
    const mapper = createPausableTimeMapper();
    const first = mapper.pause(419_837.4);
    const second = mapper.pause(419_937.4);
    expect(Object.is(second, first)).toBe(true);
    mapper.resume(420_837.4);
    expect(mapper.excludedWallMs).toBe(1000); // measured from the *first* pause
  });

  it('freezes DOM-style event timestamps through the same entry point', () => {
    const mapper = createPausableTimeMapper();
    const frozen = mapper.pause(419_837.4);
    // An input event queued mid-pause maps to the freeze point, never past it.
    expect(mapper.mapWallTime(419_900.1)).toBe(frozen);
  });
});

describe('PausableTimeMapper — exact continuity across resume (NFR-69.3)', () => {
  it('resume() returns the same double pause() returned', () => {
    const mapper = createPausableTimeMapper();
    const pausedAt = mapper.pause(419_837.4);
    const resumedAt = mapper.resume(422_951.766_666_67);
    expect(Object.is(resumedAt, pausedAt)).toBe(true);
  });

  it('maps the resume instant back to exactly that value', () => {
    const mapper = createPausableTimeMapper();
    const pausedAt = mapper.pause(419_837.4);
    const resumeWall = 422_951.766_666_67;
    mapper.resume(resumeWall);
    expect(Object.is(mapper.mapWallTime(resumeWall), pausedAt)).toBe(true);
  });

  it('advances 1:1 with wall time after resume, excluding exactly the pause duration', () => {
    const mapper = createPausableTimeMapper();
    mapper.pause(419_837.4);
    mapper.resume(422_837.4); // 3000 ms paused
    expect(mapper.excludedWallMs).toBe(3000);
    expect(mapper.mapWallTime(422_853.4)).toBe(419_853.4); // +16 ms wall ⇒ +16 ms active
    expect(mapper.mapWallTime(432_837.4)).toBe(429_837.4); // +10 s wall ⇒ +10 s active
  });

  it('keeps active time monotonic across three pause/resume cycles', () => {
    const mapper = createPausableTimeMapper();
    let wall = 419_837.4;
    let previous = mapper.mapWallTime(wall);
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let frame = 0; frame < 5; frame++) {
        wall += 16.666_666_67;
        const active = mapper.mapWallTime(wall);
        expect(active).toBeGreaterThanOrEqual(previous);
        previous = active;
      }
      mapper.pause(wall);
      for (let frame = 0; frame < 60; frame++) {
        wall += 16.666_666_67;
        expect(mapper.mapWallTime(wall)).toBe(previous); // frozen, not merely non-decreasing
      }
      mapper.resume(wall);
      expect(mapper.mapWallTime(wall)).toBe(previous);
    }
    // Three pauses of 60 frames each; the excluded total is wall time, not active time.
    expect(mapper.excludedWallMs).toBeCloseTo(3 * 60 * 16.666_666_67, 6);
  });

  it('excludes pause wall duration from a gameplay elapsed reading (T2 DoD)', () => {
    const mapper = createPausableTimeMapper();
    const runStartWall = 419_837.4;
    const runStartActive = mapper.mapWallTime(runStartWall);
    mapper.pause(runStartWall + 5_000);
    mapper.resume(runStartWall + 5_000 + 12_345.6); // 12.3456 s staring at the pause overlay
    const endWall = runStartWall + 5_000 + 12_345.6 + 3_000;
    const elapsedActive = mapper.mapWallTime(endWall) - runStartActive;
    expect(elapsedActive).toBeCloseTo(8_000, 9); // 5 s before + 3 s after, not 20.3456 s
    expect(endWall - runStartWall - mapper.excludedWallMs).toBeCloseTo(elapsedActive, 9);
  });
});

describe('PausableTimeMapper — fail fast on impossible clocks (T2 step 5)', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    it(`throws when mapWallTime receives ${String(bad)}`, () => {
      const mapper = createPausableTimeMapper();
      expect(() => mapper.mapWallTime(bad)).toThrow(RangeError);
    });

    it(`throws when pause receives ${String(bad)}`, () => {
      const mapper = createPausableTimeMapper();
      expect(() => mapper.pause(bad)).toThrow(RangeError);
    });

    it(`throws when resume receives ${String(bad)}`, () => {
      const mapper = createPausableTimeMapper();
      mapper.pause(419_837.4);
      expect(() => mapper.resume(bad)).toThrow(RangeError);
    });

    it(`throws when restart receives ${String(bad)}`, () => {
      const mapper = createPausableTimeMapper();
      expect(() => mapper.restart(bad)).toThrow(RangeError);
    });
  }

  it('throws rather than folding a backwards clock into the resume anchor', () => {
    const mapper = createPausableTimeMapper();
    mapper.pause(419_837.4);
    expect(() => mapper.resume(419_837.3)).toThrow(/went backwards/);
  });

  it('accepts a resume at exactly the pause instant (zero-length pause)', () => {
    const mapper = createPausableTimeMapper();
    const pausedAt = mapper.pause(419_837.4);
    expect(Object.is(mapper.resume(419_837.4), pausedAt)).toBe(true);
    expect(mapper.excludedWallMs).toBe(0);
  });

  it('leaves state untouched when resume is called while not paused', () => {
    const mapper = createPausableTimeMapper();
    expect(mapper.resume(419_837.4)).toBe(419_837.4);
    expect(mapper.paused).toBe(false);
    expect(mapper.excludedWallMs).toBe(0);
    expect(Object.is(mapper.mapWallTime(419_854.06), 419_854.06)).toBe(true); // still identity
  });
});

describe('PausableTimeMapper — restart returns to the fresh-run state (FR-69.6 / NFR-69.8)', () => {
  it('drops the accumulated offset and is identity again', () => {
    const mapper = createPausableTimeMapper();
    mapper.pause(419_837.4);
    mapper.resume(422_837.4);
    expect(mapper.mapWallTime(422_853.4)).toBe(419_853.4);
    mapper.restart(422_900);
    expect(Object.is(mapper.mapWallTime(422_953.4), 422_953.4)).toBe(true);
    expect(mapper.excludedWallMs).toBe(0);
    expect(mapper.paused).toBe(false);
  });

  it('unfreezes an attempt that was still paused when restart was pressed', () => {
    const mapper = createPausableTimeMapper();
    mapper.pause(419_837.4);
    expect(mapper.paused).toBe(true);
    mapper.restart(420_000);
    expect(mapper.paused).toBe(false);
    expect(Object.is(mapper.mapWallTime(420_016.6), 420_016.6)).toBe(true);
  });
});

/**
 * The T1 integrity check `pause-fence-unclosed` rejects any attempt with a tick or gameplay event
 * timestamped **inside** a pause fence. That check is a proof rather than a tolerance only because
 * a correct mapper makes the fence degenerate. Prove that here, from the mapper's own return
 * values, so a regression in either module fails on this test instead of silently discarding real
 * runs.
 */
describe('PausableTimeMapper x RunAttemptController — the fence stays degenerate (D-69-T1-1)', () => {
  function snapshotAround(pausedAtMs: number): RecordingSnapshot {
    // Ticks straddling the fence: the last one before the pause, the first ones after the resume.
    return {
      simHz: SIM_HZ,
      ticks: [pausedAtMs - TICK_MS, pausedAtMs, pausedAtMs + TICK_MS, pausedAtMs + 2 * TICK_MS].map(
        (t) => ({ t }),
      ),
      events: [{ t: pausedAtMs - 1 }, { t: pausedAtMs + 1 }],
      bufferOverflow: false,
      recorderOverflow: false,
    };
  }

  it('retains a paused attempt whose pause fence came from the mapper', () => {
    const mapper = createPausableTimeMapper();
    const attempt = createRunAttemptController();
    const pausedAt = mapper.pause(419_837.4);
    attempt.pause(pausedAt);
    attempt.beginResume();
    attempt.confirmLock(422_800);
    const resumedAt = mapper.resume(422_951.766_666_67);
    attempt.finishResumeCountdown(resumedAt);

    expect(attempt.pauseFences).toEqual([{ pausedAtMs: pausedAt, resumedAtMs: pausedAt }]);
    expect(attempt.finalize(snapshotAround(pausedAt))).toEqual({
      kind: 'invalid-retained',
      reason: 'paused',
    });
  });

  it('survives three pause/resume cycles without opening a fence', () => {
    const mapper = createPausableTimeMapper();
    const attempt = createRunAttemptController();
    let wall = 419_837.4;
    for (let cycle = 0; cycle < 3; cycle++) {
      wall += 500;
      attempt.pause(mapper.pause(wall));
      attempt.beginResume();
      attempt.confirmLock(wall + 100);
      wall += 2_000;
      attempt.finishResumeCountdown(mapper.resume(wall));
    }
    for (const fence of attempt.pauseFences) {
      expect(fence.resumedAtMs).toBe(fence.pausedAtMs);
    }
    expect(attempt.finalize(snapshotAround(attempt.pauseFences[0]!.pausedAtMs)).kind).toBe(
      'invalid-retained',
    );
  });
});

describe('PausableTimeMapper — purity (NFR-69.5, ADR-4, GD-5)', () => {
  const raw = import.meta.glob<string>('./pausableTimeMapper.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['./pausableTimeMapper.ts']!;
  // Comments are stripped first: the module doc *names* `performance.now()` when explaining which
  // clock domain callers must pass in, and that prose is the point — the claim under test is that
  // no executable line reads a clock.
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  for (const [label, pattern] of [
    ['performance.now()', /\bperformance\.now\s*\(/],
    ['Date.now()', /\bDate\.now\s*\(/],
    ['Math.random()', /\bMath\.random\s*\(/],
    ['document', /\bdocument\./],
    ['window', /\bwindow\./],
  ] as const) {
    it(`never reaches for ${label} — callers pass wall time in`, () => {
      expect(pattern.test(source)).toBe(false);
    });
  }
});
